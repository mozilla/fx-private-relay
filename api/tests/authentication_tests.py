import json
from datetime import datetime

from django.core.cache import cache
from django.test import TestCase

import responses
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from requests import ReadTimeout
from rest_framework.exceptions import APIException
from rest_framework.test import APIClient, APIRequestFactory

from ..authentication import (
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
)

MOCK_BASE = "api.authentication"


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


class IntrospectTokenTests(TestCase):
    """Tests for introspect_token"""

    @responses.activate
    def test_success_returns_introspection_response(self):
        mock_response, fxa_data = setup_fxa_introspect()
        assert fxa_data is not None

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionResponse(fxa_data)
        assert mock_response.call_count == 1

    @responses.activate
    def test_timeout_returns_error(self):
        mock_response = _mock_fxa_introspect_response(timeout=True)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError("Timeout")
        assert mock_response.call_count == 1

    @responses.activate
    def test_other_request_exception_returns_error(self):
        mock_response = _mock_fxa_introspect_response(
            exception=Exception("An Exception")
        )

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError(
            "FailedRequest", ["Exception", "An Exception"]
        )
        assert mock_response.call_count == 1

    @responses.activate
    def test_no_body_returns_error(self) -> None:
        mock_response, _ = setup_fxa_introspect(no_body=True)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError("NotJson", [""], status_code=200)
        assert mock_response.call_count == 1

    @responses.activate
    def test_list_body_returns_error(self) -> None:
        valid_data = _create_fxa_introspect_response()
        invalid_data = [valid_data]
        invalid_text = json.dumps(invalid_data)
        mock_response, _ = setup_fxa_introspect(text_body=invalid_text)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError(
            "NotJsonDict", [invalid_text], status_code=200
        )
        assert mock_response.call_count == 1

    @responses.activate
    def test_401_response_returns_error(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(401, active=False)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError(
            "NotAuthorized", status_code=401, data=fxa_data
        )
        assert mock_response.call_count == 1

    @responses.activate
    def test_500_response_returns_error(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(500)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError("NotOK", status_code=500, data=fxa_data)
        assert mock_response.call_count == 1

    @responses.activate
    def test_inactive_response_returns_error(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(active=False)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError(
            "NotActive", status_code=200, data=fxa_data
        )
        assert mock_response.call_count == 1

    @responses.activate
    def test_no_subject_response_returns_error(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(uid=None)

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionError(
            "NoSubject", status_code=200, data=fxa_data
        )
        assert mock_response.call_count == 1

    @responses.activate
    def test_no_expiration_response_is_ok(self) -> None:
        mock_response, fxa_data = setup_fxa_introspect(expiration=False)
        assert fxa_data

        fxa_resp = introspect_token("the-token")
        assert fxa_resp == IntrospectionResponse(data=fxa_data)
        assert getattr(fxa_resp, "cache_timeout", None) == 0
        assert mock_response.call_count == 1


class IntrospectTokenOrRaiseTests(TestCase):
    """Tests for introspect_token_or_raise"""

    uid = "relay-user-fxa-uid"

    def tearDown(self):
        cache.clear()

    @responses.activate
    def test_cached_success_response(self):
        user_token = "user-123"
        mock_response, fxa_data = setup_fxa_introspect(uid=self.uid)
        assert fxa_data is not None
        cache_key = get_cache_key(user_token)
        assert cache.get(cache_key) is None

        # get FxA uid for the first time
        fxa_resp = introspect_token_or_raise(user_token)
        assert fxa_resp.fxa_id == self.uid
        assert not fxa_resp.from_cache
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {"v": 1, "data": fxa_data}

        # now check that the 2nd call did NOT make another fxa request
        fxa_resp2 = introspect_token_or_raise(user_token)
        assert fxa_resp2.from_cache
        assert mock_response.call_count == 1

    @responses.activate
    def test_timeout_raises_authentication_failed(self):
        slow_token = "user-123"
        mock_response, _ = setup_fxa_introspect(timeout=True)
        cache_key = get_cache_key(slow_token)
        assert cache.get(cache_key) is None

        # get fxa response that times out
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(slow_token)
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {"v": 1, "error": "Timeout"}

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(slow_token)
        assert mock_response.call_count == 1

    @responses.activate
    def test_cached_no_body_response(self) -> None:
        mock_response, _ = setup_fxa_introspect(no_body=True)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        assert cache.get(cache_key) is None

        # get fxa response with 401 (not 200) for the first time
        with self.assertRaises(IntrospectAuthenticationFailed):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        assert cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        with self.assertRaises(IntrospectAuthenticationFailed):
            introspect_token_or_raise(invalid_token)
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        with self.assertRaises(IntrospectUnavailable):
            introspect_token_or_raise(user_token)
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        cache.clear()

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
        assert cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect authentication credentials."

        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        assert cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 503

        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        assert cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect authentication credentials."
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {
            "v": 1,
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
        assert cache.get(cache_key) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 403
        expected_detail = (
            "Authenticated user does not have a Relay account."
            " Have they accepted the terms?"
        )
        assert response.json()["detail"] == expected_detail
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {"v": 1, "data": fxa_data}

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
        assert cache.get(cache_key) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert mock_response.call_count == 1
        expected_cache_value = {"v": 1, "data": fxa_data}
        assert cache.get(cache_key) == expected_cache_value

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
        assert cache.get(cache_key) == expected_cache_value

    @responses.activate
    def test_fxa_introspect_timeout(self) -> None:
        slow_token = "slow-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {slow_token}")
        mock_response, fxa_data = setup_fxa_introspect(timeout=True)
        cache_key = get_cache_key(slow_token)
        assert cache.get(cache_key) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 503
        assert mock_response.call_count == 1
        assert cache.get(cache_key) == {"v": 1, "error": "Timeout"}

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
        assert cache.get(cache_key) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert mock_response.call_count == 1
        expected_cache_value = {"v": 1, "data": fxa_data}
        assert cache.get(cache_key) == expected_cache_value

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
        assert cache.get(cache_key) == expected_cache_value

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
