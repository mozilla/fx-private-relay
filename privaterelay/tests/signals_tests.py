from collections.abc import Iterator
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.contrib.sessions.middleware import SessionMiddleware
from django.http.request import HttpRequest
from django.http.response import HttpResponse
from django.test import TestCase
from django.test.client import RequestFactory

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

from emails.tests.models_tests import (
    make_free_test_user,
    make_premium_test_user,
    premium_subscription,
)
from privaterelay.models import Subscription
from privaterelay.signals import record_user_signed_up


@pytest.fixture()
def mock_ses_client() -> Iterator[Mock]:
    with patch("emails.apps.EmailsConfig.ses_client") as mock_ses_client:
        yield mock_ses_client


@pytest.mark.django_db
def test_record_user_signed_up_telemetry() -> None:
    user = baker.make(User)
    rf = RequestFactory()
    sign_up_request = rf.get(
        "/accounts/fxa/login/callback/?code=test&state=test&action=signin"
    )

    def get_response(_: HttpRequest) -> HttpResponse:
        return HttpResponse("200 OK")

    middleware = SessionMiddleware(get_response)
    middleware.process_request(sign_up_request)
    record_user_signed_up(sign_up_request, user)

    assert sign_up_request.session["user_created"] is True
    assert sign_up_request.session.modified is True


class UpdateUserSubscriptionReceiverTest(TestCase):
    """Test SocialAccount post_save signal handler"""

    def test_new_user(self) -> None:
        user = make_free_test_user()

        subscription = Subscription.objects.get(user=user)
        assert subscription.names == ""

    def test_new_user_w_preimum(self) -> None:
        premium_user = make_premium_test_user()

        social_account = SocialAccount.objects.get(user=premium_user)
        user_subscriptions = social_account.extra_data.get("subscriptions", [])
        expected_subscriptions = ",".join(user_subscriptions)
        subscription = Subscription.objects.get(user=premium_user)
        assert subscription.names == f"{expected_subscriptions},"

    def test_user_upgraded_to_preimum(self) -> None:
        user = make_free_test_user()

        social_account = SocialAccount.objects.get(user=user)
        subscription = Subscription.objects.get(user=user)
        assert subscription.names == ""

        random_sub = premium_subscription()
        social_account.extra_data["subscriptions"] = [random_sub]
        social_account.save()

        subscription.refresh_from_db()
        assert subscription.names == f"{random_sub},"

    def test_user_downgraded_to_preimum(self) -> None:
        premium_user = make_premium_test_user()

        social_account = SocialAccount.objects.get(user=premium_user)
        user_subscriptions = social_account.extra_data.get("subscriptions", [])
        expected_subscriptions = ",".join(user_subscriptions)
        subscription = Subscription.objects.get(user=premium_user)
        assert subscription.names == f"{expected_subscriptions},"

        social_account.extra_data["subscriptions"] = []
        social_account.save()
        subscription.refresh_from_db()
        assert subscription.names == ""
