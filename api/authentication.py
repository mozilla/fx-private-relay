from __future__ import annotations

import logging
import shlex
from base64 import b64encode
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any, Literal, NoReturn, TypedDict, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import BaseCache, cache

import requests
import sentry_sdk
from allauth.socialaccount.models import SocialAccount
from codetiming import Timer
from markus.utils import generate_tag
from rest_framework.authentication import BaseAuthentication, TokenAuthentication
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.request import Request

from emails.utils import histogram_if_enabled

from .authentication_2025 import FxaTokenAuthentication as FxaTokenAuthentication2025

logger = logging.getLogger("events")
INTROSPECT_TOKEN_URL = "{}/introspect".format(
    settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
)

# Specify the version strings in FXA_TOKEN_AUTH_VERSION
#
# The older version ("2025") works, but has a few issues.
# The cache key changes between Python instances, so little or no cache hits are used.
# Fetching a profile takes a few seconds, in which time another process can create a
# SocialAccount, leading to IntegrityError. Some of these are tracked in MPP-3505.
#
# The newer version ("2026") addresses these issues, works more like a standard DRF
# authentication class, expands the logged data, and tracks the time to call Accounts
# introspection and profile APIs. However, it is unproven, so we're using an
# environment variable to be able to try it in stage before production, and to
# revert with a config change only.
#
# The names are designed to be annoying so they will be removed. The old code has
# the suffix _2025 and the new code _2026 (when needed). When the new code is
# proven, the old code can be removed with minimal name changes.
#
# ruff thinks the strings "2025" and "2026" are passwords (check S105 / S106).
# These constants allow telling ruff to ignore them once.
FXA_TOKEN_AUTH_OLD_AND_PROVEN = "2025"  # noqa: S105
FXA_TOKEN_AUTH_NEW_AND_BUSTED = "2026"  # noqa: S105


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
    scope: str
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
    exp: int


def get_cache_key(token: str) -> str:
    return f"introspect_result:v1:{sha256(token.encode()).hexdigest()}"


class IntrospectionResponse:
    def __init__(
        self,
        token: str,
        data: FxaIntrospectData,
        from_cache: bool = False,
        request_s: float | None = None,
    ):
        # Check if this should have been an IntrospectionError
        if "active" not in data or data["active"] is not True:
            raise ValueError("active should be true")
        if "sub" not in data or not isinstance(data["sub"], str) or not data["sub"]:
            raise ValueError("sub (FxA ID) should be set")
        if "exp" not in data or not isinstance(data["exp"], int):
            raise ValueError("exp (Expiration timestamp in milliseconds) should be int")
        if settings.RELAY_SCOPE not in data.get("scope", "").split():
            raise ValueError(f"scope should include {settings.RELAY_SCOPE!r}")

        self.token = token
        self.data: FxaIntrospectCompleteData = cast(FxaIntrospectCompleteData, data)
        self.from_cache = from_cache
        self.request_s = None if request_s is None else round(request_s, 3)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}"
            f"(token={self.token!r},"
            f" data={self.data!r},"
            f" from_cache={self.from_cache!r},"
            f" request_s={self.request_s!r})"
        )

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, IntrospectionResponse):
            return (
                (self.token == other.token)
                and (self.data == other.data)
                and (self.from_cache == other.from_cache)
                and (self.request_s == other.request_s)
            )
        return False

    def as_cache_value(self) -> CachedFxaIntrospectResponse:
        return {
            "data": cast(FxaIntrospectData, self.data),
        }

    def save_to_cache(self, cache: BaseCache, token: str, timeout: int) -> None:
        cache.set(get_cache_key(token), self.as_cache_value(), timeout)

    @property
    def time_to_expire(self) -> int:
        """
        Return the expiration time in seconds from now for an introspected token.

        If `exp` is omitted, a value for about 1 year ago is returned.
        """
        if "exp" not in self.data:
            return -(365 * 24 * 60 * 60)
        # Note: FXA exp, other timestamps are milliseconds
        fxa_token_exp_time = int(self.data["exp"] / 1000)
        now_time = int(datetime.now(UTC).timestamp())
        return fxa_token_exp_time - now_time

    @property
    def cache_timeout(self) -> int:
        """
        Return the timeout in seconds from now for an introspected token.

        The minimum is 0, which signals to not cache.

        Typical expiration is 24 - 48 hours. The token could be revoked before
        the expiration time, so we may want an upper cache limit or to ensure
        the cache is skipped for some operations.
        """
        return max(0, self.time_to_expire)

    @property
    def is_expired(self) -> bool:
        return self.time_to_expire <= -(settings.FXA_TOKEN_EXPIRATION_GRACE_PERIOD)

    @property
    def fxa_id(self) -> str:
        return self.data["sub"]


INTROSPECT_ERROR = Literal[
    "Timeout",  # Introspection API took too long to respond
    "FailedRequest",  # Introspection API request failed
    "NotJson",  # Introspection API did not return JSON
    "NotJsonDict",  # Introspection API did not return a JSON dictionary
    "NotOK",  # Introspection API did not return a 200 or 401 response
    "NotAuthorized",  # Introspection API returned a 401 response
    "NotActive",  # The Accounts user is inactive
    "NoSubject",  # Introspection API did not return a "sub" field
    "MissingScope",  # The Accounts user does not have the relay scope
    "TokenExpired",  # The token is expired according to our clock
]


def as_b64(data: Any) -> str:
    """Return a potentially sensitive value as base64 encoded"""
    return "b64:" + b64encode(repr(data).encode()).decode()


class IntrospectionError:
    def __init__(
        self,
        token: str,
        error: INTROSPECT_ERROR,
        error_args: list[str] | None = None,
        status_code: int | None = None,
        data: FxaIntrospectData | None = None,
        from_cache: bool = False,
        request_s: float | None = None,
    ):
        self.token = token
        self.error = error
        self.error_args = error_args or []
        self.status_code = status_code
        self.data = data
        self.from_cache = from_cache
        self.request_s = None if request_s is None else round(request_s, 3)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}"
            f"(token={self.token!r},"
            f" error={self.error!r},"
            f" error_args={self.error_args!r},"
            f" status_code={self.status_code!r},"
            f" data={self.data!r},"
            f" from_cache={self.from_cache!r},"
            f" request_s={self.request_s!r})"
        )

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, IntrospectionError):
            return (
                (self.token == other.token)
                and (self.status_code == other.status_code)
                and (self.data == other.data)
                and (self.error == other.error)
                and (self.error_args == other.error_args)
                and (self.from_cache == other.from_cache)
                and (self.request_s == other.request_s)
            )
        return False

    _log_failure: set[INTROSPECT_ERROR] = {
        "Timeout",
        "FailedRequest",
        "NotJson",
        "NotJsonDict",
        "NotOK",
        "NoSubject",
        "TokenExpired",
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
        "MissingScope": 401,
        "TokenExpired": 401,
    }

    def raise_exception(self, method: str, path: str) -> NoReturn:
        if not self.from_cache and self.error in self._log_failure:
            logger.error(
                "accounts_introspection_failed",
                extra={
                    "error": self.error,
                    "error_args": [shlex.quote(str(arg)) for arg in self.error_args],
                    "status_code": self.status_code,
                    "data": as_b64(self.data),
                    "method": method,
                    "path": path,
                    "introspection_time_s": self.request_s,
                },
            )
        code = self._exception_code[self.error]
        if code == 401:
            raise IntrospectAuthenticationFailed(self)
        elif code == 503:
            raise IntrospectUnavailable(self)

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
    data_maybe = cached.get("data")
    if error := cached.get("error"):
        return IntrospectionError(
            token,
            error=error,
            status_code=cached.get("status_code"),
            data=data_maybe,
            error_args=cached.get("error_args"),
            from_cache=True,
        )
    response = IntrospectionResponse(token, data=data_maybe, from_cache=True)
    if response.is_expired:
        return IntrospectionError(
            token,
            "TokenExpired",
            error_args=[str(response.time_to_expire)],
            data=data_maybe,
            from_cache=True,
        )
    return response


def introspect_token(token: str) -> IntrospectionResponse | IntrospectionError:
    """
    Validate an Accounts OAuth token with the introspect API.

    If it is a valid token for an Accounts user, returns IntrospectionResponse.
    If there are any issues, returns IntrospectionError.

    See Firefox Ecosystem Platform docs:
    https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview/operation/postIntrospect
    """
    try:
        with Timer(logger=None) as request_timer:
            fxa_resp = requests.post(
                INTROSPECT_TOKEN_URL,
                json={"token": token},
                timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
            )
    except requests.Timeout:
        return IntrospectionError(token, "Timeout", request_s=request_timer.last)
    except Exception as exc:
        error_args = [exc.__class__.__name__]
        error_args.extend(exc.args)
        return IntrospectionError(
            token, "FailedRequest", error_args=error_args, request_s=request_timer.last
        )

    status_code = fxa_resp.status_code
    request_s = request_timer.last
    try:
        data = fxa_resp.json()
    except requests.exceptions.JSONDecodeError:
        return IntrospectionError(
            token,
            "NotJson",
            status_code=status_code,
            error_args=[as_b64(fxa_resp.text)],
            request_s=request_s,
        )
    if not isinstance(data, dict):
        return IntrospectionError(
            token,
            "NotJsonDict",
            status_code=status_code,
            error_args=[as_b64(data)],
            request_s=request_s,
        )

    if status_code == 401:
        return IntrospectionError(
            token,
            "NotAuthorized",
            error_args=[as_b64(data)],
            status_code=status_code,
            request_s=request_s,
        )
    with sentry_sdk.new_scope():
        sentry_sdk.set_context(
            "introspect_token", {"status_code": status_code, "data": data}
        )
        fxa_data = cast(FxaIntrospectData, data)

        if status_code != 200:
            # Log but attempt to continue
            sentry_sdk.capture_message(
                f"FxA token introspect returned {status_code}, expected 200"
            )
            # Old version - log, raise 503
            # return IntrospectionError(
            #     token,
            #     "NotOK",
            #     status_code=status_code,
            #     data=fxa_data,
            #     request_s=request_s,
            # )

        if data.get("active", False) is not True:
            return IntrospectionError(
                token,
                "NotActive",
                status_code=status_code,
                data=fxa_data,
                request_s=request_s,
            )

        if not isinstance(sub := data.get("sub", None), str) or not sub:
            return IntrospectionError(
                token,
                "NoSubject",
                status_code=status_code,
                data=fxa_data,
                request_s=request_s,
            )

        if not isinstance(data.get("exp", None), int):
            sentry_sdk.capture_message("exp is not int")
            future = datetime.now() + timedelta(
                seconds=settings.FXA_TOKEN_EXPIRATION_GRACE_PERIOD
            )
            fxa_data["exp"] = int(future.timestamp()) * 1000

        scopes = data.get("scope", "").split()
        if settings.RELAY_SCOPE not in scopes:
            return IntrospectionError(
                token,
                "MissingScope",
                status_code=status_code,
                data=fxa_data,
                request_s=request_s,
            )

        response = IntrospectionResponse(token, data=fxa_data, request_s=request_s)
        if response.is_expired:
            return IntrospectionError(
                token,
                "TokenExpired",
                error_args=[str(response.time_to_expire)],
                data=fxa_data,
                request_s=request_s,
            )
    return response


def introspect_and_cache_token(
    token: str, read_from_cache: bool = True
) -> IntrospectionResponse | IntrospectionError:
    """
    Introspect a Mozilla account OAuth token, to get data like the FxA UID.

    If anything goes wrong, raise an exception.
    """
    default_cache_timeout = settings.FXA_TOKEN_EXPIRATION_GRACE_PERIOD

    # Get a cached or live introspection response
    fxa_resp: IntrospectionResponse | IntrospectionError | None = None
    if read_from_cache:
        fxa_resp = load_introspection_result_from_cache(cache, token)
    if fxa_resp is None:
        fxa_resp = introspect_token(token)

    # If the response is an error, raise an exception
    if isinstance(fxa_resp, IntrospectionError):
        if not fxa_resp.from_cache:
            fxa_resp.save_to_cache(cache, token, default_cache_timeout)
        return fxa_resp

    # Save a live introspection response to the cache
    if not fxa_resp.from_cache:
        cache_timeout = max(default_cache_timeout, fxa_resp.cache_timeout)
        fxa_resp.save_to_cache(cache, token, cache_timeout)
    return fxa_resp


class FxaTokenAuthentication(BaseAuthentication):
    """Pick 2025 or 2026 version based on settings"""

    _impl: FxaTokenAuthentication2025 | FxaTokenAuthentication2026

    def __init__(self) -> None:
        if settings.FXA_TOKEN_AUTH_VERSION == FXA_TOKEN_AUTH_NEW_AND_BUSTED:
            self._impl = FxaTokenAuthentication2026()
        else:
            self._impl = FxaTokenAuthentication2025()

    def authenticate_header(self, request: Request) -> Any | str | None:
        return self._impl.authenticate_header(request)

    def authenticate(
        self, request: Request
    ) -> None | tuple[User | AnonymousUser, IntrospectionResponse]:
        return self._impl.authenticate(request)


class FxaTokenAuthentication2026(TokenAuthentication):
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
        self.method = request.method or "unknown"
        self.path = request.path
        # Validate the token header, call authentication_credentials
        return super().authenticate(request)

    def authenticate_credentials(
        self, key: str
    ) -> tuple[User | AnonymousUser, IntrospectionResponse]:
        """
        Authenticate the bearer token.

        This is called by DRF authentication framework's authenticate.
        """
        read_from_cache = True
        if self.method in {"POST", "DELETE", "PUT"}:
            # Require token re-inspection for methods that change content...
            read_from_cache = False
            if self.method == "POST" and self.path == "/api/v1/relayaddresses/":
                # ... except for creating a new random address (MPP-3156)
                read_from_cache = True

        introspection_result = introspect_and_cache_token(key, read_from_cache)
        if introspection_result.request_s is not None:
            if isinstance(introspection_result, IntrospectionResponse):
                result = "OK"
            else:
                result = introspection_result.error
            histogram_if_enabled(
                name="accounts_introspection_ms",
                value=int(introspection_result.request_s * 1000),
                tags=[
                    generate_tag("result", result),
                    generate_tag("method", self.method),
                    generate_tag("path", self.path),
                ],
            )

        if isinstance(introspection_result, IntrospectionError):
            introspection_result.raise_exception(self.method, self.path)

        fxa_id = introspection_result.fxa_id
        try:
            sa = SocialAccount.objects.select_related("user").get(
                uid=fxa_id, provider="fxa"
            )
        except SocialAccount.DoesNotExist:
            return (AnonymousUser(), introspection_result)
        return (sa.user, introspection_result)
