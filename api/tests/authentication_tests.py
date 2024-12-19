import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import Mock

from django.core.cache import BaseCache
from django.core.cache import cache as django_cache
from django.test import TestCase

import pytest
import responses
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from requests import ReadTimeout
from rest_framework.exceptions import APIException
from rest_framework.test import APIClient, APIRequestFactory

from ..authentication import (
    INTROSPECT_ERROR,
    INTROSPECT_TOKEN_URL,
    FxaIntrospectData,
    FxaTokenAuthentication,
    IntrospectAuthenticationFailed,
    IntrospectionError,
    IntrospectionResponse,
    IntrospectUnavailable,
    get_cache_key,
    introspect_token,
    introspect_token_or_raise,
    load_introspection_result_from_cache,
)


@pytest.fixture
def cache() -> Iterator[BaseCache]:
    yield django_cache
    django_cache.clear()


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
        "the-key", {"data": {"active": True, "sub": "old-fxa-id"}}, 60
    )


def test_introspection_response_save_to_cache_from_cache_dropped():
    response = IntrospectionResponse(
        {"active": True, "sub": "some-fxa-id"}, from_cache=True
    )
    mock_cache = Mock(spec_set=["set"])
    response.save_to_cache(mock_cache, "the-key", 60)
    mock_cache.set.assert_called_once_with(
        "the-key", {"data": {"active": True, "sub": "some-fxa-id"}}, 60
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
    mock_cache.set.assert_called_once_with("cache-key", {"error": "Timeout"}, 60)


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
        "cache-key",
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
    cache.get.assert_called_once_with("cache_key")


def test_load_introspection_result_from_cache_introspection_error_no_args() -> None:
    cache = Mock(spec_set=["get"])
    cache.get.return_value = {"error": "Timeout"}

    error = load_introspection_result_from_cache(cache, "cache_key")
    assert isinstance(error, IntrospectionError)
    assert error == IntrospectionError("Timeout", from_cache=True)
    cache.get.assert_called_once_with("cache_key")


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
    cache.get.assert_called_once_with("cache_key")


def test_load_introspection_result_from_cache_introspection_bad_value() -> None:
    cache = Mock(spec_set=["get"])
    cache.get.return_value = "Not a dictionary"

    assert load_introspection_result_from_cache(cache, "cache_key") is None
    cache.get.assert_called_once_with("cache_key")


class IntrospectTokenOrRaiseTests(TestCase):
    """Tests for introspect_token_or_raise"""

    uid = "relay-user-fxa-uid"

    def tearDown(self):
        django_cache.clear()

    @responses.activate
    def test_cached_success_response(self):
        user_token = "user-123"
        mock_response, fxa_data = setup_fxa_introspect(uid=self.uid)
        assert fxa_data is not None
        cache_key = get_cache_key(user_token)
        assert django_cache.get(cache_key) is None

        # get FxA uid for the first time
        fxa_resp = introspect_token_or_raise(user_token)
        assert fxa_resp.fxa_id == self.uid
        assert not fxa_resp.from_cache
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {"data": fxa_data}

        # now check that the 2nd call did NOT make another fxa request
        fxa_resp2 = introspect_token_or_raise(user_token)
        assert fxa_resp2.from_cache
        assert mock_response.call_count == 1

    @responses.activate
    def test_timeout_raises_authentication_failed(self):
        slow_token = "user-123"
        mock_response, _ = setup_fxa_introspect(timeout=True)
        cache_key = get_cache_key(slow_token)
        assert django_cache.get(cache_key) is None

        # get fxa response that times out
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(slow_token)
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {"error": "Timeout"}

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(slow_token)
        assert mock_response.call_count == 1

    @responses.activate
    def test_cached_no_body_response(self) -> None:
        mock_response, _ = setup_fxa_introspect(no_body=True)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        assert django_cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NotJson",
            "error_args": [""],
            "status_code": 200,
        }

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1

    @responses.activate
    def test_cached_401_response(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(401, active=False)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        assert django_cache.get(cache_key) is None

        # get fxa response with 401 (not 200) for the first time
        with self.assertRaises(IntrospectAuthenticationFailed):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NotAuthorized",
            "status_code": 401,
            "data": fxa_data,
        }

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaises(IntrospectAuthenticationFailed):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1

    @responses.activate
    def test_cached_inactive_response(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(active=False)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        assert django_cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        with self.assertRaises(IntrospectAuthenticationFailed):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NotActive",
            "status_code": 200,
            "data": fxa_data,
        }

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaises(IntrospectAuthenticationFailed):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1

    @responses.activate
    def test_cached_missing_uid(self):
        user_token = "user-123"
        mock_response, fxa_data = setup_fxa_introspect(uid=None)
        cache_key = get_cache_key(user_token)
        assert django_cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(user_token)
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NoSubject",
            "status_code": 200,
            "data": fxa_data,
        }

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(user_token)
        assert mock_response.call_count == 1


class FxaTokenAuthenticationTest(TestCase):
    def setUp(self) -> None:
        self.auth = FxaTokenAuthentication()
        self.factory = APIRequestFactory()
        self.path = "/api/v1/relayaddresses/"
        self.uid = "relay-user-fxa-uid"

    def tearDown(self) -> None:
        django_cache.clear()

    def test_no_authorization_header_returns_none(self) -> None:
        get_addresses_req = self.factory.get(self.path)
        assert self.auth.authenticate(get_addresses_req) is None

    def test_no_bearer_in_authorization_returns_none(self) -> None:
        headers = {"Authorization": "unexpected 123"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        assert self.auth.authenticate(get_addresses_req) is None

    def test_no_token_returns_400(self) -> None:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer ")
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        expected_detail = "Invalid token header. No credentials provided."
        assert response.json()["detail"] == expected_detail

    @responses.activate
    def test_non_200_resp_from_fxa_raises_error_and_caches(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(401, error="401")
        not_found_token = "not-found-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {not_found_token}")
        cache_key = get_cache_key(not_found_token)
        assert django_cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect authentication credentials."

        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NotAuthorized",
            "status_code": 401,
            "data": fxa_data,
        }

        # now check that the code does NOT make another fxa request
        response2 = client.get("/api/v1/relayaddresses/")
        assert response2.status_code == 401
        assert mock_response.call_count == 1

    @responses.activate
    def test_non_200_non_json_resp_from_fxa_raises_error_and_caches(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(503, text_body="Bad Gateway")
        assert fxa_data is None
        not_found_token = "fxa-gw-error"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {not_found_token}")
        cache_key = get_cache_key(not_found_token)
        assert django_cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 503

        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NotJsonDict",
            "error_args": ["Bad Gateway"],
            "status_code": 503,
        }

        # now check that the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert mock_response.call_count == 1

    @responses.activate
    def test_inactive_token_responds_with_401(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(active=False)
        inactive_token = "inactive-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {inactive_token}")
        cache_key = get_cache_key(inactive_token)
        assert django_cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect authentication credentials."
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {
            "error": "NotActive",
            "status_code": 200,
            "data": fxa_data,
        }

        # now check that the code does NOT make another fxa request
        response2 = client.get("/api/v1/relayaddresses/")
        assert response2.status_code == 401
        assert mock_response.call_count == 1

    @responses.activate
    def test_200_resp_from_fxa_no_matching_user_raises_APIException(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(uid="not-a-relay-user")
        non_user_token = "non-user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {non_user_token}")
        cache_key = get_cache_key(non_user_token)
        assert django_cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 403
        expected_detail = (
            "Authenticated user does not have a Relay account."
            " Have they accepted the terms?"
        )
        assert response.json()["detail"] == expected_detail
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {"data": fxa_data}

        # the code does NOT make another fxa request
        response2 = client.get("/api/v1/relayaddresses/")
        assert response2.status_code == 403
        assert mock_response.call_count == 1

    @responses.activate
    def test_200_resp_from_fxa_inactive_Relay_user_raises_APIException(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        sa.user.is_active = False
        sa.user.save()
        setup_fxa_introspect(uid=self.uid)
        inactive_user_token = "inactive-user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {inactive_user_token}")

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 403
        expected_detail = (
            "Authenticated user does not have an active Relay account."
            " Have they been deactivated?"
        )
        assert response.json()["detail"] == expected_detail

    @responses.activate
    def test_200_resp_from_fxa_for_user_returns_user_and_caches(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        user_token = "user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
        mock_response, fxa_data = setup_fxa_introspect(uid=self.uid)
        assert fxa_data is not None
        cache_key = get_cache_key(user_token)
        assert django_cache.get(cache_key) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert mock_response.call_count == 1
        expected_cache_value = {"data": fxa_data}
        assert django_cache.get(cache_key) == expected_cache_value

        # check the function returns the right user
        headers = {"Authorization": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        auth_return = self.auth.authenticate(get_addresses_req)
        assert auth_return == (
            sa.user,
            IntrospectionResponse(data=fxa_data, from_cache=True),
        )

        # now check that the 2nd call did NOT make another fxa request
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == expected_cache_value

    @responses.activate
    def test_fxa_introspect_timeout(self) -> None:
        slow_token = "slow-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {slow_token}")
        mock_response, fxa_data = setup_fxa_introspect(timeout=True)
        cache_key = get_cache_key(slow_token)
        assert django_cache.get(cache_key) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 503
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == {"error": "Timeout"}

        # check the function raises an exception
        headers = {"Authorization": f"Bearer {slow_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)

        with self.assertRaisesMessage(
            APIException, "Introspection temporarily unavailable, try again later."
        ):
            self.auth.authenticate(get_addresses_req)

        # now check that the 2nd call did NOT make another fxa request
        assert mock_response.call_count == 1

    @responses.activate
    def test_write_requests_make_calls_to_fxa(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        user_token = "user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
        mock_response, fxa_data = setup_fxa_introspect(uid=self.uid)
        assert fxa_data is not None
        cache_key = get_cache_key(user_token)
        assert django_cache.get(cache_key) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert mock_response.call_count == 1
        expected_cache_value = {"data": fxa_data}
        assert django_cache.get(cache_key) == expected_cache_value

        # check the function returns the right user
        headers = {"Authorization": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        auth_return = self.auth.authenticate(get_addresses_req)
        assert auth_return == (
            sa.user,
            IntrospectionResponse(data=fxa_data, from_cache=True),
        )

        # now check that the 2nd GET request did NOT make another fxa request
        assert mock_response.call_count == 1
        assert django_cache.get(cache_key) == expected_cache_value

        headers = {"Authorization": f"Bearer {user_token}"}

        # send POST to /api/v1/relayaddresses and check that cache is used - i.e.,
        # FXA is *NOT* called
        post_addresses_req = self.factory.post(self.path, headers=headers)
        auth_return = self.auth.authenticate(post_addresses_req)
        assert mock_response.call_count == 1

        # send POST to another API endpoint and check that cache is NOT used
        post_webcompat = self.factory.post(
            "/api/v1/report_webcompat_issue", headers=headers
        )
        auth_return = self.auth.authenticate(post_webcompat)
        assert mock_response.call_count == 2

        # send other write requests and check that FXA *IS* called
        put_addresses_req = self.factory.put(self.path, headers=headers)
        auth_return = self.auth.authenticate(put_addresses_req)
        assert mock_response.call_count == 3

        delete_addresses_req = self.factory.delete(self.path, headers=headers)
        auth_return = self.auth.authenticate(delete_addresses_req)
        assert mock_response.call_count == 4
