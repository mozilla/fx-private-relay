from datetime import datetime, timezone
import json
import os
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings, TestCase

from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

from emails.models import (
    address_hash,
    DeletedAddress,
    DomainAddress,
    Profile,
    RelayAddress,
)
from emails.views import _get_address, _sns_notification

from .models_tests import make_premium_test_user

# Load the sns json fixtures from files
real_abs_cwd = os.path.realpath(
    os.path.join(os.getcwd(), os.path.dirname(__file__))
)
single_rec_file = os.path.join(
    real_abs_cwd, 'fixtures', 'single_recipient_sns_body.json'
)

EMAIL_SNS_BODIES = {}
for email_type in [
    'spamVerdict_FAIL', 'single_recipient', 'domain_recipient'
]:
    email_file = os.path.join(
        real_abs_cwd, 'fixtures', '%s_email_sns_body.json' % email_type
    )
    with open(email_file, 'r') as f:
        email_sns_body = json.load(f)
        EMAIL_SNS_BODIES[email_type] = email_sns_body

BOUNCE_SNS_BODIES = {}
for bounce_type in ['soft', 'hard', 'spam']:
    bounce_file = os.path.join(
        real_abs_cwd, 'fixtures', '%s_bounce_sns_body.json' % bounce_type
    )
    with open(bounce_file, 'r') as f:
        bounce_sns_body = json.load(f)
        BOUNCE_SNS_BODIES[bounce_type] = bounce_sns_body


class SNSNotificationTest(TestCase):
    def setUp(self):
        # FIXME: this should make an object so that the test passes
        self.user = baker.make(User)
        self.profile = self.user.profile_set.first()
        self.sa = baker.make(SocialAccount, user=self.user, provider='fxa')
        self.ra = baker.make(
            RelayAddress, user=self.user, address='ebsbdsan7', domain=2
        )
        self.premium_user = make_premium_test_user()
        self.premium_profile = Profile.objects.get(user=self.premium_user)
        self.premium_profile.subdomain = 'subdomain'
        self.premium_profile.save()


    @patch('emails.views.ses_relay_email')
    def test_single_recipient_sns_notification(self, mock_ses_relay_email):
        _sns_notification(EMAIL_SNS_BODIES['single_recipient'])

        mock_ses_relay_email.assert_called_once()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at.date() == datetime.today().date()

    @patch('emails.views.ses_relay_email')
    def test_spamVerdict_FAIL_default_still_relays(self, mock_ses_relay_email):
        # for a default user, spam email will still relay
        _sns_notification(EMAIL_SNS_BODIES['spamVerdict_FAIL'])

        mock_ses_relay_email.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1

    @patch('emails.views.ses_relay_email')
    def test_spamVerdict_FAIL_auto_block_doesnt_relay(self, mock_ses_relay_email):
        # when user has auto_block_spam=True, spam will not relay
        self.profile.auto_block_spam = True
        self.profile.save()

        _sns_notification(EMAIL_SNS_BODIES['spamVerdict_FAIL'])

        mock_ses_relay_email.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0

    @patch('emails.views.ses_relay_email')
    def test_domain_recipient(self, mock_ses_relay_email):
        _sns_notification(EMAIL_SNS_BODIES['domain_recipient'])

        mock_ses_relay_email.assert_called_once()
        da = DomainAddress.objects.get(
            user=self.premium_user, address='wildcard'
        )
        assert da.num_forwarded == 1
        assert da.last_used_at.date() == datetime.today().date()


class BounceHandlingTest(TestCase):
    def setUp(self):
        self.user = baker.make(
            User, email='relayuser@test.com', make_m2m=True
        )

    def test_sns_message_with_hard_bounce(self):
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES['hard'])

        profile = self.user.profile_set.first()
        assert profile.last_hard_bounce >= pre_request_datetime

    def test_sns_message_with_soft_bounce(self):
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES['soft'])

        profile = self.user.profile_set.first()
        assert profile.last_soft_bounce >= pre_request_datetime

    def test_sns_message_with_spam_bounce_sets_auto_block_spam(self):
        _sns_notification(BOUNCE_SNS_BODIES['spam'])
        profile = self.user.profile_set.first()
        assert profile.auto_block_spam == True


@override_settings(SITE_ORIGIN='https://test.com', ON_HEROKU=False)
class GetAddressTest(TestCase):
    def setUp(self):
        self.service_domain = 'test.com'
        self.local_portion = 'foo'

    @patch('emails.views._get_domain_address')
    def test_get_address_with_domain_address(self, _get_domain_address_mocked):
        expected = 'DomainAddress'
        _get_domain_address_mocked.return_value = expected
        # email_domain_mocked.return_value = service_domain

        actual = _get_address(
            to_address=f'{self.local_portion}@subdomain.{self.service_domain}',
            local_portion=self.local_portion,
            domain_portion=f'subdomain.{self.service_domain}'
        )
        assert actual == expected

    def test_get_address_with_relay_address(self):
        local_portion = 'foo'
        relay_address = baker.make(RelayAddress, address=local_portion)

        actual = _get_address(
            to_address=f'{self.local_portion}@{self.service_domain}',
            local_portion=f'{self.local_portion}',
            domain_portion=f'{self.service_domain}'
        )
        assert actual == relay_address

    @patch('emails.views.incr_if_enabled')
    def test_get_address_with_deleted_relay_address(self, incr_mocked):
        hashed_address = address_hash(self.local_portion, domain=self.service_domain)
        baker.make(DeletedAddress, address_hash=hashed_address)

        try:
            _get_address(
                to_address=f'{self.local_portion}@{self.service_domain}',
                local_portion=self.local_portion,
                domain_portion=self.service_domain
            )
        except Exception as e:
            assert e.args[0] == 'RelayAddress matching query does not exist.'
            incr_mocked.assert_called_once_with('email_for_deleted_address', 1)

    @patch('emails.views.incr_if_enabled')
    @patch('emails.views.logger')
    def test_get_address_with_relay_address_does_not_exist(
        self, logging_mocked, incr_mocked
    ):
        try:
            _get_address(
                to_address=f'{self.local_portion}@{self.service_domain}',
                local_portion={self.local_portion},
                domain_portion=f'{self.service_domain}'
            )
        except Exception as e:
            assert e.args[0] == 'RelayAddress matching query does not exist.'
            incr_mocked.assert_called_once_with('email_for_unknown_address', 1)

    @patch('emails.views.incr_if_enabled')
    def test_get_address_with_deleted_relay_address_multiple(self, incr_mocked):
        hashed_address = address_hash(self.local_portion, domain=self.service_domain)
        baker.make(DeletedAddress, address_hash=hashed_address)
        baker.make(DeletedAddress, address_hash=hashed_address)

        try:
            _get_address(
                to_address=f'{self.local_portion}@{self.service_domain}',
                local_portion=self.local_portion,
                domain_portion=f'{self.service_domain}'
            )
        except Exception as e:
            assert e.args[0] == 'RelayAddress matching query does not exist.'
            incr_mocked.assert_called_once_with('email_for_deleted_address_multiple', 1)
