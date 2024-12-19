import re
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import Mock, patch

from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import BaseCache

import pytest
import responses
from allauth.socialaccount.models import SocialAccount, SocialApp
from requests import ReadTimeout
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.test import APIRequestFactory

from ..authentication import (
    INTROSPECT_ERROR,
    INTROSPECT_TOKEN_URL,
    FxaIntrospectData,
    FxaTokenAuthentication,
    FxaTokenAuthenticationRelayUserOptional,
    IntrospectAuthenticationFailed,
    IntrospectionError,
    IntrospectionResponse,
    IntrospectUnavailable,
    get_cache_key,
    introspect_token,
    introspect_token_or_raise,
    load_introspection_result_from_cache,
)


def _create_fxa_introspect_response(
    active: bool = True,
    uid: str | None = "an-fxa-id",
    expiration: bool = True,
    error: str | None = None,
) -> FxaIntrospectData:
    """Create a Mozilla Accounts introspection response"""
    if error:
        return {"error": error}
    data: FxaIntrospectData = {"active": active}
    if uid:
        data["sub"] = uid
    if expiration:
        now_time = int(datetime.now().timestamp())
        exp_ms = (now_time + 60 * 60) * 1000  # Time in milliseconds
        data["exp"] = exp_ms
    return data


def _mock_fxa_introspect_response(
    status_code: int = 200,
    data: FxaIntrospectData | str | None = None,
    timeout: bool = False,
    exception: Exception | None = None,
) -> responses.BaseResponse:
    """Mock the response to a Mozilla Accounts introspection request"""
    if timeout:
        return responses.add(
            responses.POST, INTROSPECT_TOKEN_URL, body=ReadTimeout("FxA is slow today")
        )
    if exception:
        return responses.add(responses.POST, INTROSPECT_TOKEN_URL, body=exception)
    return responses.add(
        responses.POST,
        INTROSPECT_TOKEN_URL,
        status=status_code,
        json=data,
    )


def setup_fxa_introspect(
    status_code: int = 200,
    no_body: bool = False,
    text_body: str | None = None,
    active: bool = True,
    uid: str | None = "an-fxa-id",
    expiration: bool = True,
    error: str | None = None,
    timeout: bool = False,
    exception: Exception | None = None,
) -> tuple[responses.BaseResponse, FxaIntrospectData | None]:
    """
    Mock a Mozilla Accounts introspection response. Return both the
    request-level response mock (to check how often the request was made)
    and the mocked response body.
    """
    data: FxaIntrospectData | None = None
    if no_body:
        mock_response = _mock_fxa_introspect_response(status_code)
    elif text_body:
        mock_response = _mock_fxa_introspect_response(status_code, text_body)
    elif timeout:
        mock_response = _mock_fxa_introspect_response(timeout=True)
    elif exception:
        mock_response = _mock_fxa_introspect_response(exception=exception)
    else:
        data = _create_fxa_introspect_response(
            active=active, uid=uid, expiration=expiration, error=error
        )
        mock_response = _mock_fxa_introspect_response(status_code, data)
    return mock_response, data


_INTROSPECTION_RESPONSE_TEST_CASES = {
    "active_missing": ({}, "active should be true"),
    "active_false": ({"active": False}, "active should be true"),
    "sub_missing": ({"active": True}, "sub (FxA ID) should be set"),
    "sub_not_str": ({"active": True, "sub": 1}, "sub (FxA ID) should be set"),
    "sub_empty": ({"active": True, "sub": ""}, "sub (FxA ID) should be set"),
    "exp_not_int": (
        {"active": True, "sub": "s", "exp": "123"},
        "exp (Expiration timestamp in milliseconds) should be int",
    ),
}


@pytest.mark.parametrize(
    "data,message",
    _INTROSPECTION_RESPONSE_TEST_CASES.values(),
    ids=_INTROSPECTION_RESPONSE_TEST_CASES.keys(),
)
def test_introspection_response_init_bad_data_raises_value_error(
    data: FxaIntrospectData, message: str
) -> None:
    with pytest.raises(ValueError, match=re.escape(message)):
        IntrospectionResponse(data)


def test_introspection_response_with_expiration():
    expiration = int((datetime.now(UTC) + timedelta(seconds=60)).timestamp()) * 1000
    data: FxaIntrospectData = {"active": True, "sub": "an-fxa-id", "exp": expiration}
    response = IntrospectionResponse(data)
    assert repr(response) == (
        "IntrospectionResponse({'active': True, 'sub': 'an-fxa-id', 'exp': "
        + str(expiration)
        + "})"
    )
    assert 50 < response.cache_timeout <= 60  # about 60 seconds


def test_introspection_response_without_expiration():
    data: FxaIntrospectData = {"active": True, "sub": "other-fxa-id"}
    response = IntrospectionResponse(data)
    assert repr(response) == (
        "IntrospectionResponse({'active': True, 'sub': 'other-fxa-id'})"
    )
    assert response.cache_timeout == 0


def test_introspection_response_repr_with_from_cache():
    data: FxaIntrospectData = {"active": True, "sub": "other-fxa-id", "exp": 100}
    response = IntrospectionResponse(data, from_cache=True)
    assert repr(response) == (
        "IntrospectionResponse("
        "{'active': True, 'sub': 'other-fxa-id', 'exp': 100}"
        ", from_cache=True)"
    )


def test_introspection_response_fxa_id():
    response = IntrospectionResponse({"active": True, "sub": "the-fxa-id"})
    assert response.fxa_id == "the-fxa-id"


def test_introspection_response_equality():
    data: FxaIntrospectData = {"active": True, "sub": "some-fxa-id"}
    response = IntrospectionResponse(data)
    assert response == IntrospectionResponse(data)
    assert response != IntrospectionError("NotJson", data=data)
    assert response != IntrospectionResponse(data, from_cache=True)
    assert response != IntrospectionResponse({"active": True, "sub": "other-fxa-id"})


def test_introspection_response_save_to_cache():
    response = IntrospectionResponse({"active": True, "sub": "old-fxa-id"})
    mock_cache = Mock(spec_set=["set"])
    response.save_to_cache(mock_cache, "the-key", 60)
    mock_cache.set.assert_called_once_with(
        get_cache_key("the-key"), {"data": {"active": True, "sub": "old-fxa-id"}}, 60
    )


def test_introspection_response_save_to_cache_from_cache_dropped():
    response = IntrospectionResponse(
        {"active": True, "sub": "some-fxa-id"}, from_cache=True
    )
    mock_cache = Mock(spec_set=["set"])
    response.save_to_cache(mock_cache, "the-key", 60)
    mock_cache.set.assert_called_once_with(
        get_cache_key("the-key"), {"data": {"active": True, "sub": "some-fxa-id"}}, 60
    )


_INTROSPECTION_ERROR_REPR_TEST_CASES: list[
    tuple[INTROSPECT_ERROR, dict[str, Any], str]
] = [
    ("Timeout", {}, "IntrospectionError('Timeout')"),
    (
        "FailedRequest",
        {"error_args": ["requests.ConnectionError", "Accounts Rebooting"]},
        (
            "IntrospectionError('FailedRequest',"
            " error_args=['requests.ConnectionError', 'Accounts Rebooting'])"
        ),
    ),
    (
        "NotJson",
        {"error_args": [""], "status_code": 200},
        "IntrospectionError('NotJson', error_args=[''], status_code=200)",
    ),
    (
        "NotAuthorized",
        {"status_code": 401},
        "IntrospectionError('NotAuthorized', status_code=401)",
    ),
    (
        "NotActive",
        {"status_code": 200, "data": {"active": False}, "from_cache": True},
        (
            "IntrospectionError('NotActive', status_code=200, data={'active': False},"
            " from_cache=True)"
        ),
    ),
]


@pytest.mark.parametrize(
    "error,params,expected",
    _INTROSPECTION_ERROR_REPR_TEST_CASES,
    ids=[case[0] for case in _INTROSPECTION_ERROR_REPR_TEST_CASES],
)
def test_introspection_error_repr(
    error: INTROSPECT_ERROR, params: dict[str, Any], expected: str
) -> None:
    introspect_error = IntrospectionError(error, **params)
    assert repr(introspect_error) == expected


def test_introspection_error_save_to_cache_no_optional_params() -> None:
    error = IntrospectionError("Timeout")
    mock_cache = Mock(spec_set=["set"])
    error.save_to_cache(mock_cache, "cache-key", 60)
    mock_cache.set.assert_called_once_with(
        get_cache_key("cache-key"), {"error": "Timeout"}, 60
    )


def test_introspection_error_save_to_cache_all_optional_params() -> None:
    error = IntrospectionError(
        "NotOK",
        error_args=["something"],
        status_code=401,
        data={"error": "crazy stuff"},
        from_cache=True,
    )
    mock_cache = Mock(spec_set=["set"])
    error.save_to_cache(mock_cache, "cache-key", 60)
    mock_cache.set.assert_called_once_with(
        get_cache_key("cache-key"),
        {
            "error": "NotOK",
            "status_code": 401,
            "data": {"error": "crazy stuff"},
            "error_args": ["something"],
        },
        60,
    )


def test_introspection_error_eq() -> None:
    err = IntrospectionError("NotActive")
    assert err == IntrospectionError("NotActive")
    assert err != IntrospectionError("NotActive", status_code=200)
    assert err != IntrospectionError("NotActive", data={})
    assert err != IntrospectionError("NotActive", error_args=["an arg"])
    assert err != IntrospectionError("NotActive", from_cache=True)
    assert err != IntrospectAuthenticationFailed(err)


def test_introspection_error_raises_exception_401() -> None:
    error = IntrospectionError("NotActive", status_code=401, data={"active": False})
    with pytest.raises(IntrospectAuthenticationFailed) as exc_info:
        error.raise_exception()
    exception = exc_info.value
    assert exception.status_code == 401
    assert str(exception.detail) == "Incorrect authentication credentials."
    assert exception.args == (error,)


def test_introspection_error_raises_exception_503() -> None:
    error = IntrospectionError("Timeout")
    with pytest.raises(IntrospectUnavailable) as exc_info:
        error.raise_exception()
    exception = exc_info.value
    assert exception.status_code == 503
    expected_detail = "Introspection temporarily unavailable, try again later."
    assert str(exception.detail) == expected_detail
    assert exception.args == (error,)


@responses.activate
def test_introspect_token_success_returns_introspection_response():
    mock_response, fxa_data = setup_fxa_introspect()
    assert fxa_data is not None

    fxa_resp = introspect_token("the-token")
    assert fxa_resp == IntrospectionResponse(fxa_data)
    assert mock_response.call_count == 1


@responses.activate
def test_introspect_token_no_expiration_returns_introspection_response():
    mock_response, fxa_data = setup_fxa_introspect(expiration=False)
    assert fxa_data is not None

    fxa_resp = introspect_token("the-token")
    assert isinstance(fxa_resp, IntrospectionResponse)
    assert fxa_resp == IntrospectionResponse(fxa_data)
    assert fxa_resp.cache_timeout == 0
    assert mock_response.call_count == 1


# Test cases for introspect_token() that return an IntrospectionError
# Tuple is:
# - arguments to setup_fxa_introspect
# - the IntrospectionError error
# - other keyword parameters to IntrospectionError.
#   The special keyword parameter {"data": _SETUP_FXA_DATA} means to use
#   the mocked FxA Introspect body.
_SETUP_FXA_DATA = object()
_INTROSPECT_TOKEN_FAILURE_TEST_CASES: list[
    tuple[dict[str, Any], INTROSPECT_ERROR, dict[str, Any]]
] = [
    ({"timeout": True}, "Timeout", {}),
    (
        {"exception": Exception("An Exception")},
        "FailedRequest",
        {"error_args": ["Exception", "An Exception"]},
    ),
    ({"no_body": True}, "NotJson", {"status_code": 200, "error_args": [""]}),
    (
        {"text_body": '[{"active": false}]'},
        "NotJsonDict",
        {"status_code": 200, "error_args": ['[{"active": false}]']},
    ),
    (
        {"status_code": 401, "active": False},
        "NotAuthorized",
        {"status_code": 401, "data": _SETUP_FXA_DATA},
    ),
    ({"status_code": 500}, "NotOK", {"status_code": 500, "data": _SETUP_FXA_DATA}),
    ({"active": False}, "NotActive", {"status_code": 200, "data": _SETUP_FXA_DATA}),
    ({"uid": None}, "NoSubject", {"status_code": 200, "data": _SETUP_FXA_DATA}),
]


@pytest.mark.parametrize(
    "setup_args,error,error_params",
    _INTROSPECT_TOKEN_FAILURE_TEST_CASES,
    ids=[case[1] for case in _INTROSPECT_TOKEN_FAILURE_TEST_CASES],
)
@responses.activate
def test_introspect_token_error_returns_introspection_error(
    setup_args, error, error_params
):
    mock_response, fxa_data = setup_fxa_introspect(**setup_args)
    params = error_params.copy()
    if error_params.get("data") is _SETUP_FXA_DATA:
        assert fxa_data is not None
        params["data"] = fxa_data
    expected_resp = IntrospectionError(error, **params)

    fxa_resp = introspect_token("err-token")
    assert fxa_resp == expected_resp
    assert mock_response.call_count == 1


def test_load_introspection_result_from_cache_introspection_response() -> None:
    fxa_data: FxaIntrospectData = {"active": True, "sub": "fxa_id"}
    cache = Mock(spec_set=["get"])
    cache.get.return_value = {"data": fxa_data}

    response = load_introspection_result_from_cache(cache, "cache_key")
    assert isinstance(response, IntrospectionResponse)
    assert response == IntrospectionResponse(fxa_data, from_cache=True)
    cache.get.assert_called_once_with(get_cache_key("cache_key"))


def test_load_introspection_result_from_cache_introspection_error_no_args() -> None:
    cache = Mock(spec_set=["get"])
    cache.get.return_value = {"error": "Timeout"}

    error = load_introspection_result_from_cache(cache, "cache_key")
    assert isinstance(error, IntrospectionError)
    assert error == IntrospectionError("Timeout", from_cache=True)
    cache.get.assert_called_once_with(get_cache_key("cache_key"))


def test_load_introspection_result_from_cache_introspection_error_all_args() -> None:
    cache = Mock(spec_set=["get"])
    cache.get.return_value = {
        "error": "NotOK",
        "status_code": 401,
        "data": {"error": "crazy stuff"},
        "error_args": ["something"],
    }

    error = load_introspection_result_from_cache(cache, "cache_key")
    assert isinstance(error, IntrospectionError)
    assert error == IntrospectionError(
        "NotOK",
        error_args=["something"],
        status_code=401,
        data={"error": "crazy stuff"},
        from_cache=True,
    )
    cache.get.assert_called_once_with(get_cache_key("cache_key"))


def test_load_introspection_result_from_cache_introspection_bad_value() -> None:
    cache = Mock(spec_set=["get"])
    cache.get.return_value = "Not a dictionary"

    assert load_introspection_result_from_cache(cache, "cache_key") is None
    cache.get.assert_called_once_with(get_cache_key("cache_key"))


@responses.activate
def test_introspect_token_or_raise_mocked_success_is_cached(cache: BaseCache) -> None:
    user_token = "user-123"
    cache_key = get_cache_key(user_token)
    fxa_id = "fxa-id-for-user-123"
    mock_response, fxa_data = setup_fxa_introspect(uid=fxa_id)
    assert fxa_data is not None
    assert cache.get(cache_key) is None

    # get FxA ID for the first time
    fxa_resp = introspect_token_or_raise(user_token)
    assert fxa_resp.fxa_id == fxa_id
    assert not fxa_resp.from_cache
    assert mock_response.call_count == 1
    assert cache.get(cache_key) == {"data": fxa_data}

    # now check that the 2nd call did NOT make another fxa request
    fxa_resp2 = introspect_token_or_raise(user_token)
    assert fxa_resp2.from_cache
    assert mock_response.call_count == 1


@responses.activate
def test_introspect_token_or_raise_mocked_success_with_use_cache_false(
    cache: BaseCache,
) -> None:
    user_token = "user-123"
    cache_key = get_cache_key(user_token)
    fxa_id = "fxa-id-for-user-123"
    mock_response, fxa_data = setup_fxa_introspect(uid=fxa_id)
    assert fxa_data is not None
    cache.set(cache_key, "An invalid cache value that is not read")

    # skip cache, call introspect API, set cache to new data
    fxa_resp = introspect_token_or_raise(user_token, use_cache=False)
    assert fxa_resp.fxa_id == fxa_id
    assert not fxa_resp.from_cache
    assert mock_response.call_count == 1
    assert cache.get(cache_key) == {"data": fxa_data}


@responses.activate
def test_introspect_token_or_raise_mocked_error_is_cached(cache: BaseCache) -> None:
    user_token = "user-123"
    cache_key = get_cache_key(user_token)
    mock_response, fxa_data = setup_fxa_introspect(timeout=True)
    assert fxa_data is None
    assert cache.get(cache_key) is None

    # Timeout for the first time
    with pytest.raises(IntrospectUnavailable):
        introspect_token_or_raise(user_token)
    assert mock_response.call_count == 1
    assert cache.get(cache_key) == {"error": "Timeout"}

    # now check that the 2nd call did NOT make another fxa request
    with pytest.raises(IntrospectUnavailable):
        introspect_token_or_raise(user_token)
    assert mock_response.call_count == 1


def test_fxa_token_authentication_no_auth_header_skips() -> None:
    req = APIRequestFactory().get("/api/endpoint")
    assert FxaTokenAuthentication().authenticate(req) is None


def test_fxa_token_authentication_not_bearer_token_auth_header_skips() -> None:
    headers = {"Authorization": "unexpected 123"}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    assert FxaTokenAuthentication().authenticate(req) is None


def test_fxa_token_authentication_incomplete_bearer_token_raises_auth_fail() -> None:
    headers = {"Authorization": "Bearer "}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    with pytest.raises(
        AuthenticationFailed, match=r"Invalid token header\. No credentials provided\."
    ):
        FxaTokenAuthentication().authenticate(req)


@responses.activate
def test_fxa_token_authentication_known_relay_user_returns_user(
    free_user: User,
    fxa_social_app: SocialApp,
    cache: BaseCache,
) -> None:
    fxa_id = "some-fxa-id"
    SocialAccount.objects.create(provider="fxa", uid=fxa_id, user=free_user)
    mock_response, fxa_data = setup_fxa_introspect(uid=fxa_id)
    assert fxa_data is not None
    headers = {"Authorization": "Bearer bearer-token"}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    assert FxaTokenAuthentication().authenticate(req) == (
        free_user,
        IntrospectionResponse(fxa_data),
    )
    assert cache.get(get_cache_key("bearer-token")) == {"data": fxa_data}


@responses.activate
def test_fxa_token_authentication_unknown_token_raises_auth_fail(
    cache: BaseCache,
) -> None:
    mock_response, fxa_data = setup_fxa_introspect(status_code=401, active=False)
    assert fxa_data is not None
    headers = {"Authorization": "Bearer bearer-token"}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    with pytest.raises(
        AuthenticationFailed, match=r"Incorrect authentication credentials\."
    ):
        FxaTokenAuthentication().authenticate(req)
    assert cache.get(get_cache_key("bearer-token"))["error"] == "NotAuthorized"


@responses.activate
@pytest.mark.django_db
def test_fxa_token_authentication_not_yet_relay_user_raises_perm_denied(
    cache: BaseCache,
) -> None:
    """TODO: Should this be an IsActive or other permission check?"""
    mock_response, fxa_data = setup_fxa_introspect()
    assert fxa_data is not None
    headers = {"Authorization": "Bearer bearer-token"}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    with pytest.raises(
        PermissionDenied,
        match=(
            r"Authenticated user does not have a Relay account\."
            r" Have they accepted the terms\?"
        ),
    ):
        FxaTokenAuthentication().authenticate(req)
    assert cache.get(get_cache_key("bearer-token")) == {"data": fxa_data}


@responses.activate
def test_fxa_token_authentication_inactive_relay_user_raises_perm_denied(
    free_user: User,
    fxa_social_app: SocialApp,
    cache: BaseCache,
) -> None:
    """TODO: Should this be an IsActive or other permission check?"""
    free_user.is_active = False
    free_user.save()
    fxa_id = "some-fxa-id"
    SocialAccount.objects.create(provider="fxa", uid=fxa_id, user=free_user)
    mock_response, fxa_data = setup_fxa_introspect(uid=fxa_id)
    assert fxa_data is not None
    headers = {"Authorization": "Bearer bearer-token"}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    with pytest.raises(
        PermissionDenied,
        match=(
            r"Authenticated user does not have an active Relay account\."
            r" Have they been deactivated\?"
        ),
    ):
        FxaTokenAuthentication().authenticate(req)
    assert cache.get(get_cache_key("bearer-token")) == {"data": fxa_data}


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", "/api/some_endpoint"),
        ("DELETE", "/api/some_endpoint"),
        ("PUT", "/api/some_endpoint"),
        ("DELETE", "/api/v1/relayaddresses/1234"),
        ("PUT", "/api/v1/relayaddresses/1234"),
    ],
)
def test_fxa_token_authentication_skip_cache(
    method: str, path: str, free_user: User, fxa_social_app: SocialApp
) -> None:
    """FxA introspect is always called (use_cache=False) for some methods."""
    fxa_id = "non-cached-id"
    SocialAccount.objects.create(provider="fxa", uid=fxa_id, user=free_user)
    headers = {"Authorization": "Bearer bearer-token"}
    req = getattr(APIRequestFactory(), method.lower())(path=path, headers=headers)
    auth = FxaTokenAuthentication()
    introspect_response = IntrospectionResponse({"active": True, "sub": fxa_id})

    with patch(
        "api.authentication.introspect_token_or_raise", return_value=introspect_response
    ) as introspect:
        user_and_token = auth.authenticate(req)
    assert introspect.called_once_with("bearer-token", False)
    assert auth.use_cache is False
    assert user_and_token == (free_user, introspect_response)


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/some_endpoint"),
        ("HEAD", "/api/some_endpoint"),
        ("OPTIONS", "/api/some_endpoint"),
        ("POST", "/api/v1/relayaddresses/"),
    ],
)
def test_fxa_token_authentication_use_cache(
    method: str, path: str, free_user: User, fxa_social_app: SocialApp
) -> None:
    """Cached FxA introspect results are used (use_cache=True) for some methods."""
    fxa_id = "non-cached-id"
    SocialAccount.objects.create(provider="fxa", uid=fxa_id, user=free_user)
    headers = {"Authorization": "Bearer bearer-token"}
    req = getattr(APIRequestFactory(), method.lower())(path=path, headers=headers)
    auth = FxaTokenAuthentication()
    introspect_response = IntrospectionResponse(
        {"active": True, "sub": fxa_id}, from_cache=True
    )

    with patch(
        "api.authentication.introspect_token_or_raise", return_value=introspect_response
    ) as introspect:
        user_and_token = auth.authenticate(req)
    assert introspect.called_once_with("bearer-token", True)
    assert auth.use_cache is True
    assert user_and_token == (free_user, introspect_response)


@pytest.mark.django_db
def test_fxa_token_authentication_relay_user_optional():
    fxa_id = "non-cached-id"
    headers = {"Authorization": "Bearer bearer-token"}
    req = APIRequestFactory().get("/api/endpoint", headers=headers)
    auth = FxaTokenAuthenticationRelayUserOptional()
    introspect_response = IntrospectionResponse({"active": True, "sub": fxa_id})
    with patch(
        "api.authentication.introspect_token_or_raise", return_value=introspect_response
    ) as introspect:
        user_and_token = auth.authenticate(req)
    assert introspect.called_once_with("bearer-token", True)
    assert auth.use_cache is True
    assert user_and_token == (AnonymousUser(), introspect_response)
