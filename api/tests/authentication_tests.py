from datetime import datetime

from model_bakery import baker
import responses

from django.core.cache import cache
from django.test import RequestFactory, TestCase

from allauth.socialaccount.models import SocialAccount
from rest_framework.test import APIClient

from ..authentication import FxaTokenAuthentication, get_cache_key


def _setup_fxa_response(status_code: int, json: dict | str):
    fxa_verify_path = "https://oauth.stage.mozaws.net/v1/introspect"
    responses.add(responses.POST, fxa_verify_path, status=status_code, json=json)
    return {"status_code": status_code, "json": json}


def _setup_fxa_response_no_json(status_code: int):
    responses.add(
        responses.POST, "https://oauth.stage.mozaws.net/v1/introspect", status=status_code
    )
    return {"status_code": status_code}


class FxaTokenAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = FxaTokenAuthentication
        self.factory = RequestFactory()
        self.path = "/api/v1/relayaddresses"
        self.fxa_verify_path = "https://oauth.stage.mozaws.net/v1/introspect"
        self.uid = "relay-user-fxa-uid"

    def test_no_authorization_header_returns_none(self):
        get_addresses_req = self.factory.get(self.path)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

    def test_no_bearer_in_authorization_returns_none(self):
        headers = {"HTTP_AUTHORIZATION": "unexpected 123"}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

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
        assert (
            response.json()["detail"]
            == "Authenticated user does not have a Relay account."
        )
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
    def test_jsondecodeerror_returns_401_and_cache_returns_500(
        self,
    ):
        _setup_fxa_response_no_json(200)
        err_fxa_response = {"status_code": None, "json": {}}
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {invalid_token}")

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 401
        assert (
            response.json()["detail"] == "JSONDecodeError from FXA introspect response"
        )
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert cache.get(cache_key) == err_fxa_response

        # now check that the 2nd call did NOT make another fxa request
        response = client.get("/api/v1/relayaddresses/")
        assert response.status_code == 500
        assert response.json()["detail"] == "Previous FXA call failed, wait to retry."
