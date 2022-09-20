import json
from unittest.mock import call, patch

from django.contrib.auth.models import User
from django.test import TestCase

from allauth.socialaccount.models import SocialAccount
from allauth.account.models import EmailAddress
from model_bakery import baker

from ..views import _update_all_data, NoSocialToken


def test_no_social_token():
    exception = NoSocialToken("account_id")
    assert repr(exception) == 'NoSocialToken("account_id")'
    assert (
        str(exception) == 'NoSocialToken: The SocialAccount "account_id" has no token.'
    )


class UpdateExtraDataAndEmailTest(TestCase):
    def test_update_all_data(self):
        user = baker.make(User)
        ea = baker.make(EmailAddress, user=user)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_extra_data = json.loads('{"test": "updated"}')
        new_email = "newemail@example.com"

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202

        sa.refresh_from_db()
        ea.refresh_from_db()

        assert sa.extra_data == new_extra_data
        assert ea.email == new_email

    @patch("privaterelay.views.incr_if_enabled")
    def test_update_newly_premium(self, incr_mocked):
        user = baker.make(User)
        baker.make(EmailAddress, user=user)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_email = "newemail@example.com"
        new_extra_data = json.loads('{"subscriptions": ["premium-relay"]}')

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202
        sa.refresh_from_db()
        profile = sa.user.profile_set.first()
        assert profile.date_subscribed
        assert sa.extra_data == new_extra_data
        incr_mocked.assert_called_once()

    @patch("privaterelay.views.incr_if_enabled")
    def test_update_newly_phone(self, incr_mocked):
        user = baker.make(User)
        baker.make(EmailAddress, user=user)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_email = "newemail@example.com"
        new_extra_data = json.loads('{"subscriptions": ["relay-phones"]}')

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202
        sa.refresh_from_db()
        profile = sa.user.profile_set.first()
        assert profile.date_subscribed_phone
        assert sa.extra_data == new_extra_data
        incr_mocked.assert_called_once()

    def test_update_all_data_conflict(self):
        extra_data = json.loads('{"test": "test"}')

        user = baker.make(User, email="user@example.com")
        baker.make(EmailAddress, user=user, email="user@example.com")
        baker.make(SocialAccount, user=user, provider="fxa", extra_data=extra_data)

        user2 = baker.make(User, email="user2@example.com")
        ea2 = baker.make(EmailAddress, user=user2, email="user2@example.com")
        sa2 = baker.make(
            SocialAccount, user=user2, provider="fxa", extra_data=extra_data
        )

        new_extra_data = json.loads('{"test": "updated"}')
        new_email = "user@example.com"

        response = _update_all_data(sa2, new_extra_data, new_email)

        assert response.status_code == 409

        sa2.refresh_from_db()
        ea2.refresh_from_db()

        # values should be un-changed because of the dupe error
        assert sa2.extra_data == extra_data
        assert ea2.email == "user2@example.com"
