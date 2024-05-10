from unittest.mock import patch

from django.test import TestCase

from allauth.socialaccount.models import SocialAccount

from emails.tests.models_tests import (
    make_free_test_user,
    make_premium_test_user,
    premium_subscription,
)
from privaterelay.models import (
    update_or_create_subscription,
)


class UpdateOrCreateSubscriptionTest(TestCase):
    """Test update_user_subscription receiver for post_save signal from SocialAccount"""

    def setUp(self) -> None:
        patcher = patch("privaterelay.signals.update_or_create_subscription")
        self.mocked_update_sub = patcher.start()
        self.addCleanup(patcher.stop)

    def test_new_user(self) -> None:
        user = make_free_test_user()

        social_account = SocialAccount.objects.get(user=user)
        subscription = update_or_create_subscription(social_account)
        assert subscription.names == ""
        self.mocked_update_sub.assert_called_once_with(social_account)

    def test_new_user_w_preimum(self) -> None:
        premium_user = make_premium_test_user()
        social_account = SocialAccount.objects.get(user=premium_user)
        user_subscriptions = social_account.extra_data.get("subscriptions", [])
        expected_subscriptions = ",".join(user_subscriptions)
        subscription = update_or_create_subscription(social_account)
        assert subscription.names == f"{expected_subscriptions},"
        self.mocked_update_sub.assert_called_once_with(social_account)

    def test_user_upgraded_to_preimum(self) -> None:
        user = make_free_test_user()
        social_account = SocialAccount.objects.get(user=user)
        subscription = update_or_create_subscription(social_account)
        assert subscription.names == ""

        random_sub = premium_subscription()
        social_account.extra_data["subscriptions"] = [random_sub]
        subscription = update_or_create_subscription(social_account)
        assert subscription.names == f"{random_sub},"
        self.mocked_update_sub.assert_called_once_with(social_account)

    def test_user_downgraded_to_preimum(self) -> None:
        premium_user = make_premium_test_user()
        social_account = SocialAccount.objects.get(user=premium_user)
        user_subscriptions = social_account.extra_data.get("subscriptions", [])
        expected_subscriptions = ",".join(user_subscriptions)
        subscription = update_or_create_subscription(social_account)
        assert subscription.names == f"{expected_subscriptions},"

        social_account.extra_data["subscriptions"] = []
        subscription = update_or_create_subscription(social_account)
        assert subscription.names == ""
        self.mocked_update_sub.assert_called_once_with(social_account)
