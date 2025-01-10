from __future__ import annotations

import logging
import shlex
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any, Literal, NoReturn, NotRequired, TypedDict, assert_never, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import BaseCache, cache

import requests
from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
)
from rest_framework.request import Request

logger = logging.getLogger("events")
INTROSPECT_TOKEN_URL = "{}/introspect".format(
    settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
)


class CachedFxaIntrospectResponse(TypedDict, total=False):
    """The data stored in the cache to avoid multiple introspection requests."""

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
    present but unused. See Firefox Ecosystem Platform docs:

    https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview/operation/postIntrospect
    """

    active: bool
    sub: str
    exp: NotRequired[int]


def get_cache_key(token: str) -> str:
    return f"introspect_result:v1:{sha256(token.encode()).hexdigest()}"


class IntrospectionResponse:
    def __init__(
        self,
        token: str,
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

        self.token = token
        self.data: FxaIntrospectCompleteData = cast(FxaIntrospectCompleteData, data)
        self.from_cache = from_cache

    def __repr__(self) -> str:
        params = [repr(self.token), repr(self.data)]
        if self.from_cache:
            params.append(f"from_cache={self.from_cache!r}")
        return f"{self.__class__.__name__}({', '.join(params)})"

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, IntrospectionResponse):
            return (
                (self.token == other.token)
                and (self.data == other.data)
                and (self.from_cache == other.from_cache)
            )
        return False

    def as_cache_value(self) -> CachedFxaIntrospectResponse:
        return {
            "data": cast(FxaIntrospectData, self.data),
        }

    def save_to_cache(self, cache: BaseCache, token: str, timeout: int) -> None:
        cache.set(get_cache_key(token), self.as_cache_value(), timeout)

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
        token: str,
        error: INTROSPECT_ERROR,
        error_args: list[str] | None = None,
        status_code: int | None = None,
        data: FxaIntrospectData | None = None,
        from_cache: bool = False,
    ):
        self.token = token
        self.error = error
        self.error_args = error_args or []
        self.from_cache = from_cache
        self.status_code = status_code
        self.data = data

    def __repr__(self) -> str:
        params = [repr(self.token), repr(self.error)]
        defaults: dict[str, Any] = {
            "error_args": [],
            "status_code": None,
            "data": None,
            "from_cache": False,
        }
        for name, default in defaults.items():
            if (val := getattr(self, name)) != default:
                params.append(f"{name}={val!r}")
        return f"{self.__class__.__name__}({', '.join(params)})"

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, IntrospectionError):
            return (
                (self.token == other.token)
                and (self.status_code == other.status_code)
                and (self.data == other.data)
                and (self.error == other.error)
                and (self.error_args == other.error_args)
                and (self.from_cache == other.from_cache)
            )
        return False

    _log_failure: set[INTROSPECT_ERROR] = {
        "Timeout",
        "FailedRequest",
        "NotJson",
        "NotJsonDict",
        "NotOK",
        "NoSubject",
    }

    _exception_code: dict[INTROSPECT_ERROR, Literal[401, 503]] = {
        "Timeout": 503,
        "FailedRequest": 503,
        "NotJson": 503,
        "NotJsonDict": 503,
        "NotOK": 503,
        "NotAuthorized": 401,
        "NotActive": 401,
        "NoSubject": 503,
    }

    def raise_exception(self) -> NoReturn:
        if not self.from_cache and self.error in self._log_failure:
            logger.error(
                "accounts_introspection_failed",
                extra={
                    "error": self.error,
                    "error_args": [shlex.quote(arg) for arg in self.error_args],
                    "status_code": self.status_code,
                    "data": self.data,
                },
            )
        code = self._exception_code[self.error]
        if code == 401:
            raise IntrospectAuthenticationFailed(self)
        elif code == 503:
            raise IntrospectUnavailable(self)
        assert_never(code)

    def as_cache_value(self) -> CachedFxaIntrospectResponse:
        cached: CachedFxaIntrospectResponse = {"error": self.error}
        if self.status_code:
            cached["status_code"] = self.status_code
        if self.data:
            cached["data"] = self.data
        if self.error_args:
            cached["error_args"] = self.error_args
        return cached

    def save_to_cache(self, cache: BaseCache, token: str, timeout: int) -> None:
        cache.set(get_cache_key(token), self.as_cache_value(), timeout)


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
    cache: BaseCache, token: str
) -> IntrospectionResponse | IntrospectionError | None:
    cache_key = get_cache_key(token)
    cached = cache.get(cache_key)
    if cached is None or not isinstance(cached, dict):
        return None
    if error := cached.get("error"):
        return IntrospectionError(
            token,
            error=error,
            status_code=cached.get("status_code"),
            data=cached.get("data"),
            error_args=cached.get("error_args"),
            from_cache=True,
        )
    return IntrospectionResponse(token, data=cached.get("data"), from_cache=True)


def introspect_token(token: str) -> IntrospectionResponse | IntrospectionError:
    """
    Validate an Accounts OAuth token with the introspect API.

    If it is a valid token for an Accounts user, returns IntrospectionResponse.
    If there are any issues, returns IntrospectionError.

    See Firefox Ecosystem Platform docs:
    https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview/operation/postIntrospect
    """
    try:
        fxa_resp = requests.post(
            INTROSPECT_TOKEN_URL,
            json={"token": token},
            timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        return IntrospectionError(token, "Timeout")
    except Exception as exc:
        error_args = [exc.__class__.__name__]
        error_args.extend(exc.args)
        return IntrospectionError(token, "FailedRequest", error_args=error_args)

    status_code = fxa_resp.status_code
    try:
        data = fxa_resp.json()
    except requests.exceptions.JSONDecodeError:
        return IntrospectionError(
            token, "NotJson", status_code=status_code, error_args=[fxa_resp.text]
        )
    if not isinstance(data, dict):
        return IntrospectionError(
            token, "NotJsonDict", status_code=status_code, error_args=[data]
        )

    fxa_data = cast(FxaIntrospectData, data)
    if status_code == 401:
        return IntrospectionError(
            token, "NotAuthorized", status_code=status_code, data=fxa_data
        )
    if status_code != 200:
        return IntrospectionError(
            token, "NotOK", status_code=status_code, data=fxa_data
        )

    if data.get("active", False) is not True:
        return IntrospectionError(
            token, "NotActive", status_code=status_code, data=fxa_data
        )

    if not isinstance(sub := data.get("sub", None), str) or not sub:
        return IntrospectionError(
            token, "NoSubject", status_code=status_code, data=fxa_data
        )

    return IntrospectionResponse(token, data=cast(FxaIntrospectData, data))


def introspect_token_or_raise(
    token: str, use_cache: bool = True
) -> IntrospectionResponse:
    """
    Introspect a Mozilla account OAuth token, to get data like the FxA UID.

    If anything goes wrong, raise an exception.
    """
    default_cache_timeout = 60

    fxa_resp: IntrospectionResponse | IntrospectionError | None = None
    if use_cache:
        fxa_resp = load_introspection_result_from_cache(cache, token)
    if fxa_resp is None:
        fxa_resp = introspect_token(token)

    # If the response is an error, raise an exception
    if isinstance(fxa_resp, IntrospectionError):
        if not fxa_resp.from_cache:
            fxa_resp.save_to_cache(cache, token, default_cache_timeout)
        fxa_resp.raise_exception()

    if not fxa_resp.from_cache:
        cache_timeout = max(default_cache_timeout, fxa_resp.cache_timeout)
        fxa_resp.save_to_cache(cache, token, cache_timeout)
    return fxa_resp


class FxaTokenAuthentication(TokenAuthentication):
    """
    Implement authentication with a Mozilla Account bearer token.

    This is passed by Firefox for the Accounts user. Unlike DRF's
    TokenAuthentication, this is not generated by Relay. Instead, it
    needs to be validated by Mozilla Accounts to get the FxA ID.
    """

    keyword = "Bearer"

    def authenticate(
        self, request: Request
    ) -> None | tuple[User | AnonymousUser, IntrospectionResponse]:
        """
        Try to authenticate with a Accounts bearer token.

        If successful, it returns a tuple (user, token), which can be accessed at
        request.user and request.auth. If there is a not a matching Relay user, then
        the user is an AnonymousUser. Also, request.successful_authenticator will be
        an instance of this class.

        If it fails, it raises an APIException with a status code:
        * 503 Service Unavailable - The introspect API request failed, or had bad data
        * 401 Authentication Failed - The introspect API says the account is inactive,
          or the token is invalid.

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
            return (AnonymousUser(), introspected_token)
        return (sa.user, introspected_token)
