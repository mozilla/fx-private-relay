from datetime import datetime, timezone
import json
import logging
import shlex

import requests

from django.conf import settings
from django.core.cache import cache

from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import BaseAuthentication, get_authorization_header


logger = logging.getLogger("events")


def get_cache_key(token):
    return f"fxa_token_{token}"


class FxaTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        authorization = get_authorization_header(request).decode()
        if not authorization or not authorization.startswith("Bearer "):
            return None

        token = authorization.split(" ")[1]
        cache_key = get_cache_key(token)
        cached_fxa_resp_data = fxa_resp_data = cache.get(cache_key)
        cache_timeout = 60
        if not fxa_resp_data:
            introspect_token_url = (
                "%s/introspect"
                % settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
            )
            fxa_resp = requests.post(introspect_token_url, json={"token": token})
            fxa_resp_data = {"status_code": fxa_resp.status_code, "json": None}
            try:
                fxa_resp_data["json"] = fxa_resp.json()
            except requests.exceptions.JSONDecodeError:
                logger.error(
                    "JSONDecodeError from FXA introspect response.",
                    extra={"fxa_response": shlex.quote(fxa_resp.text)},
                )

        user = None
        if (
            fxa_resp_data
            and fxa_resp_data["status_code"] == 200
            and fxa_resp_data["json"]
            and fxa_resp_data["json"].get("active")
        ):

            # FxA user is active, check for the associated Relay account
            fxa_uid = fxa_resp_data.get("json").get("sub")
            if fxa_uid:
                try:
                    sa = SocialAccount.objects.get(uid=fxa_uid)
                except SocialAccount.DoesNotExist:
                    # No Relay account associated with the FxA ID. It might be
                    # a user who deleted their Relay account since they first
                    # signed up
                    pass
                else:
                    user = sa.user

                    # cache fxa_resp_data for as long as access_token is valid
                    # Note: FXA iat and exp are timestamps in *milliseconds*
                    fxa_token_exp_time = int(
                        fxa_resp_data.get("json").get("exp") / 1000
                    )
                    now_time = int(datetime.now(timezone.utc).timestamp())
                    cache_timeout = fxa_token_exp_time - now_time

        # Store FxA response for 60 seconds (errors, inactive users, etc.) or
        # until access_token expires (matched Relay user)
        if not cached_fxa_resp_data:
            cache.set(cache_key, fxa_resp_data, cache_timeout)

        if user:
            return (user, None)
        else:
            return None
