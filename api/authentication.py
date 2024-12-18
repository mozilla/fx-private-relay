from __future__ import annotations

import logging
import shlex
from datetime import UTC, datetime
from typing import Any, Literal, NoReturn, NotRequired, TypedDict, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import BaseCache, cache

import requests
from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    PermissionDenied,
)
from rest_framework.request import Request

logger = logging.getLogger("events")
INTROSPECT_TOKEN_URL = "{}/introspect".format(
    settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
)


class CachedFxaIntrospectResponse(TypedDict, total=False):
    """The data stored in the cache to avoid multiple introspection requests."""

    v: Literal[1]
    status_code: int
    data: FxaIntrospectData
    error: INTROSPECT_ERROR
    error_args: list[str]


class FxaIntrospectData(TypedDict, total=False):
    """Keys seen in the JSON returned from a Mozilla Accounts introspection request"""

    active: bool
    sub: str
    exp: int
    error: str


class FxaIntrospectCompleteData(TypedDict):
    """
    A valid Mozilla Accounts introspection response.

    There are more keys (scope, client_id, token_type, iat, jti) that are
    present but unused.
    """

    active: bool
    sub: str
    exp: NotRequired[int]


def get_cache_key(token):
    return f"introspect_result:v1:{token}"


class IntrospectionResponse:
    def __init__(
        self,
        data: FxaIntrospectData,
        from_cache: bool = False,
    ):
        # Check if this should have been an IntrospectionError
        if "active" not in data or data["active"] is not True:
            raise ValueError("active should be true")
        if "sub" not in data or not isinstance(data["sub"], str) or not data["sub"]:
            raise ValueError("sub (FxA ID) should be set")
        if "exp" in data and not isinstance(data["exp"], int):
            raise ValueError("exp (Expiration timestamp in milliseconds) should be int")

        self.data: FxaIntrospectCompleteData = cast(FxaIntrospectCompleteData, data)
        self.from_cache = from_cache

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"data={self.data!r}, "
            f"from_cache={self.from_cache!r})"
        )

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, IntrospectionResponse):
            return (self.data == other.data) and (self.from_cache == other.from_cache)
        return False

    def save_to_cache(self, cache: BaseCache, key: str, timeout: int) -> None:
        cached: CachedFxaIntrospectResponse = {
            "v": 1,
            "data": cast(FxaIntrospectData, self.data),
        }
        cache.set(key, cached, timeout)

    @property
    def cache_timeout(self) -> int:
        """
        Return the timeout in seconds from now for an introspected token.

        If `exp` is omitted, 0 is returned. Django's cache framework will not cache
        a value with a 0 timeout.

        Typical expiration is 24 - 48 hours. The token could be revoked before
        the expiration time, so we may want an upper cache limit or to ensure
        the cache is skipped for some operations.
        """
        # Note: FXA iat and exp are timestamps in *milliseconds*
        if "exp" not in self.data:
            return 0
        fxa_token_exp_time = int(self.data["exp"] / 1000)
        now_time = int(datetime.now(UTC).timestamp())
        return fxa_token_exp_time - now_time

    @property
    def fxa_id(self) -> str:
        return self.data["sub"]


INTROSPECT_ERROR = Literal[
    "Timeout",  # Introspection API took too long to response
    "FailedRequest",  # Introspection API request failed
    "NotJson",  # Introspection API did not return JSON
    "NotJsonDict",  # Introspection API did not return a JSON dictionary
    "NotOK",  # Introspection API did not return a 200 or 401 response
    "NotAuthorized",  # Introspection API returned a 401 response
    "NotActive",  # The Accounts user is inactive
    "NoSubject",  # Introspection API did not return a "sub" field
]


class IntrospectionError:
    def __init__(
        self,
        error: INTROSPECT_ERROR,
        error_args: list[str] | None = None,
        status_code: int | None = None,
        data: FxaIntrospectData | None = None,
        from_cache: bool = False,
    ):
        self.status_code = status_code
        self.data = data
        self.error = error
        self.error_args = error_args or []
        self.from_cache = from_cache

    def __repr__(self) -> str:
        parts = [f"{self.__class__.__name__}("]
        first_arg = True
        args = ("error", "error_args", "status_code", "data", "from_cache")
        for arg in args:
            val = getattr(self, arg)
            if val is None or (arg == "error_args" and len(val) == 0):
                continue
            if first_arg:
                first_arg = False
            else:
                parts.append(", ")
            parts.append(f"{arg}={val!r}")
        parts.append(")")
        return "".join(parts)

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, IntrospectionError):
            return (
                (self.status_code == other.status_code)
                and (self.data == other.data)
                and (self.error == other.error)
                and (self.error_args == other.error_args)
                and (self.from_cache == other.from_cache)
            )
        return False

    def raise_exception(self) -> NoReturn:
        if self.error in (
            "Timeout",
            "FailedRequest",
            "NotJson",
            "NotJsonDict",
            "NotOK",
            "NoSubject",
            "BadExpiration",
        ):
            if not self.from_cache:
                logger.error(
                    "accounts_introspection_failed",
                    extra={
                        "error": self.error,
                        "error_args": [shlex.quote(arg) for arg in self.error_args],
                        "status_code": self.status_code,
                        "data": self.data,
                    },
                )
            raise IntrospectUnavailable(self)
        elif self.error in ("NotAuthorized", "NotActive"):
            raise IntrospectAuthenticationFailed(self)
        raise ValueError("Unknown error {self.error}")

    def save_to_cache(self, cache: BaseCache, key: str, timeout: int) -> None:
        cached: CachedFxaIntrospectResponse = {"v": 1, "error": self.error}
        if self.status_code:
            cached["status_code"] = self.status_code
        if self.data:
            cached["data"] = self.data
        if self.error_args:
            cached["error_args"] = self.error_args
        cache.set(key, cached, timeout)


class IntrospectUnavailable(APIException):
    status_code = 503
    default_detail = "Introspection temporarily unavailable, try again later."
    default_code = "introspection_service_unavailable"

    def __init__(
        self, introspection_error: IntrospectionError, *args: Any, **kwargs: Any
    ) -> None:
        self.introspection_error = introspection_error
        super().__init__(*args, **kwargs)


class IntrospectAuthenticationFailed(AuthenticationFailed):
    def __init__(
        self, introspection_error: IntrospectionError, *args: Any, **kwargs: Any
    ) -> None:
        self.introspection_error = introspection_error
        super().__init__(*args, **kwargs)


def load_introspection_result_from_cache(
    cache: BaseCache, cache_key: str
) -> IntrospectionResponse | IntrospectionError | None:
    cached = cache.get(cache_key)
    if cached is None or not isinstance(cached, dict) or cached.get("v") != 1:
        return None
    error = cached.get("error")
    if error:
        return IntrospectionError(
            status_code=cached.get("status_code"),
            data=cached.get("data"),
            error=cached.get("error"),
            error_args=cached.get("error_args"),
            from_cache=True,
        )
    return IntrospectionResponse(data=cached.get("data"), from_cache=True)


def introspect_token(token: str) -> IntrospectionResponse | IntrospectionError:
    """
    Validate an Accounts OAuth token with the introspect API.

    If it is a valid token for a Accounts user, returns IntrospectionResponse.
    If there are any issues, returns IntrospectionError.
    """
    try:
        fxa_resp = requests.post(
            INTROSPECT_TOKEN_URL,
            json={"token": token},
            timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        return IntrospectionError("Timeout")
    except Exception as exc:
        error_args = [exc.__class__.__name__]
        error_args.extend(exc.args)
        return IntrospectionError("FailedRequest", error_args=error_args)

    status_code = fxa_resp.status_code
    try:
        data = fxa_resp.json()
    except requests.exceptions.JSONDecodeError:
        return IntrospectionError(
            "NotJson", status_code=status_code, error_args=[fxa_resp.text]
        )
    if not isinstance(data, dict):
        return IntrospectionError(
            "NotJsonDict", status_code=status_code, error_args=[data]
        )

    fxa_data = cast(FxaIntrospectData, data)
    if status_code == 401:
        return IntrospectionError(
            "NotAuthorized", status_code=status_code, data=fxa_data
        )
    if status_code != 200:
        return IntrospectionError("NotOK", status_code=status_code, data=fxa_data)

    if data.get("active", False) is not True:
        return IntrospectionError("NotActive", status_code=status_code, data=fxa_data)

    if not isinstance(sub := data.get("sub", None), str) or not sub:
        return IntrospectionError("NoSubject", status_code=status_code, data=fxa_data)

    return IntrospectionResponse(data=cast(FxaIntrospectData, data))


def introspect_token_or_raise(
    token: str, use_cache: bool = True
) -> IntrospectionResponse:
    """
    Introspect a Mozilla account OAuth token, to get data like the FxA UID.

    If anything goes wrong, raise an exception.
    """
    default_cache_timeout = 60
    cache_key = get_cache_key(token)

    fxa_resp: IntrospectionResponse | IntrospectionError | None = None
    if use_cache:
        fxa_resp = load_introspection_result_from_cache(cache, cache_key)
    if fxa_resp is None:
        fxa_resp = introspect_token(token)

    # If the response is an error, raise an exception
    if isinstance(fxa_resp, IntrospectionError):
        if not fxa_resp.from_cache:
            fxa_resp.save_to_cache(cache, cache_key, default_cache_timeout)
        fxa_resp.raise_exception()

    if not fxa_resp.from_cache:
        cache_timeout = max(default_cache_timeout, fxa_resp.cache_timeout)
        fxa_resp.save_to_cache(cache, cache_key, cache_timeout)
    return fxa_resp


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

    def authenticate(
        self, request: Request
    ) -> None | tuple[User | AnonymousUser, IntrospectionResponse]:
        """
        Try to authenticate with a Accounts bearer token.

        If successful, it returns a tuple (user, token), which can be accessed at
        request.user and request.auth. If self.relay_user_required is False,
        this may be an AnonymousUser. Also, request.successful_authenticator will be
        an instance of this class.

        If it fails, it raises an APIException with a status code:
        * 503 Service Unavailable - The introspect API request failed, or had bad data
        * 401 Authentication Failed - The introspect API says the account is inactive
        * 403 Forbidden - The introspect API returns an active account, but the
          matching Relay user is required.

        If the authentication header is not an Accounts bearer token, it returns None
        to skip to the next authentication method.
        """
        method = request.method
        path = request.path
        self.use_cache = (method == "POST" and path == "/api/v1/relayaddresses/") or (
            method not in ("POST", "DELETE", "PUT")
        )

        # Validate the token header, call authentication_credentials
        return super().authenticate(request)

    def authenticate_credentials(
        self, key: str
    ) -> tuple[User | AnonymousUser, IntrospectionResponse]:
        """
        Authenticate the bearer token.

        This is called by DRF authentication framework's authenticate.
        """
        introspected_token = introspect_token_or_raise(key, self.use_cache)
        fxa_id = introspected_token.fxa_id
        try:
            sa = SocialAccount.objects.select_related("user").get(
                uid=fxa_id, provider="fxa"
            )
        except SocialAccount.DoesNotExist:
            if self.relay_user_required:
                raise PermissionDenied(
                    "Authenticated user does not have a Relay account."
                    " Have they accepted the terms?"
                )
            return (AnonymousUser(), introspected_token)
        user = sa.user
        if not user.is_active:
            raise PermissionDenied(
                "Authenticated user does not have an active Relay account."
                " Have they been deactivated?"
            )
        return (user, introspected_token)
