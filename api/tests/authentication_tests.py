from datetime import datetime

from django.core.cache import cache
from django.test import RequestFactory, TestCase

import responses
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
)
from rest_framework.test import APIClient

from ..authentication import (
    INTROSPECT_TOKEN_URL,
    FxaTokenAuthentication,
    get_cache_key,
    get_fxa_uid_from_oauth_token,
    introspect_token,
)

MOCK_BASE = "api.authentication"


def _setup_fxa_response(status_code: int, json: dict | str):
    responses.add(
        responses.POST,
        INTROSPECT_TOKEN_URL,
        status=status_code,
        json=json,
    )
    return {"status_code": status_code, "json": json}


def _setup_fxa_response_no_json(status_code: int):
    responses.add(responses.POST, INTROSPECT_TOKEN_URL, status=status_code)
    return {"status_code": status_code}


class AuthenticationMiscellaneous(TestCase):
    def setUp(self):
        self.auth = FxaTokenAuthentication
        self.factory = RequestFactory()
        self.path = "/api/v1/relayaddresses"
        self.fxa_verify_path = INTROSPECT_TOKEN_URL
        self.uid = "relay-user-fxa-uid"

    def tearDown(self):
        cache.clear()

    @responses.activate()
    def test_introspect_token_catches_JSONDecodeError_raises_AuthenticationFailed(self):
        _setup_fxa_response_no_json(200)
        invalid_token = "invalid-123"

        try:
            introspect_token(invalid_token)
        except AuthenticationFailed as e:
            assert str(e.detail) == "JSONDecodeError from FXA introspect response"
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised AuthenticationFailed")

    @responses.activate()
    def test_introspect_token_returns_fxa_introspect_response(self):
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        json_data = {"active": True, "sub": self.uid, "exp": exp_time}
        status_code = 200
        expected_fxa_resp_data = {"status_code": status_code, "json": json_data}
        _setup_fxa_response(status_code, json_data)
        valid_token = "valid-123"
        cache_key = get_cache_key(valid_token)

        assert cache.get(cache_key) is None

        fxa_resp_data = introspect_token(valid_token)
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert fxa_resp_data == expected_fxa_resp_data

    @responses.activate()
    def test_get_fxa_uid_from_oauth_token_returns_cached_response(self):
        user_token = "user-123"
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            200, {"active": True, "sub": self.uid, "exp": exp_time}
        )
        cache_key = get_cache_key(user_token)

        assert cache.get(cache_key) is None

        # get FxA uid for the first time
        fxa_uid = get_fxa_uid_from_oauth_token(user_token)
        assert fxa_uid == self.uid
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        fxa_uid = get_fxa_uid_from_oauth_token(user_token)
        assert fxa_uid == self.uid
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_get_fxa_uid_from_oauth_token_status_code_None_uses_cached_response_returns_error_response(  # noqa: E501
        self,
    ):
        _setup_fxa_response_no_json(200)
        err_fxa_response = {"status_code": None, "json": {}}
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except AuthenticationFailed as e:
            assert str(e.detail) == "JSONDecodeError from FXA introspect response"
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == err_fxa_response

        # now check that the 2nd call did NOT make another fxa request
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except APIException as e:
            assert str(e.detail) == "Previous FXA call failed, wait to retry."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised APIException")

    @responses.activate()
    def test_get_fxa_uid_from_oauth_token_status_code_not_200_uses_cached_response_returns_error_response(  # noqa: E501
        self,
    ):
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            401, {"active": False, "sub": self.uid, "exp": exp_time}
        )
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with none 200 response for the first time
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except APIException as e:
            assert str(e.detail) == "Did not receive a 200 response from FXA."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except APIException as e:
            assert str(e.detail) == "Did not receive a 200 response from FXA."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised APIException")

    @responses.activate()
    def test_get_fxa_uid_from_oauth_token_not_active_uses_cached_response_returns_error_response(  # noqa: E501
        self,
    ):
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        old_exp_time = (now_time - 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            200, {"active": False, "sub": self.uid, "exp": old_exp_time}
        )
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except AuthenticationFailed as e:
            assert str(e.detail) == "FXA returned active: False for token."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except AuthenticationFailed as e:
            assert str(e.detail) == "FXA returned active: False for token."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised AuthenticationFailed")

    @responses.activate()
    def test_get_fxa_uid_from_oauth_token_returns_fxa_response_with_no_fxa_uid(self):
        user_token = "user-123"
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(200, {"active": True, "exp": exp_time})
        cache_key = get_cache_key(user_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        try:
            get_fxa_uid_from_oauth_token(user_token)
        except NotFound as e:
            assert str(e.detail) == "FXA did not return an FXA UID."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        try:
            get_fxa_uid_from_oauth_token(user_token)
        except NotFound as e:
            assert str(e.detail) == "FXA did not return an FXA UID."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised AuthenticationFailed")


class FxaTokenAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = FxaTokenAuthentication
        self.factory = RequestFactory()
        self.path = "/api/v1/relayaddresses/"
        self.fxa_verify_path = INTROSPECT_TOKEN_URL
        self.uid = "relay-user-fxa-uid"

    def tearDown(self):
        cache.clear()

    def test_no_authorization_header_returns_none(self):
        get_addresses_req = self.factory.get(self.path)
        assert self.auth.authenticate(self.auth, get_addresses_req) is None

    def test_no_bearer_in_authorization_returns_none(self):
        headers = {"HTTP_AUTHORIZATION": "unexpected 123"}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) is None

    def test_no_token_returns_400(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer ")
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 400
        assert response.json()["detail"] == "Missing FXA Token after 'Bearer'."

    @responses.activate()
    def test_non_200_resp_from_fxa_raises_error_and_caches(self):
        fxa_response = _setup_fxa_response(401, {"error": "401"})
        not_found_token = "not-found-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {not_found_token}")

        assert cache.get(get_cache_key(not_found_token)) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."

        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(not_found_token)) == fxa_response

        # now check that the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_non_200_non_json_resp_from_fxa_raises_error_and_caches(self):
        fxa_response = _setup_fxa_response(503, "Bad Gateway")
        not_found_token = "fxa-gw-error"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {not_found_token}")

        assert cache.get(get_cache_key(not_found_token)) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 500

        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(not_found_token)) == fxa_response

        # now check that the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_inactive_token_responds_with_401(self):
        fxa_response = _setup_fxa_response(200, {"active": False})
        inactive_token = "inactive-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {inactive_token}")

        assert cache.get(get_cache_key(inactive_token)) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        assert response.json()["detail"] == "FXA returned active: False for token."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(inactive_token)) == fxa_response

        # now check that the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_200_resp_from_fxa_no_matching_user_raises_APIException(self):
        fxa_response = _setup_fxa_response(
            200, {"active": True, "sub": "not-a-relay-user"}
        )
        non_user_token = "non-user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {non_user_token}")

        assert cache.get(get_cache_key(non_user_token)) is None

        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 403
        expected_detail = (
            "Authenticated user does not have a Relay account."
            " Have they accepted the terms?"
        )
        assert response.json()["detail"] == expected_detail
        assert cache.get(get_cache_key(non_user_token)) == fxa_response

        # the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_200_resp_from_fxa_for_user_returns_user_and_caches(self):
        self.sa = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        user_token = "user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            200, {"active": True, "sub": self.uid, "exp": exp_time}
        )

        assert cache.get(get_cache_key(user_token)) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        # check the function returns the right user
        headers = {"HTTP_AUTHORIZATION": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, get_addresses_req)
        assert auth_return == (self.sa.user, user_token)

        # now check that the 2nd call did NOT make another fxa request
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

    @responses.activate()
    def test_write_requests_make_calls_to_fxa(self):
        self.sa = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        user_token = "user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            200, {"active": True, "sub": self.uid, "exp": exp_time}
        )

        assert cache.get(get_cache_key(user_token)) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        # check the function returns the right user
        headers = {"HTTP_AUTHORIZATION": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, get_addresses_req)
        assert auth_return == (self.sa.user, user_token)

        # now check that the 2nd GET request did NOT make another fxa request
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        headers = {"HTTP_AUTHORIZATION": f"Bearer {user_token}"}

        # send POST to /api/v1/relayaddresses and check that cache is used - i.e.,
        # FXA is *NOT* called
        post_addresses_req = self.factory.post(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, post_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

        # send POST to another API endpoint and check that cache is NOT used
        post_webcompat = self.factory.post("/api/v1/report_webcompat_issue", **headers)
        auth_return = self.auth.authenticate(self.auth, post_webcompat)
        assert responses.assert_call_count(self.fxa_verify_path, 2) is True

        # send other write requests and check that FXA *IS* called
        put_addresses_req = self.factory.put(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, put_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 3) is True

        delete_addresses_req = self.factory.delete(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, delete_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 4) is True
