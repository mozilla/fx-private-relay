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

from model_bakery import baker

from emails.models import (
    address_hash,
    DeletedAddress,
    RelayAddress,
)
from emails.views import _get_address

TEST_DOMAINS = {'RELAY_FIREFOX_DOMAIN': 'default.com', 'MOZMAIL_DOMAIN': 'test.com'}


def _get_bounce_payload(bounce_type):
    f_path = (
        'emails/tests/fixtures/relay-bounce-%s-notification.json' %
        bounce_type
    )
    with open(os.path.join(settings.BASE_DIR, f_path), 'r') as f:
        return json.load(f)


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

    # @patch('emails.utils.get_email_domain_from_settings')
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

    @patch('emails.models.DOMAINS', TEST_DOMAINS)
    @patch('emails.views.get_domains_from_settings')
    @override_settings(TEST_MOZMAIL=True)
    def test_get_address_with_relay_address(self, domains_mocked):
        domains_mocked.return_value = TEST_DOMAINS
        local_portion = 'foo'
        relay_address = baker.make(RelayAddress, address=local_portion)

        actual = _get_address(
            to_address=f'{self.local_portion}@{self.service_domain}',
            local_portion=f'{self.local_portion}',
            domain_portion=f'{self.service_domain}'
        )
        assert actual == relay_address

    @patch('emails.models.DOMAINS', TEST_DOMAINS)
    @patch('emails.views.incr_if_enabled')
    @patch('emails.views.get_domains_from_settings')
    def test_get_address_with_deleted_relay_address(self, domains_mocked, incr_mocked):
        domains_mocked.return_value = TEST_DOMAINS
        hashed_address = address_hash(self.local_portion, domain=self.service_domain)
        baker.make(DeletedAddress, address_hash=hashed_address)

        try:
            _get_address(
                to_address=f'{self.local_portion}@{self.service_domain}',
                local_portion=self.local_portion,
                domain_portion=self.service_domain
            )
        except Exception as e:
            assert e.args[0] == 'Address does not exist'
            incr_mocked.assert_called_once_with('email_for_deleted_address', 1)

    @patch('emails.models.DOMAINS', TEST_DOMAINS)
    @patch('emails.views.get_domains_from_settings')
    @patch('emails.views.incr_if_enabled')
    @patch('emails.views.logger')
    def test_get_address_with_relay_address_does_not_exist(
        self, logging_mocked, incr_mocked, domains_mocked
    ):
        domains_mocked.return_value = TEST_DOMAINS
        try:
            _get_address(
                to_address=f'{self.local_portion}@{self.service_domain}',
                local_portion={self.local_portion},
                domain_portion=f'{self.service_domain}'
            )
        except Exception as e:
            assert e.args[0] == 'Address does not exist'
            incr_mocked.assert_called_once_with('email_for_unknown_address', 1)

    @patch('emails.models.DOMAINS', TEST_DOMAINS)
    @patch('emails.views.incr_if_enabled')
    @patch('emails.views.get_domains_from_settings')
    def test_get_address_with_deleted_relay_address_multiple(self, domains_mocked, incr_mocked):
        domains_mocked.return_value = TEST_DOMAINS
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
            assert e.args[0] == 'Address does not exist'
            incr_mocked.assert_called_once_with('email_for_deleted_address_multiple', 1)
