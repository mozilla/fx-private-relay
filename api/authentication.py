from datetime import datetime, timezone
import logging
import shlex

import requests

from django.conf import settings
from django.core.cache import cache

from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
)


logger = logging.getLogger("events")


def get_cache_key(token):
    return hash(token)


def introspect_token(introspect_token_url, token):
    try:
        fxa_resp = requests.post(introspect_token_url, json={"token": token})
    except:
        logger.error(
            "Could not introspect token with FXA.",
            extra={"fxa_response": shlex.quote(fxa_resp.text)},
        )
        raise AuthenticationFailed("Could not introspect token with FXA.")

    fxa_resp_data = {"status_code": fxa_resp.status_code, "json": {}}
    try:
        fxa_resp_data["json"] = fxa_resp.json()
    except requests.exceptions.JSONDecodeError:
        logger.error(
            "JSONDecodeError from FXA introspect response.",
            extra={"fxa_response": shlex.quote(fxa_resp.text)},
        )
        raise AuthenticationFailed("JSONDecodeError from FXA introspect response")
    return fxa_resp_data


class FxaTokenAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        # Note: we need to implement this function to make DRF return a 401 status code
        # when we raise AuthenticationFailed, rather than a 403.
        # See https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication
        return "Bearer"

    def authenticate(self, request):
        authorization = get_authorization_header(request).decode()
        if not authorization or not authorization.startswith("Bearer "):
            # If the request has no Bearer token, return None to attempt the next
            # auth scheme in the REST_FRAMEWORK AUTHENTICATION_CLASSES list
            return None

        token = authorization.split(" ")[1]
        if token == "":
            raise ParseError("Missing FXA Token after 'Bearer'.")

        cache_key = get_cache_key(token)
        # set a default cache_timeout, but this will be overriden to match
        # the 'exp' time in the JWT returned by FXA
        cache_timeout = 60
        cached_fxa_resp_data = fxa_resp_data = cache.get(cache_key)
        if not fxa_resp_data:
            # set a default fxa_resp_data, so any error during introspection
            # will still cache for at least cache_timeout to prevent an outage
            # from causing useless run-away repetitive introspection requests
            fxa_resp_data = {"status_code": None, "json": {}}
            introspect_token_url = (
                "%s/introspect"
                % settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
            )
            try:
                fxa_resp_data = introspect_token(introspect_token_url, token)
            except AuthenticationFailed:
                raise
            finally:
                cache.set(cache_key, fxa_resp_data, cache_timeout)

        user = None
        if fxa_resp_data["status_code"] is None:
            raise APIException("Previous FXA call failed, wait to retry.")

        if not fxa_resp_data["status_code"] == 200:
            raise APIException("Did not receive a 200 response from FXA.")

        if not fxa_resp_data["json"].get("active"):
            raise AuthenticationFailed("FXA returned active: False for token.")

        # FxA user is active, check for the associated Relay account
        fxa_uid = fxa_resp_data.get("json", {}).get("sub")
        if not fxa_uid:
            raise NotFound("FXA did not return an FXA UID.")
        try:
            sa = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")
        except SocialAccount.DoesNotExist:
            raise PermissionDenied("Authenticated user does not have a Relay account.")
        user = sa.user

        # cache fxa_resp_data for as long as access_token is valid
        # Note: FXA iat and exp are timestamps in *milliseconds*
        fxa_token_exp_time = int(fxa_resp_data.get("json").get("exp") / 1000)
        now_time = int(datetime.now(timezone.utc).timestamp())
        cache_timeout = fxa_token_exp_time - now_time

        # Store FxA response for 60 seconds (errors, inactive users, etc.) or
        # until access_token expires (matched Relay user)
        if not cached_fxa_resp_data:
            cache.set(cache_key, fxa_resp_data, cache_timeout)

        if user:
            return (user, token)
        else:
            raise NotFound()
