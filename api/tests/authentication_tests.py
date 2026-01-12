from datetime import datetime
from typing import Any, Required, TypedDict

from django.core.cache import cache
from django.test import RequestFactory, TestCase

import responses
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from rest_framework.exceptions import APIException, AuthenticationFailed, NotFound
from rest_framework.test import APIClient

from ..authentication import (
    INTROSPECT_TOKEN_URL,
    FxaTokenAuthentication,
    get_cache_key,
    get_fxa_uid_from_oauth_token,
    introspect_token,
)

MOCK_BASE = "api.authentication"


class FxaIntrospectData(TypedDict, total=False):
    """
    Data returned from FxA's /v1/introspect endpoint.

    For more information, see:
    https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview/operation/postIntrospect
    """

    active: Required[bool]
    sub: str
    exp: int
    scope: str


class CachedFxaIntrospectionResponse(TypedDict):
    """The cached Fxa /v1/introspect response, to avoid overwhelming FxA API."""

    status_code: int
    json: Any


def setup_fxa_introspection_response(
    data: FxaIntrospectData | None = None,
) -> CachedFxaIntrospectionResponse:
    """
    Setup a successful call to FxA's /v1/introspect, return expected cached data.

    Authentication can still fail, for example if the user is inactive or required data
    is missing.
    """
    responses.add(responses.POST, INTROSPECT_TOKEN_URL, status=200, json=data)
    return {"status_code": 200, "json": data}


def setup_fxa_introspection_failure(
    *, status_code: int, json: Any
) -> CachedFxaIntrospectionResponse:
    """Setup a failed call to FxA's /v1/introspect, return expected cached data"""
    responses.add(responses.POST, INTROSPECT_TOKEN_URL, status=status_code, json=json)
    return {"status_code": status_code, "json": json}


class AuthenticationMiscellaneous(TestCase):
    def setUp(self):
        self.auth = FxaTokenAuthentication
        self.factory = RequestFactory()
        self.path = "/api/v1/relayaddresses"
        self.fxa_verify_path = INTROSPECT_TOKEN_URL
        self.uid = "relay-user-fxa-uid"

    def tearDown(self):
        cache.clear()

    @responses.activate
    def test_introspect_token_catches_JSONDecodeError_raises_AuthenticationFailed(self):
        setup_fxa_introspection_failure(status_code=200, json=None)
        invalid_token = "invalid-123"

        try:
            introspect_token(invalid_token)
        except AuthenticationFailed as e:
            assert str(e.detail) == "JSONDecodeError from FXA introspect response"
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised AuthenticationFailed")

    @responses.activate
    def test_introspect_token_returns_fxa_introspect_response(self):
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        json_data: FxaIntrospectData = {
            "active": True,
            "sub": self.uid,
            "exp": exp_time,
            "scope": "https://identity.mozilla.com/apps/relay",
        }
        status_code = 200
        expected_fxa_resp_data = {"status_code": status_code, "json": json_data}
        setup_fxa_introspection_response(json_data)
        valid_token = "valid-123"
        cache_key = get_cache_key(valid_token)

        assert cache.get(cache_key) is None

        fxa_resp_data = introspect_token(valid_token)
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert fxa_resp_data == expected_fxa_resp_data

    @responses.activate
    def test_get_fxa_uid_from_oauth_token_returns_cached_response(self):
        user_token = "user-123"
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = setup_fxa_introspection_response(
            {
                "active": True,
                "sub": self.uid,
                "exp": exp_time,
                "scope": "https://identity.mozilla.com/apps/relay",
            }
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

    @responses.activate
    def test_get_fxa_uid_from_oauth_token_status_code_None_uses_cached_response_returns_error_response(  # noqa: E501
        self,
    ) -> None:
        setup_fxa_introspection_failure(status_code=200, json=None)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except AuthenticationFailed as e:
            assert str(e.detail) == "JSONDecodeError from FXA introspect response"
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == {"status_code": None, "json": {}}

        # now check that the 2nd call did NOT make another fxa request
        try:
            get_fxa_uid_from_oauth_token(invalid_token)
        except APIException as e:
            assert str(e.detail) == "Previous FXA call failed, wait to retry."
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised APIException")

    @responses.activate
    def test_get_fxa_uid_from_oauth_token_status_code_not_200_uses_cached_response_returns_error_response(  # noqa: E501
        self,
    ) -> None:
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = setup_fxa_introspection_failure(
            status_code=401, json={"active": False, "sub": self.uid, "exp": exp_time}
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

    @responses.activate
    def test_get_fxa_uid_from_oauth_token_not_active_uses_cached_response_returns_error_response(  # noqa: E501
        self,
    ) -> None:
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        old_exp_time = (now_time - 60 * 60) * 1000
        fxa_response = setup_fxa_introspection_response(
            {"active": False, "sub": self.uid, "exp": old_exp_time}
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

    @responses.activate
    def test_get_fxa_uid_from_oauth_token_has_wrong_scope_returns_error_response(  # noqa: E501
        self,
    ) -> None:
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        json_data: FxaIntrospectData = {
            "active": True,
            "sub": self.uid,
            "exp": exp_time,
            "scope": "foo",
        }
        fxa_response = setup_fxa_introspection_response(json_data)
        missing_scopes_token = "missing-scopes-123"
        cache_key = get_cache_key(missing_scopes_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        try:
            get_fxa_uid_from_oauth_token(missing_scopes_token)
        except AuthenticationFailed as e:
            assert (
                str(e.detail)
                == "FXA token is missing scope: https://identity.mozilla.com/apps/relay."
            )
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        try:
            get_fxa_uid_from_oauth_token(missing_scopes_token)
        except AuthenticationFailed as e:
            assert (
                str(e.detail)
                == "FXA token is missing scope: https://identity.mozilla.com/apps/relay."
            )
            assert responses.assert_call_count(self.fxa_verify_path, 1) is True
            return
        self.fail("Should have raised AuthenticationFailed")

    @responses.activate
    def test_get_fxa_uid_from_oauth_token_returns_fxa_response_with_no_fxa_uid(self):
        user_token = "user-123"
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = setup_fxa_introspection_response(
            {
                "active": True,
                "exp": exp_time,
                "scope": "https://identity.mozilla.com/apps/relay",
            }
        )
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
    def setUp(self) -> None:
        self.auth = FxaTokenAuthentication()
        self.factory = RequestFactory()
        self.path = "/api/v1/relayaddresses/"
        self.fxa_verify_path = INTROSPECT_TOKEN_URL
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
        assert response.status_code == 400
        assert response.json()["detail"] == "Missing FXA Token after 'Bearer'."

    @responses.activate
    def test_non_200_resp_from_fxa_raises_error_and_caches(self) -> None:
        fxa_response = setup_fxa_introspection_failure(
            status_code=401, json={"error": "401"}
        )
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

    @responses.activate
    def test_non_200_non_json_resp_from_fxa_raises_error_and_caches(self) -> None:
        fxa_response = setup_fxa_introspection_failure(
            status_code=503, json="Bad Gateway"
        )
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

    @responses.activate
    def test_inactive_token_responds_with_401(self) -> None:
        fxa_response = setup_fxa_introspection_response({"active": False})
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

    @responses.activate
    def test_200_resp_from_fxa_no_matching_user_raises_APIException(self) -> None:
        # I think this scope is realistic for a user that has not not accepted terms
        fxa_response = setup_fxa_introspection_response(
            {
                "active": True,
                "sub": "not-a-relay-user",
                "scope": "https://identity.mozilla.com/apps/relay",
            },
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

    @responses.activate
    def test_200_resp_from_fxa_inactive_Relay_user_raises_APIException(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        sa.user.is_active = False
        sa.user.save()
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        setup_fxa_introspection_response(
            {
                "active": True,
                "sub": self.uid,
                "exp": exp_time,
                "scope": "https://identity.mozilla.com/apps/relay",
            },
        )
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
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = setup_fxa_introspection_response(
            {
                "active": True,
                "sub": self.uid,
                "exp": exp_time,
                "scope": "https://identity.mozilla.com/apps/relay",
            },
        )

        assert cache.get(get_cache_key(user_token)) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        # check the function returns the right user
        headers = {"Authorization": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        auth_return = self.auth.authenticate(get_addresses_req)
        assert auth_return == (sa.user, user_token)

        # now check that the 2nd call did NOT make another fxa request
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

    @responses.activate
    def test_write_requests_make_calls_to_fxa(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        user_token = "user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = setup_fxa_introspection_response(
            {
                "active": True,
                "sub": self.uid,
                "exp": exp_time,
                "scope": "https://identity.mozilla.com/apps/relay",
            },
        )

        assert cache.get(get_cache_key(user_token)) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        # check the function returns the right user
        headers = {"Authorization": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        auth_return = self.auth.authenticate(get_addresses_req)
        assert auth_return == (sa.user, user_token)

        # now check that the 2nd GET request did NOT make another fxa request
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        headers = {"Authorization": f"Bearer {user_token}"}

        # send POST to /api/v1/relayaddresses and check that cache is used - i.e.,
        # FXA is *NOT* called
        post_addresses_req = self.factory.post(self.path, headers=headers)
        auth_return = self.auth.authenticate(post_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

        # send POST to another API endpoint and check that cache is NOT used
        post_webcompat = self.factory.post(
            "/api/v1/report_webcompat_issue", headers=headers
        )
        auth_return = self.auth.authenticate(post_webcompat)
        assert responses.assert_call_count(self.fxa_verify_path, 2) is True

        # send other write requests and check that FXA *IS* called
        put_addresses_req = self.factory.put(self.path, headers=headers)
        auth_return = self.auth.authenticate(put_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 3) is True

        delete_addresses_req = self.factory.delete(self.path, headers=headers)
        auth_return = self.auth.authenticate(delete_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 4) is True
