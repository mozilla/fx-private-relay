"""Tests for terms_accepted_user_2024 in api/views/privaterelay_views.py"""

import logging
from datetime import datetime

from django.core.cache import cache
from django.test import RequestFactory, TestCase, override_settings

import pytest
import responses
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from rest_framework.test import APIClient

from api.authentication import (
    FXA_TOKEN_AUTH_OLD_AND_PROVEN,
    INTROSPECT_TOKEN_URL,
)
from api.authentication import (
    get_cache_key_2024 as get_cache_key,
)
from api.tests.authentication_2024_tests import _setup_fxa_response
from api.views.privaterelay import FXA_PROFILE_URL
from privaterelay.models import Profile
from privaterelay.tests.utils import log_extra


@override_settings(
    FXA_TOKEN_AUTH_VERSION=FXA_TOKEN_AUTH_OLD_AND_PROVEN
)  # noqa: S106 # Possible hardcoded password
@pytest.mark.usefixtures("fxa_social_app")
class TermsAcceptedUserViewTest(TestCase):
    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.path = "/api/v1/terms-accepted-user/"
        self.fxa_verify_path = INTROSPECT_TOKEN_URL
        self.uid = "relay-user-fxa-uid"

    def _setup_client(self, token: str) -> None:
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def tearDown(self) -> None:
        cache.clear()

    @responses.activate
    def test_201_new_user_created_and_202_user_exists(self) -> None:
        email = "user@email.com"
        user_token = "user-123"
        self._setup_client(user_token)
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            200, {"active": True, "sub": self.uid, "exp": exp_time}
        )
        # setup fxa profile response
        profile_json = {
            "email": email,
            "amrValues": ["pwd", "email"],
            "twoFactorAuthentication": False,
            "metricsEnabled": True,
            "uid": self.uid,
            "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
            "avatarDefault": False,
        }
        responses.add(
            responses.GET,
            FXA_PROFILE_URL,
            status=200,
            json=profile_json,
        )
        cache_key = get_cache_key(user_token)

        # get fxa response with 201 response for new user and profile created
        response = self.client.post(self.path)
        assert response.status_code == 201
        assert hasattr(response, "data")
        assert response.data is None
        # ensure no session cookie was set
        assert len(response.cookies.keys()) == 1
        assert "csrftoken" in response.cookies
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(cache_key) == fxa_response
        assert SocialAccount.objects.filter(user__email=email).count() == 1
        assert Profile.objects.filter(user__email=email).count() == 1
        assert Profile.objects.get(user__email=email).created_by == "firefox_resource"

        # now check that the 2nd call returns 202
        response = self.client.post(self.path)
        assert response.status_code == 202
        assert hasattr(response, "data")
        assert response.data is None
        assert responses.assert_call_count(self.fxa_verify_path, 2) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True

    @responses.activate
    def test_failed_profile_fetch_for_new_user_returns_500(self) -> None:
        user_token = "user-123"
        self._setup_client(user_token)
        now_time = int(datetime.now().timestamp())
        exp_time = (now_time + 60 * 60) * 1000
        _setup_fxa_response(200, {"active": True, "sub": self.uid, "exp": exp_time})
        # FxA profile server is down
        responses.add(responses.GET, FXA_PROFILE_URL, status=502, body="")
        response = self.client.post(self.path)

        assert response.status_code == 500
        assert response.json()["detail"] == (
            "Did not receive a 200 response for account profile."
        )

    def test_no_authorization_header_returns_400(self) -> None:
        client = APIClient()
        response = client.post(self.path)

        assert response.status_code == 400
        assert response.json()["detail"] == "Missing Bearer header."

    def test_no_token_returns_400(self) -> None:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer ")
        response = client.post(self.path)

        assert response.status_code == 400
        assert response.json()["detail"] == "Missing FXA Token after 'Bearer'."

    @responses.activate
    def test_invalid_bearer_token_error_from_fxa_returns_500_and_cache_returns_500(
        self,
    ) -> None:
        _setup_fxa_response(401, {"error": "401"})
        not_found_token = "not-found-123"
        self._setup_client(not_found_token)

        assert cache.get(get_cache_key(not_found_token)) is None

        response = self.client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_jsondecodeerror_returns_401_and_cache_returns_500(
        self,
    ) -> None:
        _setup_fxa_response(200)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        self._setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        response = self.client.post(self.path)
        assert response.status_code == 401
        assert (
            response.json()["detail"] == "Jsondecodeerror From Fxa Introspect Response"
        )
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_non_200_response_from_fxa_returns_500_and_cache_returns_500(
        self,
    ) -> None:
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        _setup_fxa_response(401, {"active": False, "sub": self.uid, "exp": exp_time})
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        self._setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with non-200 response for the first time
        response = self.client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_inactive_fxa_oauth_token_returns_401_and_cache_returns_401(
        self,
    ) -> None:
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        old_exp_time = (now_time - 60 * 60) * 1000
        _setup_fxa_response(
            200, {"active": False, "sub": self.uid, "exp": old_exp_time}
        )
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        self._setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        response = self.client.post(self.path)
        assert response.status_code == 401
        assert response.json()["detail"] == "Fxa Returned Active: False For Token."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_fxa_responds_with_no_fxa_uid_returns_404_and_cache_returns_404(
        self,
    ) -> None:
        user_token = "user-123"
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        _setup_fxa_response(200, {"active": True, "exp": exp_time})
        cache_key = get_cache_key(user_token)
        self._setup_client(user_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        response = self.client.post(self.path)
        assert response.status_code == 404
        assert response.json()["detail"] == "FXA did not return an FXA UID."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True


def _setup_client(token: str) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@responses.activate
@pytest.mark.usefixtures("fxa_social_app")
def test_duplicate_email_logs_details_for_debugging(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR)
    uid = "relay-user-fxa-uid"
    email = "user@email.com"
    baker.make(EmailAddress, email=email, verified=True)
    user_token = "user-123"
    client = _setup_client(user_token)
    now_time = int(datetime.now().timestamp())
    # Note: FXA iat and exp are timestamps in *milliseconds*
    exp_time = (now_time + 60 * 60) * 1000
    _setup_fxa_response(200, {"active": True, "sub": uid, "exp": exp_time})
    # setup fxa profile response
    profile_json = {
        "email": email,
        "amrValues": ["pwd", "email"],
        "twoFactorAuthentication": False,
        "metricsEnabled": True,
        "uid": uid,
        "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
        "avatarDefault": False,
    }
    responses.add(
        responses.GET,
        FXA_PROFILE_URL,
        status=200,
        json=profile_json,
    )

    response = client.post("/api/v1/terms-accepted-user/")

    assert response.status_code == 500
    (rec1,) = caplog.records
    rec1_extra = log_extra(rec1)
    assert "socialaccount_signup" in rec1.message
    assert rec1_extra.get("fxa_uid") == uid
    assert rec1_extra.get("social_login_state") == {}
