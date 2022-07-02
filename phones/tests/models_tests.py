from datetime import datetime, timedelta, timezone
import random
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import BadRequest
from django.test.testcases import TestCase

from allauth.socialaccount.models import SocialAccount, SocialToken
from model_bakery import baker
import pytest

from emails.models import Profile
from ..models import (
    MAX_MINUTES_TO_VERIFY_REAL_PHONE,
    RealPhone,
    get_expired_unverified_realphone_records
)


MOCK_BASE = "phones.models"

def fake_phones_config():
    """
    Return a mock version of phones app config with a fake twilio client.
    """
    phones_config = Mock(
        spec_set=("twilio_client", "twilio_test_client", "twilio_validator")
    )
    return phones_config


@pytest.fixture(autouse=True)
def mocked_apps():
    """
    Mock django apps to return a phones app config with a mock twilio client
    """
    with patch(f"{MOCK_BASE}.apps") as mock_apps:
        mock_apps.get_app_config = fake_phones_config()
        yield mock_apps


def make_phone_test_user():
    phone_user = baker.make(User)
    phone_user_profile = Profile.objects.get(user=phone_user)
    phone_user_profile.server_storage = True
    phone_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    phone_user_profile.save()
    upgrade_test_user_to_phone(phone_user)
    return phone_user


def upgrade_test_user_to_phone(user):
    random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_PHONE.split(","))
    account = baker.make(
        SocialAccount,
        user=user,
        provider="fxa",
        extra_data={"avatar": "avatar.png", "subscriptions": [random_sub]},
    )
    baker.make(
        SocialToken,
        account=account,
        expires_at=datetime.now(timezone.utc) + timedelta(1)
    )
    return user


class RealPhoneTest(TestCase):
    def setUp(self):
        self.phone_user = make_phone_test_user()

    def test_create_second_number_for_user_raises_exception(self):
        RealPhone.objects.create(
            user=self.phone_user, verified=True, number="+12223334444"
        )
        try:
            RealPhone.objects.create(
                user=self.phone_user, number="+12223335555"
            )
        except BadRequest:
            return
        self.fail("Should have raised BadRequest exception")

    def test_create_deletes_expired_unverified_records(self):
        # create an expired unverified record
        number = "+12223334444"
        RealPhone.objects.create(
            user=self.phone_user,
            number=number,
            verified=False,
            verification_sent_date=(
                datetime.now(timezone.utc) -
                timedelta(0, 60*MAX_MINUTES_TO_VERIFY_REAL_PHONE+1)
            )
        )
        expired_verification_records = (
            get_expired_unverified_realphone_records(number)
        )
        assert len(expired_verification_records) >= 1
        RealPhone.objects.create(
            user=baker.make(User),
            number=number
        )
        expired_verification_records = (
            get_expired_unverified_realphone_records(number)
        )
        assert len(expired_verification_records) == 0

    def test_mark_verified_sets_verified_and_date(self):
        real_phone = RealPhone.objects.create(
            user=self.phone_user,
            verified=False
        )
        real_phone.mark_verified()
        assert real_phone.verified
        assert real_phone.verified_date
