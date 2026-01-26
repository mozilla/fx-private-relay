from datetime import datetime
from typing import Any, Required, TypedDict
from unittest.mock import patch
from uuid import uuid4

from django.conf import settings
from django.core.cache import cache
from django.test import TestCase

import responses
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from requests.exceptions import Timeout
from rest_framework.exceptions import APIException, AuthenticationFailed, NotFound
from rest_framework.test import APIClient, APIRequestFactory, APITestCase

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


def create_fxa_introspect_data(
    *,
    active: bool = True,
    sub: str | None = None,
    scope: str | None = None,
    no_sub: bool = False,
    exp_expired: bool = False,
) -> FxaIntrospectData:
    """Create the data returned from FxA's /v1/introspect endpoint."""
    now_time = int(datetime.now().timestamp())
    # Note: FxA exp is timestamp in milliseconds
    if exp_expired:
        exp = (now_time - 60 * 60) * 1000
    else:
        exp = (now_time + 60 * 60) * 1000
    data: FxaIntrospectData = {
        "active": active,
        "sub": uuid4().hex if sub is None else sub,
        "exp": exp,
        "scope": settings.RELAY_SCOPE if scope is None else scope,
    }
    if no_sub:
        del data["sub"]
    return data


class CachedFxaIntrospectionResponse(TypedDict):
    """The cached Fxa /v1/introspect response, to avoid overwhelming FxA API."""

    status_code: int
    json: Any


def setup_fxa_introspection_response(
    data: FxaIntrospectData,
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


class IntrospectTokenTests(TestCase):
    """Tests for introspect_token()"""

    @responses.activate
    def test_invalid_json_raises_AuthenticationFailed(self):
        setup_fxa_introspection_failure(status_code=200, json=None)

        expected_err = "JSONDecodeError from FXA introspect response"
        with self.assertRaisesRegex(AuthenticationFailed, expected_err):
            introspect_token("invalid-123")
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_valid_json_returns_fxa_introspect_response(self):
        json_data = create_fxa_introspect_data()
        expected_fxa_resp_data = {"status_code": 200, "json": json_data}
        setup_fxa_introspection_response(json_data)

        fxa_resp_data = introspect_token("valid-123")
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert fxa_resp_data == expected_fxa_resp_data

    @responses.activate
    def test_timeout_raises_AuthenticationFailed(self):
        responses.add(responses.POST, INTROSPECT_TOKEN_URL, body=Timeout("so slow"))

        expected_err = "Could not introspect token with FXA."
        with self.assertRaisesRegex(AuthenticationFailed, expected_err):
            introspect_token("slow-123")
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True


class GetFxaUidFromOauthTests(TestCase):
    """Tests for get_fxa_uid_from_oauth_token()"""

    def tearDown(self):
        cache.clear()

    @responses.activate
    def test_active_user_passes_auth_and_cache_passes_auth(self):
        user_token = "user-123"
        uid = "relay-user-fxa-uid"
        fxa_introspect_data = create_fxa_introspect_data(sub=uid)
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
        cache_key = get_cache_key(user_token)

        assert cache.get(cache_key) is None

        # get FxA uid for the first time
        fxa_uid = get_fxa_uid_from_oauth_token(user_token)
        assert fxa_uid == uid
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        fxa_uid = get_fxa_uid_from_oauth_token(user_token)
        assert fxa_uid == uid
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_invalid_json_fails_auth_and_cache_raises_APIException(self) -> None:
        setup_fxa_introspection_failure(status_code=200, json=None)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        expected_err1 = "JSONDecodeError from FXA introspect response"
        with self.assertRaisesRegex(AuthenticationFailed, expected_err1):
            get_fxa_uid_from_oauth_token(invalid_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == {"status_code": None, "json": {}}

        # now check that the 2nd call did NOT make another fxa request
        expected_err2 = "Previous FXA call failed, wait to retry."
        with self.assertRaisesRegex(APIException, expected_err2):
            get_fxa_uid_from_oauth_token(invalid_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_failed_request_raises_APIException_and_cache_raises_same(self) -> None:
        data = create_fxa_introspect_data(active=False)
        fxa_response = setup_fxa_introspection_failure(status_code=401, json=data)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with none 200 response for the first time
        expected_err = "Did not receive a 200 response from FXA."
        with self.assertRaisesRegex(APIException, expected_err):
            get_fxa_uid_from_oauth_token(invalid_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaisesRegex(APIException, expected_err):
            get_fxa_uid_from_oauth_token(invalid_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_inactive_user_fails_auth_and_cache_fails_auth(self) -> None:
        data = create_fxa_introspect_data(active=False, exp_expired=True)
        fxa_response = setup_fxa_introspection_response(data)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        expected_err = "FXA returned active: False for token."
        with self.assertRaisesRegex(AuthenticationFailed, expected_err):
            get_fxa_uid_from_oauth_token(invalid_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaisesRegex(AuthenticationFailed, expected_err):
            get_fxa_uid_from_oauth_token(invalid_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_wrong_scope_fails_auth_and_cache_fails_auth(self) -> None:
        json_data = create_fxa_introspect_data(scope="foo")
        fxa_response = setup_fxa_introspection_response(json_data)
        missing_scopes_token = "missing-scopes-123"
        cache_key = get_cache_key(missing_scopes_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        expected_err = f"FXA token is missing scope: {settings.RELAY_SCOPE}."
        with self.assertRaisesRegex(AuthenticationFailed, expected_err):
            get_fxa_uid_from_oauth_token(missing_scopes_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaisesRegex(AuthenticationFailed, expected_err):
            get_fxa_uid_from_oauth_token(missing_scopes_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_no_sub_raises_NotFound_and_cache_raises_same(self):
        user_token = "user-123"
        fxa_introspect_data = create_fxa_introspect_data(no_sub=True)
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
        cache_key = get_cache_key(user_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        expected_err = "FXA did not return an FXA UID."
        with self.assertRaisesRegex(NotFound, expected_err):
            get_fxa_uid_from_oauth_token(user_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == fxa_response

        # now check that the 2nd call did NOT make another fxa request
        with self.assertRaisesRegex(NotFound, expected_err):
            get_fxa_uid_from_oauth_token(user_token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_timeout_fails_auth_and_cache_raises_APIException(self):
        responses.add(responses.POST, INTROSPECT_TOKEN_URL, body=Timeout("so slow"))
        token = "slow-123"
        cache_key = get_cache_key(token)

        assert cache.get(cache_key) is None

        # fxa request times out for the first time
        expected_err1 = "Could not introspect token with FXA."
        with self.assertRaisesRegex(AuthenticationFailed, expected_err1):
            get_fxa_uid_from_oauth_token(token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(cache_key) == {"status_code": None, "json": {}}

        # now check that the 2nd call did NOT make another fxa request
        expected_err2 = "Previous FXA call failed, wait to retry."
        with self.assertRaisesRegex(APIException, expected_err2):
            get_fxa_uid_from_oauth_token(token)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_cache_timeout_uses_exp_if_long(self):
        fxa_introspect_data = create_fxa_introspect_data()
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
        token = "long-exp-123"
        cache_key = get_cache_key(token)

        with patch("api.authentication.cache") as mock_cache:
            mock_cache.get.return_value = None
            get_fxa_uid_from_oauth_token(token)
        call1, call2 = mock_cache.set.call_args_list
        # First call to cache.set uses default of 60 seconds
        assert call1.args == (cache_key, fxa_response, 60)
        assert call2.args[0:2] == (cache_key, fxa_response)
        # Second call to cache.set uses exp from introspect data
        assert 3550 < call2.args[2] <= 3600  # Second call uses exp

    @responses.activate
    def test_cache_timeout_uses_default_if_exp_is_short(self):
        fxa_introspect_data = create_fxa_introspect_data()
        fxa_introspect_data["exp"] = (
            int(datetime.now().timestamp()) * 1000
        )  # expires now
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
        token = "short-exp-123"
        cache_key = get_cache_key(token)

        with patch("api.authentication.cache") as mock_cache:
            mock_cache.get.return_value = None
            get_fxa_uid_from_oauth_token(token)
        call1, call2 = mock_cache.set.call_args_list
        # First call to cache.set uses default of 60 seconds
        assert call1.args == (cache_key, fxa_response, 60)
        # Second call to cache.set also uses default
        assert call2.args == (cache_key, fxa_response, 60)

    @responses.activate
    def test_cache_timeout_uses_default_if_exp_is_omitted(self):
        fxa_introspect_data = create_fxa_introspect_data()
        del fxa_introspect_data["exp"]
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
        token = "short-exp-123"
        cache_key = get_cache_key(token)

        with patch("api.authentication.cache") as mock_cache:
            mock_cache.get.return_value = None
            get_fxa_uid_from_oauth_token(token)
        call1, call2 = mock_cache.set.call_args_list
        # First call to cache.set uses default of 60 seconds
        assert call1.args == (cache_key, fxa_response, 60)
        # Second call to cache.set also uses default
        assert call2.args == (cache_key, fxa_response, 60)


class FxaTokenAuthenticationTest(APITestCase):
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
        self.client.credentials(HTTP_AUTHORIZATION="Bearer ")
        response = self.client.get("/api/v1/relayaddresses/")
        assert response.status_code == 400
        assert response.json()["detail"] == "Missing FXA Token after 'Bearer'."

    @responses.activate
    def test_non_200_resp_from_fxa_raises_error_and_caches(self) -> None:
        fxa_response = setup_fxa_introspection_failure(
            status_code=401, json={"error": "401"}
        )
        not_found_token = "not-found-123"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {not_found_token}")

        assert cache.get(get_cache_key(not_found_token)) is None

        response = self.client.get("/api/v1/relayaddresses/")
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."

        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(not_found_token)) == fxa_response

        # now check that the code does NOT make another fxa request
        response = self.client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

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

        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(not_found_token)) == fxa_response

        # now check that the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

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
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(inactive_token)) == fxa_response

        # now check that the code does NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_200_resp_from_fxa_no_matching_user_raises_APIException(self) -> None:
        # I think this scope is realistic for a user that has not not accepted terms
        fxa_introspect_data = create_fxa_introspect_data(
            scope="https://identity.mozilla.com/apps/relay"
        )
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
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
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_200_resp_from_fxa_inactive_Relay_user_raises_APIException(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        sa.user.is_active = False
        sa.user.save()
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        setup_fxa_introspection_response(fxa_introspect_data)
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
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)

        assert cache.get(get_cache_key(user_token)) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        # check the function returns the right user
        headers = {"Authorization": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        auth_return = self.auth.authenticate(get_addresses_req)
        assert auth_return == (sa.user, user_token)

        # now check that the 2nd call did NOT make another fxa request
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

    @responses.activate
    def test_write_requests_make_calls_to_fxa(self) -> None:
        sa: SocialAccount = baker.make(SocialAccount, uid=self.uid, provider="fxa")
        user_token = "user-123"
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)

        assert cache.get(get_cache_key(user_token)) is None

        # check the endpoint status code
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 200
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        # check the function returns the right user
        headers = {"Authorization": f"Bearer {user_token}"}
        get_addresses_req = self.factory.get(self.path, headers=headers)
        auth_return = self.auth.authenticate(get_addresses_req)
        assert auth_return == (sa.user, user_token)

        # now check that the 2nd GET request did NOT make another fxa request
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert cache.get(get_cache_key(user_token)) == fxa_response

        headers = {"Authorization": f"Bearer {user_token}"}

        # send POST to /api/v1/relayaddresses and check that cache is used - i.e.,
        # FXA is *NOT* called
        post_addresses_req = self.factory.post(self.path, headers=headers)
        auth_return = self.auth.authenticate(post_addresses_req)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

        # send POST to another API endpoint and check that cache is NOT used
        post_webcompat = self.factory.post(
            "/api/v1/report_webcompat_issue", headers=headers
        )
        auth_return = self.auth.authenticate(post_webcompat)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 2) is True

        # send other write requests and check that FXA *IS* called
        put_addresses_req = self.factory.put(self.path, headers=headers)
        auth_return = self.auth.authenticate(put_addresses_req)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 3) is True

        delete_addresses_req = self.factory.delete(self.path, headers=headers)
        auth_return = self.auth.authenticate(delete_addresses_req)
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 4) is True
