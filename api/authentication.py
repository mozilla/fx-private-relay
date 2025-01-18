from __future__ import annotations

import logging
import shlex
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any, Literal, NoReturn, NotRequired, TypedDict, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import BaseCache, cache

import requests
from allauth.socialaccount.models import SocialAccount
from codetiming import Timer
from markus.utils import generate_tag
from rest_framework.authentication import (
    BaseAuthentication,
    TokenAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
)
from rest_framework.request import Request

from emails.utils import histogram_if_enabled

logger = logging.getLogger("events")
INTROSPECT_TOKEN_URL = "{}/introspect".format(
    settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
)

# Specify the version strings in FXA_TOKEN_AUTH_VERSION
#
# The older version ("2024") works, but has a few issues.
# The cache key changes between Python instances, so little or no cache hits are used.
# Fetching a profile takes a few seconds, in which time another process can create a
# SocialAccount, leading to IntegrityError. Some of these are tracked in MPP-3505.
#
# The newer version ("2025") addresses these issues, works more like a standard DRF
# authentication class, expands the logged data, and tracks the time to call Accounts
# introspection and profile APIs. However, it is unproven, so we're using an
# environment variable to be able to try it in stage before production, and to
# revert with a config change only.
#
# The names are designed to be annoying so they will be removed. The old code has
# the suffix _2024 and the new code _2025 (when needed). When the new code is
# proven, the old code can be removed with minimal name changes.
#
# ruff thinks the strings "2024" and "2025" are passwords (check S105 / S106).
# These constants allow telling ruff to ignore them once.
FXA_TOKEN_AUTH_OLD_AND_PROVEN = "2024"  # noqa: S105
FXA_TOKEN_AUTH_NEW_AND_BUSTED = "2025"  # noqa: S105


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


def get_cache_key_2024(token):
    """note: hash() returns different results in different Python processes."""
    return hash(token)


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
        if "exp" in data and not isinstance(data["exp"], int):
            raise ValueError("exp (Expiration timestamp in milliseconds) should be int")

        self.token = token
        self.data: FxaIntrospectCompleteData = cast(FxaIntrospectCompleteData, data)
        self.from_cache = from_cache
        self.request_s = None if request_s is None else round(request_s, 3)

    def __repr__(self) -> str:
        params = [repr(self.token), repr(self.data)]
        if self.from_cache:
            params.append(f"from_cache={self.from_cache!r}")
        if self.request_s is not None:
            params.append(f"request_s={self.request_s!r}")
        return f"{self.__class__.__name__}({', '.join(params)})"

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
        return self.time_to_expire <= 0

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
    "TokenExpired",  # The token is expired according to our clock
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
        params = [repr(self.token), repr(self.error)]
        defaults: dict[str, Any] = {
            "error_args": [],
            "status_code": None,
            "data": None,
            "from_cache": False,
            "request_s": None,
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
        "TokenExpired": 401,
    }

    def raise_exception(self, method: str, path: str) -> NoReturn:
        if not self.from_cache and self.error in self._log_failure:
            logger.error(
                "accounts_introspection_failed",
                extra={
                    "error": self.error,
                    "error_args": [shlex.quote(arg) for arg in self.error_args],
                    "status_code": self.status_code,
                    "data": self.data,
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


def introspect_token_2024(token: str) -> dict[str, Any]:
    try:
        fxa_resp = requests.post(
            INTROSPECT_TOKEN_URL,
            json={"token": token},
            timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.error(
            "Could not introspect token with FXA.",
            extra={"error_cls": type(exc), "error": shlex.quote(str(exc))},
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


def get_fxa_uid_from_oauth_token_2024(token: str, use_cache: bool = True) -> str:
    # set a default cache_timeout, but this will be overridden to match
    # the 'exp' time in the JWT returned by FxA
    cache_timeout = 60
    cache_key = get_cache_key_2024(token)

    if not use_cache:
        fxa_resp_data = introspect_token_2024(token)
    else:
        # set a default fxa_resp_data, so any error during introspection
        # will still cache for at least cache_timeout to prevent an outage
        # from causing useless run-away repetitive introspection requests
        fxa_resp_data = {"status_code": None, "json": {}}
        try:
            cached_fxa_resp_data = cache.get(cache_key)

            if cached_fxa_resp_data:
                fxa_resp_data = cached_fxa_resp_data
            else:
                # no cached data, get new
                fxa_resp_data = introspect_token_2024(token)
        except AuthenticationFailed:
            raise
        finally:
            # Store potential valid response, errors, inactive users, etc. from FxA
            # for at least 60 seconds. Valid access_token cache extended after checking.
            cache.set(cache_key, fxa_resp_data, cache_timeout)

    if fxa_resp_data["status_code"] is None:
        raise APIException("Previous FXA call failed, wait to retry.")

    if not fxa_resp_data["status_code"] == 200:
        raise APIException("Did not receive a 200 response from FXA.")

    if not fxa_resp_data["json"].get("active"):
        raise AuthenticationFailed("FXA returned active: False for token.")

    # FxA user is active, check for the associated Relay account
    if (raw_fxa_uid := fxa_resp_data.get("json", {}).get("sub")) is None:
        raise NotFound("FXA did not return an FXA UID.")
    fxa_uid = str(raw_fxa_uid)

    # cache valid access_token and fxa_resp_data until access_token expiration
    # TODO: revisit this since the token can expire before its time
    if isinstance(fxa_resp_data.get("json", {}).get("exp"), int):
        # Note: FXA iat and exp are timestamps in *milliseconds*
        fxa_token_exp_time = int(fxa_resp_data["json"]["exp"] / 1000)
        now_time = int(datetime.now(UTC).timestamp())
        fxa_token_exp_cache_timeout = fxa_token_exp_time - now_time
        if fxa_token_exp_cache_timeout > cache_timeout:
            # cache until access_token expires (matched Relay user)
            # this handles cases where the token already expired
            cache_timeout = fxa_token_exp_cache_timeout
    cache.set(cache_key, fxa_resp_data, cache_timeout)

    return fxa_uid


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
            error_args=[fxa_resp.text],
            request_s=request_s,
        )
    if not isinstance(data, dict):
        return IntrospectionError(
            token,
            "NotJsonDict",
            status_code=status_code,
            error_args=[data],
            request_s=request_s,
        )

    fxa_data = cast(FxaIntrospectData, data)
    if status_code == 401:
        return IntrospectionError(
            token,
            "NotAuthorized",
            status_code=status_code,
            data=fxa_data,
            request_s=request_s,
        )
    if status_code != 200:
        return IntrospectionError(
            token, "NotOK", status_code=status_code, data=fxa_data, request_s=request_s
        )

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
    default_cache_timeout = 60

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

    if not fxa_resp.from_cache:
        cache_timeout = max(default_cache_timeout, fxa_resp.cache_timeout)
        fxa_resp.save_to_cache(cache, token, cache_timeout)
    return fxa_resp


class FxaTokenAuthentication(BaseAuthentication):
    """Pick 2024 or 2025 version based on settings"""

    _impl: FxaTokenAuthentication2024 | FxaTokenAuthentication2025

    def __init__(self) -> None:
        if settings.FXA_TOKEN_AUTH_VERSION == FXA_TOKEN_AUTH_NEW_AND_BUSTED:
            self._impl = FxaTokenAuthentication2025()
        else:
            self._impl = FxaTokenAuthentication2024()

    def authenticate_header(self, request: Request) -> Any | str | None:
        return self._impl.authenticate_header(request)

    def authenticate(
        self, request: Request
    ) -> None | tuple[User | AnonymousUser, IntrospectionResponse]:
        return self._impl.authenticate(request)


class FxaTokenAuthentication2024(BaseAuthentication):
    def authenticate_header(self, request):
        # Note: we need to implement this function to make DRF return a 401 status code
        # when we raise AuthenticationFailed, rather than a 403. See:
        # https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication
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

        use_cache = True
        method = request.method
        if method in ["POST", "DELETE", "PUT"]:
            use_cache = False
            if method == "POST" and request.path == "/api/v1/relayaddresses/":
                use_cache = True
        fxa_uid = get_fxa_uid_from_oauth_token_2024(token, use_cache)
        try:
            # MPP-3021: select_related user object to save DB query
            sa = SocialAccount.objects.filter(
                uid=fxa_uid, provider="fxa"
            ).select_related("user")[0]
        except IndexError:
            raise PermissionDenied(
                "Authenticated user does not have a Relay account."
                " Have they accepted the terms?"
            )
        user = sa.user

        if not user.is_active:
            raise PermissionDenied(
                "Authenticated user does not have an active Relay account."
                " Have they been deactivated?"
            )

        if user:
            return (user, token)
        else:
            raise NotFound()


class FxaTokenAuthentication2025(TokenAuthentication):
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
