from __future__ import annotations

import logging
import shlex
from datetime import UTC, datetime
from typing import TypedDict, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import cache

import requests
from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
    PermissionDenied,
)
from rest_framework.request import Request

logger = logging.getLogger("events")
INTROSPECT_TOKEN_URL = "{}/introspect".format(
    settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
)


class CachedFxaIntrospectResponse(TypedDict, total=False):
    """The data stored in the cache to avoid multiple introspection requests."""

    status_code: int | None
    data: FxaIntrospectData


class FxaIntrospectData(TypedDict, total=False):
    """Keys seen in the JSON returned from a Mozilla Accounts introspection request"""

    active: bool
    sub: str
    exp: int
    error: str


def get_cache_key(token):
    return f"introspect_result:v1:{token}"


def introspect_token(token: str) -> CachedFxaIntrospectResponse:
    try:
        fxa_resp = requests.post(
            INTROSPECT_TOKEN_URL,
            json={"token": token},
            timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        raise
    except Exception as exc:
        logger.error(
            "Could not introspect token with FXA.",
            extra={"error_cls": type(exc), "error": shlex.quote(str(exc))},
        )
        raise AuthenticationFailed("Could not introspect token with FXA.")

    try:
        data = fxa_resp.json()
    except requests.exceptions.JSONDecodeError:
        logger.error(
            "JSONDecodeError from FXA introspect response.",
            extra={"fxa_response": shlex.quote(fxa_resp.text)},
        )
        raise AuthenticationFailed("JSONDecodeError from FXA introspect response")
    if not isinstance(data, dict):
        logger.error(
            "FXA returned a non-object.",
            extra={"fxa_response": shlex.quote(fxa_resp.text)},
        )
        data = {"error": data}

    return {"status_code": fxa_resp.status_code, "data": cast(FxaIntrospectData, data)}


def get_fxa_uid_from_oauth_token(token: str, use_cache: bool = True) -> str:
    # set a default cache_timeout, but this will be overridden to match
    # the 'exp' time in the JWT returned by FxA
    cache_timeout = 60
    cache_key = get_cache_key(token)

    fxa_resp_data: CachedFxaIntrospectResponse | None = None
    from_cache = False

    if use_cache:
        if fxa_resp_data := cache.get(cache_key):
            from_cache = True
    if fxa_resp_data is None:
        try:
            fxa_resp_data = introspect_token(token)
        except (AuthenticationFailed, requests.Timeout):
            # Cache an empty fxa_resp_data to prevent an outage
            # from causing useless run-away repetitive introspection requests
            fxa_resp_data = {"status_code": None, "data": {}}
            cache.set(cache_key, fxa_resp_data, cache_timeout)
            raise

    try:
        if fxa_resp_data["status_code"] is None:
            raise APIException("Previous FXA call failed, wait to retry.")

        if not fxa_resp_data["status_code"] == 200:
            raise APIException("Did not receive a 200 response from FXA.")

        if not fxa_resp_data["data"].get("active"):
            raise AuthenticationFailed("FXA returned active: False for token.")

        # FxA user is active, check for the associated Relay account
        if (raw_fxa_uid := fxa_resp_data.get("data", {}).get("sub")) is None:
            raise NotFound("FXA did not return an FXA UID.")
    except (APIException, AuthenticationFailed, NotFound):
        if not from_cache:
            cache.set(cache_key, fxa_resp_data, cache_timeout)
        raise

    fxa_uid = str(raw_fxa_uid)

    # cache valid access_token and fxa_resp_data until access_token expiration
    # TODO: revisit this since the token can expire before its time
    if isinstance(fxa_resp_data.get("data", {}).get("exp"), int):
        # Note: FXA iat and exp are timestamps in *milliseconds*
        fxa_token_exp_time = int(fxa_resp_data["data"]["exp"] / 1000)
        now_time = int(datetime.now(UTC).timestamp())
        fxa_token_exp_cache_timeout = fxa_token_exp_time - now_time
        if fxa_token_exp_cache_timeout > cache_timeout:
            # cache until access_token expires (matched Relay user)
            # this handles cases where the token already expired
            cache_timeout = fxa_token_exp_cache_timeout
    cache.set(cache_key, fxa_resp_data, cache_timeout)

    return fxa_uid


class FxaTokenAuthentication(TokenAuthentication):
    """
    Implement authentication with a Mozilla Account bearer token.

    This is passed by Firefox for the Accounts user. Unlike DRF's
    TokenAuthentication, this is not generated by Relay. Instead, it
    needs to be validated by Mozilla Accounts to get the FxA ID.
    """

    keyword = "Bearer"

    def __init__(self, relay_user_required: bool = True) -> None:
        """
        Initialize FxATokenAuthentication.

        If relay_user_required=False, request.user is set to AnonymousUser
        for a valid Accounts token without a matching user. If False
        (the default), authentication fails if there is no matching user.
        """
        self.use_cache = False
        self.relay_user_required = relay_user_required

    def authenticate(self, request: Request) -> None | tuple[User | AnonymousUser, str]:
        """
        Try to authenticate with a Accounts bearer token.

        If successful, it returns a tuple (user, token), which can be accessed at
        request.user and request.auth. If self.relay_user_required is False,
        this may be an AnonymousUser. Also, request.successful_authenticator will be
        an instance of this class.

        If the token is invalid, or is valid but without the required matching
        Relay user, it raises AuthenticationFailed or PermissionDenied.

        If the authentication header is not an Accounts bearer token, it returns None.
        """
        method = request.method
        path = request.path
        self.use_cache = (method == "POST" and path == "/api/v1/relayaddresses/") or (
            method not in ("POST", "DELETE", "PUT")
        )

        # Validate the token header, call authentication_credentials
        return super().authenticate(request)

    def authenticate_credentials(self, key: str) -> tuple[User | AnonymousUser, str]:
        """
        Authenticate the bearer token.

        This is called by DRF authentication framework's authenticate.
        """
        fxa_uid = get_fxa_uid_from_oauth_token(key, self.use_cache)
        try:
            sa = SocialAccount.objects.select_related("user").get(
                uid=fxa_uid, provider="fxa"
            )
        except SocialAccount.DoesNotExist:
            if self.relay_user_required:
                raise PermissionDenied(
                    "Authenticated user does not have a Relay account."
                    " Have they accepted the terms?"
                )
            return (AnonymousUser(), key)
        user = sa.user
        if not user.is_active:
            raise PermissionDenied(
                "Authenticated user does not have an active Relay account."
                " Have they been deactivated?"
            )
        return (user, key)
