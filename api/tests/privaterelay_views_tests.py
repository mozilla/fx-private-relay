"""Tests for api/views/privaterelay_views.py"""

import json
from unittest.mock import patch

from django.conf import LazySettings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.http import HttpRequest
from django.test.client import Client
from django.urls import reverse

import pytest
import responses
from allauth.socialaccount.internal.flows.signup import process_auto_signup
from allauth.socialaccount.models import SocialAccount, SocialLogin
from requests import PreparedRequest
from requests.exceptions import Timeout
from rest_framework.test import APIClient, APITestCase
from waffle.testutils import override_flag

from api.authentication import INTROSPECT_TOKEN_URL, get_cache_key
from api.tests.authentication_tests import (
    create_fxa_introspect_data,
    setup_fxa_introspection_failure,
    setup_fxa_introspection_response,
)
from api.views.privaterelay import FXA_PROFILE_URL
from privaterelay.models import Profile


@pytest.mark.django_db
def test_runtime_data_response_structure(client: Client) -> None:
    """Test that runtime_data returns the expected structure."""
    path = "/api/v1/runtime_data/"
    response = client.get(path)

    assert response.status_code == 200
    data = response.json()

    # Check that all expected keys are present
    expected_keys = [
        "FXA_ORIGIN",
        "PERIODICAL_PREMIUM_PRODUCT_ID",
        "GOOGLE_ANALYTICS_ID",
        "GA4_MEASUREMENT_ID",
        "BUNDLE_PRODUCT_ID",
        "MEGABUNDLE_PRODUCT_ID",
        "PHONE_PRODUCT_ID",
        "PERIODICAL_PREMIUM_PLANS",
        "PHONE_PLANS",
        "BUNDLE_PLANS",
        "BASKET_ORIGIN",
        "WAFFLE_FLAGS",
        "WAFFLE_SWITCHES",
        "WAFFLE_SAMPLES",
        "MAX_MINUTES_TO_VERIFY_REAL_PHONE",
        "MAX_NUM_FREE_ALIASES",
    ]

    for key in expected_keys:
        assert key in data, f"Expected key {key} missing from response"

    # Check that plans data is present
    assert isinstance(data["PERIODICAL_PREMIUM_PLANS"], dict)
    assert isinstance(data["PHONE_PLANS"], dict)
    assert isinstance(data["BUNDLE_PLANS"], dict)


@pytest.mark.django_db
def test_runtime_data_mask_limit_with_flag(
    client: Client, settings: LazySettings
) -> None:
    """Test that MAX_NUM_FREE_ALIASES respects the increased_free_mask_limit flag."""
    path = "/api/v1/runtime_data/"

    # Without flag, should return standard limit
    response = client.get(path)
    assert response.status_code == 200
    data = response.json()
    assert data["MAX_NUM_FREE_ALIASES"] == settings.MAX_NUM_FREE_ALIASES

    # With flag enabled, should return increased limit
    with override_flag("increased_free_mask_limit", active=True):
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data["MAX_NUM_FREE_ALIASES"] == settings.INCREASED_MAX_NUM_FREE_ALIASES


@pytest.mark.django_db
@pytest.mark.parametrize("use_subplat3", [True, False])
def test_runtime_data_uses_correct_plan_mapping(
    client: Client, settings: LazySettings, use_subplat3: bool
) -> None:
    """
    Test that runtime_data uses the correct plan mapping based on
    USE_SUBPLAT3 setting.
    """
    settings.USE_SUBPLAT3 = use_subplat3

    path = "/api/v1/runtime_data/"
    response = client.get(path)

    assert response.status_code == 200
    data = response.json()

    # Check that the correct plan data is returned
    if use_subplat3:
        # Check for SP3 plan data
        assert (
            "url"
            in data["PERIODICAL_PREMIUM_PLANS"]["plan_country_lang_mapping"]["US"]["*"][
                "monthly"
            ]
        )
        assert (
            "url"
            in data["PHONE_PLANS"]["plan_country_lang_mapping"]["US"]["*"]["monthly"]
        )
        assert (
            "url"
            in data["BUNDLE_PLANS"]["plan_country_lang_mapping"]["US"]["*"]["yearly"]
        )
    else:
        # Check for regular plan data
        assert (
            "id"
            in data["PERIODICAL_PREMIUM_PLANS"]["plan_country_lang_mapping"]["US"]["*"][
                "monthly"
            ]
        )
        assert (
            "id"
            in data["PHONE_PLANS"]["plan_country_lang_mapping"]["US"]["*"]["monthly"]
        )
        assert (
            "id"
            in data["BUNDLE_PLANS"]["plan_country_lang_mapping"]["US"]["*"]["yearly"]
        )


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


@pytest.mark.usefixtures("fxa_social_app")
class TermsAcceptedUserViewTest(APITestCase):
    path = "/api/v1/terms-accepted-user/"
    uid = "relay-user-fxa-uid"
    token = "the-test-token"
    cache_key = get_cache_key(token)
    email = "user@email.com"
    fxa_profile_data = {
        "email": email,
        "amrValues": ["pwd", "email"],
        "twoFactorAuthentication": False,
        "metricsEnabled": True,
        "uid": uid,
        "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
        "avatarDefault": False,
    }

    def setUp(self) -> None:
        cache.delete(self.cache_key)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def tearDown(self) -> None:
        cache.clear()

    @responses.activate
    def test_201_new_user_created_and_202_user_exists(self) -> None:
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_response = setup_fxa_introspection_response(fxa_introspect_data)
        # setup fxa profile response
        responses.get(FXA_PROFILE_URL, status=200, json=self.fxa_profile_data)

        # get fxa response with 201 response for new user and profile created
        response = self.client.post(self.path)
        assert response.status_code == 201
        assert hasattr(response, "data")
        assert response.data is None
        # ensure no session cookie was set
        assert len(response.cookies.keys()) == 1
        assert "csrftoken" in response.cookies
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(self.cache_key) == fxa_response
        assert SocialAccount.objects.filter(user__email=self.email).count() == 1
        profile = Profile.objects.get(user__email=self.email)
        assert profile.created_by == "firefox_resource"

        # now check that the 2nd call returns 202
        response = self.client.post(self.path)
        assert response.status_code == 202
        assert hasattr(response, "data")
        assert response.data is None
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 2) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True

    @responses.activate
    def test_failed_profile_fetch_for_new_user_returns_500(self) -> None:
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        setup_fxa_introspection_response(fxa_introspect_data)
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
    def test_invalid_bearer_token_error_from_fxa_returns_500(self) -> None:
        setup_fxa_introspection_failure(status_code=401, json={"error": "401"})

        response = self.client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_jsondecodeerror_returns_401(self) -> None:
        setup_fxa_introspection_failure(status_code=200, json=None)

        # get fxa response with no status code for the first time
        response = self.client.post(self.path)
        assert response.status_code == 401
        assert (
            response.json()["detail"] == "Jsondecodeerror From Fxa Introspect Response"
        )
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_non_200_response_from_fxa_returns_500(self) -> None:
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        setup_fxa_introspection_failure(status_code=401, json=fxa_introspect_data)

        # get fxa response with non-200 response for the first time
        response = self.client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_inactive_fxa_oauth_token_returns_401(self) -> None:
        fxa_introspect_data = create_fxa_introspect_data(active=False, sub=self.uid)
        setup_fxa_introspection_response(fxa_introspect_data)

        # get fxa response with token inactive for the first time
        response = self.client.post(self.path)
        assert response.status_code == 401
        assert response.json()["detail"] == "Fxa Returned Active: False For Token."
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_fxa_responds_with_no_fxa_uid_returns_404(self) -> None:
        fxa_introspect_data = create_fxa_introspect_data(no_sub=True)
        setup_fxa_introspection_response(fxa_introspect_data)

        # get fxa response with no fxa uid for the first time
        response = self.client.post(self.path)
        assert response.status_code == 404
        assert response.json()["detail"] == "FXA did not return an FXA UID."
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True

    @responses.activate
    def test_profile_request_timeout_returns_500(self) -> None:
        """If the profile request times out, return 500."""
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_introspect_resp = setup_fxa_introspection_response(fxa_introspect_data)
        responses.add(responses.GET, FXA_PROFILE_URL, body=Timeout("so slow"))

        response = self.client.post(self.path)

        assert response.status_code == 500
        assert hasattr(response, "data")
        assert response.data == {
            "detail": "Timeout waiting for a response for account profile."
        }
        assert cache.get(self.cache_key) == fxa_introspect_resp
        assert len(response.cookies.keys()) == 0
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(self.cache_key) == fxa_introspect_resp

    @responses.activate
    def test_account_created_during_profile_request_returns_201(self) -> None:
        """
        If the SocialAccount is created during the profile request, returns created.

        We'd expect the existing Profile to have a blank `created_by` field. However,
        when the SocialAccount is created during the profile request, the `created_by`
        field is set to "firefox_resource", as if the user, profile, and social
        account were created by requesting the terms-accepted-user endpoint.
        """
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_introspect_resp = setup_fxa_introspection_response(fxa_introspect_data)

        def create_account_during_profile_request(
            request: PreparedRequest,
        ) -> tuple[int, dict[str, str], str]:
            """Create a duplicate SocialAccount during the profile request"""
            user = User.objects.create(email=self.email)
            user.profile.created_by = "mocked_function"
            user.profile.save()
            SocialAccount.objects.create(provider="fxa", uid=self.uid, user=user)
            return (200, {}, json.dumps(self.fxa_profile_data))

        responses.add_callback(
            responses.GET,
            FXA_PROFILE_URL,
            callback=create_account_during_profile_request,
            content_type="application/json",
        )

        response = self.client.post(self.path)

        assert response.status_code == 201
        assert hasattr(response, "data")
        assert response.data is None
        # ensure no session cookie was set
        assert len(response.cookies.keys()) == 1
        assert "csrftoken" in response.cookies
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(self.cache_key) == fxa_introspect_resp
        assert SocialAccount.objects.filter(user__email=self.email).count() == 1
        profile = Profile.objects.get(user__email=self.email)
        assert profile.created_by == "firefox_resource"  # Overwritten by our code

    @responses.activate
    def test_account_created_after_user_check_returns_500(self) -> None:
        """
        If a parallel process creates a user that django-allauth misses, return 500

        If the user is created after the django-allauth `process_auto_signup` check,
        then a duplicate user is created with the same email, a duplicate profile,
        etc. It then fails with an IntegrityError when attempting to create the
        SocialAccount. This exception is caught, changes are rolled back, and the
        view returns 500.
        """
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_introspect_resp = setup_fxa_introspection_response(fxa_introspect_data)
        responses.get(FXA_PROFILE_URL, status=200, json=self.fxa_profile_data)

        def process_auto_signup_then_create_account(
            request: HttpRequest, social_login: SocialLogin
        ) -> tuple[bool, None]:
            """Run process_auto_signup, then create the user"""
            auto_signup, response = process_auto_signup(request, social_login)
            assert auto_signup is True  # Detects new user creation
            assert response is None

            user = User.objects.create(email=self.email)
            user.profile.created_by = "mocked_function"
            user.profile.save(update_fields=["created_by"])
            SocialAccount.objects.create(provider="fxa", uid=self.uid, user=user)

            return auto_signup, response

        with patch(
            "allauth.socialaccount.internal.flows.signup.process_auto_signup",
            side_effect=process_auto_signup_then_create_account,
        ) as mock_process_signup:
            response = self.client.post(self.path)

        mock_process_signup.assert_called_once()
        assert response.status_code == 500
        assert hasattr(response, "data")
        assert response.data == {
            "detail": "Error setting up Relay user, please try again."
        }
        assert cache.get(self.cache_key) == fxa_introspect_resp
        assert len(response.cookies.keys()) == 0
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(self.cache_key) == fxa_introspect_resp

        # Testing limitation: colliding user is rolledback as well
        # In running deployment, new user is present for next call
        assert not SocialAccount.objects.filter(user__email=self.email).exists()
        assert not User.objects.filter(email=self.email).exists()
        assert not Profile.objects.filter(user__email=self.email).exists()

    @responses.activate
    def test_account_created_before_user_check_returns_500(self) -> None:
        """
        If a parallel process creates a user that django-allauth detects, return 500.

        If the user is created before django-allauth `process_auto_signup` check,
        then it determines an existing user is adding a social login, and redirects
        them to `socialaccount_signup`. Since we have no view for that, it raises
        NoReverseMatch. This exception is caught, changes are rolled back, and
        the view returns 500
        """
        fxa_introspect_data = create_fxa_introspect_data(sub=self.uid)
        fxa_introspect_resp = setup_fxa_introspection_response(fxa_introspect_data)
        responses.get(FXA_PROFILE_URL, status=200, json=self.fxa_profile_data)

        def create_account_then_process_auto_signup(
            request: HttpRequest, social_login: SocialLogin
        ) -> tuple[bool, None]:
            """Create an existing user, then continue with process_auto_signup"""
            user = User.objects.create(email=self.email)
            user.profile.created_by = "mocked_function"
            user.profile.save(update_fields=["created_by"])
            SocialAccount.objects.create(provider="fxa", uid=self.uid, user=user)

            auto_signup, response = process_auto_signup(request, social_login)
            assert auto_signup is False  # Can't auto-create a new user
            assert response is None
            return auto_signup, response

        with patch(
            "allauth.socialaccount.internal.flows.signup.process_auto_signup",
            side_effect=create_account_then_process_auto_signup,
        ) as mock_process_signup:
            response = self.client.post(self.path)

        mock_process_signup.assert_called_once()
        assert response.status_code == 500
        assert hasattr(response, "data")
        assert response.data == {
            "detail": "Error setting up Relay user, please try again."
        }
        assert cache.get(self.cache_key) == fxa_introspect_resp
        assert len(response.cookies.keys()) == 0
        assert responses.assert_call_count(INTROSPECT_TOKEN_URL, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(self.cache_key) == fxa_introspect_resp

        # Testing limitation: colliding user is rolledback as well
        # In running deployment, new user is present for next call
        assert not SocialAccount.objects.filter(user__email=self.email).exists()
        assert not User.objects.filter(email=self.email).exists()
        assert not Profile.objects.filter(user__email=self.email).exists()
