from datetime import datetime, timezone
import json
import logging
import shlex

import requests

from django.conf import settings
from django.core.cache import cache

from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


logger = logging.getLogger("events")


def get_cache_key(token):
    # TODO: token can be a JWT which makes for a really big cache key
    return f"fxa_token_{token}"


def introspect_token(introspect_token_url, token, cache_key, cache_timeout):
    try:
        fxa_resp = requests.post(introspect_token_url, json={"token": token})
    except:
        logger.error(
            "Could not introspect token with FXA.",
            extra={"fxa_response": shlex.quote(fxa_resp.text)},
        )
        # cache empty response data to prevent FXA failures from causing runaway
        # HTTP retries
        fxa_resp_data = {"status_code": None, "json": {}}
        cache.set(cache_key, fxa_resp_data, cache_timeout)
        raise AuthenticationFailed("Could not introspect token with FXA.")

    fxa_resp_data = {"status_code": fxa_resp.status_code, "json": {}}
    try:
        fxa_resp_data["json"] = fxa_resp.json()
    except requests.exceptions.JSONDecodeError:
        logger.error(
            "JSONDecodeError from FXA introspect response.",
            extra={"fxa_response": shlex.quote(fxa_resp.text)},
        )
        cache.set(cache_key, fxa_resp_data, cache_timeout)
        raise AuthenticationFailed("JSONDecodeError from FXA introspect response")
    cache.set(cache_key, fxa_resp_data, cache_timeout)
    return fxa_resp_data


class FxaTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        authorization = get_authorization_header(request).decode()
        if not authorization or not authorization.startswith("Bearer "):
            # If the request has no Bearer token, return None to attempt the next
            # auth scheme in the REST_FRAMEWORK AUTHENTICATION_CLASSES list
            return None

        token = authorization.split(" ")[1]
        cache_key = get_cache_key(token)
        cached_fxa_resp_data = fxa_resp_data = cache.get(cache_key)
        # set a default cache_timeout, but this will be overriden to match
        # the 'exp' time in the JWT returned by FXA
        cache_timeout = 60
        if not fxa_resp_data:
            introspect_token_url = (
                "%s/introspect"
                % settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
            )
            fxa_resp_data = introspect_token(
                introspect_token_url, token, cache_key, cache_timeout
            )

        user = None
        if not fxa_resp_data["status_code"] == 200:
            raise AuthenticationFailed("Did not receive a 200 response from FXA.")

        if not fxa_resp_data["json"].get("active"):
            raise AuthenticationFailed("FXA returned active: False for token.")

        # FxA user is active, check for the associated Relay account
        fxa_uid = fxa_resp_data.get("json").get("sub")
        if not fxa_uid:
            raise AuthenticationFailed(
                "Authenticated user does not have a Relay account."
            )
        try:
            sa = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")
        except SocialAccount.DoesNotExist:
            raise AuthenticationFailed(
                "Authenticated user does not have a Relay account."
            )
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
            raise AuthenticationFailed()
