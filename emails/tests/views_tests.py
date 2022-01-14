from datetime import datetime, timezone
import json
import os
from unittest import skip
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.test import (
    Client,
    override_settings,
    TestCase,
)

from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

from emails.models import (
    address_hash,
    DeletedAddress,
    RelayAddress,
)
from emails.views import _get_address, _sns_notification


# Load the sns json fixtures from files
real_abs_cwd = os.path.realpath(
    os.path.join(os.getcwd(), os.path.dirname(__file__))
)
single_rec_file = os.path.join(
    real_abs_cwd, 'single_recipient_sns_body.json'
)
with open(single_rec_file, 'r') as f:
    SINGLE_REC_SNS_BODY = json.load(f)


def _get_bounce_payload(bounce_type):
    f_path = (
        'emails/tests/fixtures/relay-bounce-%s-notification.json' %
        bounce_type
    )
    with open(os.path.join(settings.BASE_DIR, f_path), 'r') as f:
        return json.load(f)


class SNSNotificationTest(TestCase):
    def setUp(self):
        # FIXME: this should make an object so that the test passes
        self.user = baker.make(User)
        self.sa = baker.make(SocialAccount, user=self.user, provider='fxa')
        self.ra = baker.make(
            RelayAddress, user=self.user, address='ebsbdsan7', domain=2
        )

    @patch('emails.views.ses_relay_email')
    def test_sns_notification(self, mock_ses_relay_email):
        _sns_notification(SINGLE_REC_SNS_BODY)

        mock_ses_relay_email.assert_called_once()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at.date() == datetime.today().date()


class BounceHandlingTest(TestCase):
    def setUp(self):
        self.user = baker.make(
            User, email='groovetest@protonmail.ch', make_m2m=True
        )
        self.client = Client()

    def _make_bounce_request(self, client, bounce_payload):
        return client.post(
            '/emails/sns-inbound',
            content_type='application/json',
            data=bounce_payload,
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='Notification',
        )

    @skip('need email test fixtures to test; contact groovecoder')
    def test_sns_inbound_with_hard_bounce(self):
        bounce_payload = _get_bounce_payload('hard')
        pre_request_datetime = datetime.now(timezone.utc)

        resp = self._make_bounce_request(self.client, bounce_payload)

        assert resp.status_code == 200
        profile = self.user.profile_set.first()
        assert profile.last_hard_bounce >= pre_request_datetime

    @skip('need email test fixtures to test; contact groovecoder')
    def test_sns_inbound_with_soft_bounce(self):
        bounce_payload = _get_bounce_payload('soft')
        pre_request_datetime = datetime.now(timezone.utc)

        resp = self._make_bounce_request(self.client, bounce_payload)

        assert resp.status_code == 200
        profile = self.user.profile_set.first()
        assert profile.last_soft_bounce >= pre_request_datetime


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
