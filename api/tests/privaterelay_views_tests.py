"""Tests for api/views/email_views.py"""

import logging
from typing import Any
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.http import HttpRequest
from django.test import TestCase
from django.test.client import Client
from django.urls import reverse

import pytest
import responses
from allauth.account.models import EmailAddress
from allauth.socialaccount.internal.flows.signup import process_auto_signup
from allauth.socialaccount.models import SocialAccount, SocialLogin
from model_bakery import baker
from requests import ReadTimeout
from rest_framework.test import APIClient

from api.authentication import get_cache_key
from api.tests.authentication_tests import setup_fxa_introspect
from api.views.privaterelay import FXA_PROFILE_URL, _get_fxa_profile_from_bearer_token
from privaterelay.models import Profile
from privaterelay.tests.utils import log_extra


@pytest.mark.django_db
def test_runtime_data(client: Client) -> None:
    path = "/api/v1/runtime_data/"
    response = client.get(path)
    assert response.status_code == 200


def test_patch_premium_user_subdomain_cannot_be_changed(
    premium_user: User, prem_api_client: Client
) -> None:
    """A premium user should not be able to edit their subdomain."""
    premium_profile = premium_user.profile
    original_subdomain = "helloworld"
    premium_profile.subdomain = original_subdomain
    premium_profile.save()

    new_subdomain = "helloworldd"
    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={"subdomain": new_subdomain},
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert ret_data.get("subdomain", [""])[0] == "This field is read only"
    assert premium_profile.subdomain == original_subdomain
    assert response.status_code == 400


def test_patch_profile_fields_are_read_only_by_default(
    premium_user: User, prem_api_client: Client
) -> None:
    """
    A field in the Profile model should be read only by default, and return a 400
    response code (see StrictReadOnlyFieldsMixin in api/serializers/__init__.py), if it
    is not mentioned in the ProfileSerializer class fields.

    Two fields were tested, num_address_deleted, and sent_welcome_email to see if the
    behavior matches what is described here:
    https://www.django-rest-framework.org/api-guide/serializers/#specifying-read-only-fields
    """
    premium_profile = premium_user.profile
    expected_num_address_deleted = premium_profile.num_address_deleted
    expected_sent_welcome_email = premium_profile.sent_welcome_email

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={
            "num_address_deleted": 5,
            "sent_welcome_email": True,
        },
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert premium_profile.num_address_deleted == expected_num_address_deleted
    assert premium_profile.sent_welcome_email == expected_sent_welcome_email
    assert ret_data.get("sent_welcome_email", [""])[0] == "This field is read only"
    assert ret_data.get("num_address_deleted", [""])[0] == "This field is read only"
    assert response.status_code == 400


def test_profile_non_read_only_fields_update_correctly(
    premium_user: User, prem_api_client: Client
) -> None:
    """
    A field that is not read only should update correctly on a patch request.

    "Not read only" meaning that it was defined in the serializers fields, but not
    read_only_fields.
    """
    premium_profile = premium_user.profile
    old_onboarding_state = premium_profile.onboarding_state
    old_email_tracker_remove_value = premium_profile.remove_level_one_email_trackers

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={
            "onboarding_state": 1,
            "remove_level_one_email_trackers": True,
        },
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert (
        ret_data.get("remove_level_one_email_trackers", None)
        != old_email_tracker_remove_value
    )
    assert (
        premium_profile.remove_level_one_email_trackers
        != old_email_tracker_remove_value
    )
    assert premium_profile.remove_level_one_email_trackers is True
    assert ret_data.get("remove_level_one_email_trackers", None) is True
    assert ret_data.get("onboarding_state", None) != old_onboarding_state
    assert premium_profile.onboarding_state == 1
    assert ret_data.get("onboarding_state", None) == 1
    assert response.status_code == 200


def test_profile_patch_with_model_and_serializer_fields(
    premium_user: User, prem_api_client: Client
) -> None:
    premium_profile = premium_user.profile

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={"subdomain": "vanilla", "num_address_deleted": 5},
        format="json",
    )

    premium_profile.refresh_from_db()

    assert response.status_code == 400
    assert premium_profile.subdomain != "vanilla"
    assert premium_profile.num_address_deleted == 0


def test_profile_patch_with_non_read_only_and_read_only_fields(
    premium_user, prem_api_client
):
    """A request that includes at least one read only field will give a 400 response"""
    premium_profile = premium_user.profile
    old_onboarding_state = premium_profile.onboarding_state

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={"onboarding_state": 1, "subdomain": "vanilla"},
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert premium_profile.onboarding_state == old_onboarding_state
    assert ret_data.get("subdomain", [""])[0] == "This field is read only"
    assert response.status_code == 400


def test_profile_patch_fields_that_dont_exist(
    premium_user: User, prem_api_client: Client
) -> None:
    """
    A request sent with only fields that don't exist give a 200 response (this is the
    default behavior django provides, we decided to leave it as is)
    """
    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_user.profile.id]),
        data={
            "nonsense": False,
            "blabla": "blabla",
        },
        format="json",
    )

    assert response.status_code == 200


def _setup_client(token: str) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _mock_fxa_profile_response(
    status_code: int = 200,
    email: str = "user@example.com",
    uid: str = "a-relay-uid",
    metrics_enabled: bool = True,
    timeout: bool = False,
) -> responses.BaseResponse:
    """Setup Mozilla Accounts profile response"""
    if status_code == 502:
        # FxA profile server is down
        return responses.add(responses.GET, FXA_PROFILE_URL, status=200, body="")
    elif timeout:
        return responses.add(
            responses.GET, FXA_PROFILE_URL, body=ReadTimeout("FxA is slow today")
        )

    profile_json = {
        "email": email,
        "amrValues": ["pwd", "email"],
        "twoFactorAuthentication": False,
        "metricsEnabled": metrics_enabled,
        "uid": uid,
        "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
        "avatarDefault": False,
    }
    return responses.add(
        responses.GET,
        FXA_PROFILE_URL,
        status=status_code,
        json=profile_json,
    )


@pytest.mark.usefixtures("fxa_social_app")
class TermsAcceptedUserViewTest(TestCase):
    path = "/api/v1/terms-accepted-user/"
    uid = "relay-user-fxa-uid"

    def tearDown(self) -> None:
        cache.clear()

    @responses.activate
    def test_201_new_user_created_and_202_user_exists(self) -> None:
        email = "user@email.com"
        user_token = "user-123"
        client = _setup_client(user_token)
        introspect_response, introspect_data = setup_fxa_introspect(uid=self.uid)
        profile_response = _mock_fxa_profile_response(email=email, uid=self.uid)
        cache_key = get_cache_key(user_token)

        # get fxa response with 201 response for new user and profile created
        response = client.post(self.path)
        assert response.status_code == 201
        assert hasattr(response, "data")
        assert response.data is None
        # ensure no session cookie was set
        assert len(response.cookies.keys()) == 1
        assert "csrftoken" in response.cookies
        assert introspect_response.call_count == 1
        assert profile_response.call_count == 1
        assert cache.get(cache_key) == introspect_data
        assert SocialAccount.objects.filter(user__email=email).count() == 1
        assert Profile.objects.filter(user__email=email).count() == 1
        assert Profile.objects.get(user__email=email).created_by == "firefox_resource"

        # now check that the 2nd call returns 202
        response2 = client.post(self.path)
        assert response2.status_code == 202
        assert hasattr(response2, "data")
        assert response2.data is None
        assert introspect_response.call_count == 2
        assert profile_response.call_count == 1

    @responses.activate
    def test_account_created_during_request_returns_500(self) -> None:
        """
        If the SocialAccount is created while creating a new user, return 500

        MPP-3505: Previously raised Unhandled IntegrityError
        """
        email = "user@email.com"
        user_token = "user-123"
        client = _setup_client(user_token)
        introspect_response, _ = setup_fxa_introspect(uid=self.uid)
        profile_response = _mock_fxa_profile_response(email=email, uid=self.uid)

        def process_auto_signup_then_create_account(
            request: HttpRequest, social_login: SocialLogin
        ) -> tuple[bool, None]:
            """Create a duplicate SocialAccount after an email check"""
            auto_signup, response = process_auto_signup(request, social_login)
            assert auto_signup is True
            assert response is None
            user = User.objects.create(email=email)
            user.profile.created_by = "mocked_function"
            user.profile.save()
            SocialAccount.objects.create(provider="fxa", uid=self.uid, user=user)
            return auto_signup, response

        with patch(
            "allauth.socialaccount.internal.flows.signup.process_auto_signup",
            side_effect=process_auto_signup_then_create_account,
        ) as mock_process_signup:
            response = client.post(self.path)
        assert response.status_code == 500
        mock_process_signup.assert_called_once()
        assert introspect_response.call_count == 1
        assert profile_response.call_count == 1

    @responses.activate
    def test_failed_profile_fetch_for_new_user_returns_500(self) -> None:
        user_token = "user-123"
        client = _setup_client(user_token)
        introspect_response, _ = setup_fxa_introspect(uid=self.uid)
        # FxA profile server is down
        profile_response = _mock_fxa_profile_response(status_code=502)
        response = client.post(self.path)

        assert response.status_code == 500
        assert response.json()["detail"] == (
            "Did not receive a 200 response for account profile."
        )
        assert introspect_response.call_count == 1
        assert profile_response.call_count == 1

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
    def test_invalid_bearer_token_error_from_fxa_returns_500_and_is_not_cached(
        self,
    ) -> None:
        introspect_response, _ = setup_fxa_introspect(401, error="401")
        not_found_token = "not-found-123"
        client = _setup_client(not_found_token)

        assert cache.get(get_cache_key(not_found_token)) is None

        response = client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert introspect_response.call_count == 1
        assert cache.get(get_cache_key(not_found_token)) is None

    @responses.activate
    def test_jsondecodeerror_returns_401_and_is_not_cached(self) -> None:
        introspect_response, _ = setup_fxa_introspect(200, no_body=True)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        client = _setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        response = client.post(self.path)
        assert response.status_code == 401
        expected_detail = "Jsondecodeerror From Fxa Introspect Response"
        assert response.json()["detail"] == expected_detail
        assert introspect_response.call_count == 1
        assert cache.get(cache_key) is None

    @responses.activate
    def test_non_200_response_from_fxa_returns_500_and_is_not_cached(self) -> None:
        introspect_response, _ = setup_fxa_introspect(401, active=False, uid=self.uid)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        client = _setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with non-200 response for the first time
        response = client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert introspect_response.call_count == 1
        assert cache.get(cache_key) is None

    @responses.activate
    def test_inactive_fxa_oauth_token_returns_401_and_is_not_cached(self) -> None:
        introspect_response, _ = setup_fxa_introspect(active=False, uid=self.uid)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        client = _setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        response = client.post(self.path)
        assert response.status_code == 401
        assert response.json()["detail"] == "Fxa Returned Active: False For Token."
        assert introspect_response.call_count == 1
        assert cache.get(cache_key) is None

    @responses.activate
    def test_fxa_responds_with_no_fxa_uid_returns_404_and_is_not_cached(self) -> None:
        user_token = "user-123"
        introspect_response, _ = setup_fxa_introspect(uid=None)
        cache_key = get_cache_key(user_token)
        client = _setup_client(user_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        response = client.post(self.path)
        assert response.status_code == 404
        assert response.json()["detail"] == "FXA did not return an FXA UID."
        assert introspect_response.call_count == 1
        assert cache.get(cache_key) is None

    @responses.activate
    def test_socialaccount_created_during_fxa_profile_fetch(self) -> None:
        user_token = "user-123"
        email = "user@slow.example.com"
        introspect_response, expected_data = setup_fxa_introspect(uid=self.uid)
        profile_response = _mock_fxa_profile_response(email=email, uid=self.uid)
        cache_key = get_cache_key(user_token)
        client = _setup_client(user_token)

        assert cache.get(cache_key) is None

        def get_profile_then_create_socialaccount(
            token: str,
        ) -> tuple[dict[str, Any], None]:
            fxa_profile, error_rsp = _get_fxa_profile_from_bearer_token(token)
            assert isinstance(fxa_profile, dict)
            assert error_rsp is None
            user = User.objects.create(email=email)
            user.profile.created_by = "mocked_function"
            user.profile.save()
            SocialAccount.objects.create(provider="fxa", uid=self.uid, user=user)
            return fxa_profile, error_rsp

        with patch(
            "api.views.privaterelay._get_fxa_profile_from_bearer_token",
            side_effect=get_profile_then_create_socialaccount,
        ):
            response = client.post(self.path)
        assert response.status_code == 202
        assert cache.get(cache_key) == expected_data
        assert introspect_response.call_count == 1
        assert profile_response.call_count == 1

    @responses.activate
    def test_fxa_introspect_fetch_timeout_returns_401(self) -> None:
        slow_token = "slow-123"
        email = "user@slow.example.com"
        introspect_response, expected_data = setup_fxa_introspect(timeout=True)
        profile_response = _mock_fxa_profile_response(email=email, uid=self.uid)
        cache_key = get_cache_key(slow_token)
        client = _setup_client(slow_token)

        assert cache.get(cache_key) is None

        response = client.post(self.path)
        assert response.status_code == 401
        assert cache.get(cache_key) is None
        assert introspect_response.call_count == 1
        assert profile_response.call_count == 0

    @responses.activate
    def test_fxa_profile_fetch_timeout_returns_503(self) -> None:
        slow_token = "user-123"
        introspect_response, expected_data = setup_fxa_introspect(uid=self.uid)
        profile_response = _mock_fxa_profile_response(timeout=True)
        cache_key = get_cache_key(slow_token)
        client = _setup_client(slow_token)

        assert cache.get(cache_key) is None

        response = client.post(self.path)
        assert response.status_code == 503
        assert cache.get(cache_key) == expected_data
        assert introspect_response.call_count == 1
        assert profile_response.call_count == 1


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
    introspect_response, _ = setup_fxa_introspect(uid=uid)
    profile_response = _mock_fxa_profile_response(email=email, uid=uid)

    response = client.post("/api/v1/terms-accepted-user/")

    assert response.status_code == 500
    (rec1,) = caplog.records
    rec1_extra = log_extra(rec1)
    assert "socialaccount_signup" in rec1.message
    assert rec1_extra.get("fxa_uid") == uid
    assert rec1_extra.get("social_login_state") == {}
    assert introspect_response.call_count == 1
    assert profile_response.call_count == 1


@responses.activate
@pytest.mark.usefixtures("fxa_social_app")
def test_metrics_disabled_user_fxa_uid_not_logged(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR)
    uid = "relay-user-fxa-uid"
    email = "user@email.com"
    baker.make(EmailAddress, email=email, verified=True)
    user_token = "user-123"
    client = _setup_client(user_token)
    introspect_response, _ = setup_fxa_introspect(uid=uid)
    profile_response = _mock_fxa_profile_response(
        email=email, uid=uid, metrics_enabled=False
    )

    response = client.post("/api/v1/terms-accepted-user/")

    assert response.status_code == 500
    (rec1,) = caplog.records
    assert "fxa_uid" not in log_extra(rec1)
    assert introspect_response.call_count == 1
    assert profile_response.call_count == 1
