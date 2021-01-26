from datetime import datetime, timezone
import json
import os
from unittest import skip

from django.conf import settings
from django.contrib.auth.models import User
from django.test import Client, TestCase

from model_bakery import baker


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
