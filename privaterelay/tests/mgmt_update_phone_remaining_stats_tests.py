"""
Tests for private_relay/management/commands/cleanup_data.py
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest

from django.conf import settings

from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from waffle.models import Flag

pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)

from emails.models import Profile

if settings.PHONES_ENABLED:
    from phones.tests.models_tests import make_phone_test_user
    from phones.models import RealPhone, RelayNumber

from api.tests.phones_views_tests import (
    _make_real_phone,
    _make_relay_number,
    mocked_twilio_client,
)
from ..management.commands.update_phone_remaining_stats import (
    update_phone_remaining_stats,
)


MOCK_BASE = "privaterelay.management.commands.update_phone_remaining_stats"


@pytest.fixture()
def phone_user(db):
    yield make_phone_test_user()


def test_no_accounts_with_phones(db):
    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()
    assert num_profiles_w_phones == 0
    assert num_profiles_updated == 0


@pytest.fixture
def patch_datetime_now():
    """
    Selectively patch datatime.now() for emails models

    https://docs.python.org/3/library/unittest.mock-examples.html#partial-mocking
    """
    with patch(f"{MOCK_BASE}.datetime") as mocked_datetime:
        expected_now = datetime.now(timezone.utc)
        mocked_datetime.combine.return_value = datetime.combine(
            expected_now.date(), datetime.min.time()
        )
        mocked_datetime.now.return_value = expected_now
        mocked_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        yield expected_now


@pytest.fixture
def mock_free_phones_profile():
    account = baker.make(SocialAccount, provider="fxa")
    profile = Profile.objects.get(user=account.user)
    baker.make(Flag, name="free_phones")
    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    free_phones_flag.users.add(profile.user)
    yield profile


def test_free_phone_user_with_no_date_phone_subscription_reset_gets_phone_limits_updated(
    patch_datetime_now, mock_free_phones_profile
):
    profile = mock_free_phones_profile
    baker.make(RealPhone, user=profile.user, verified=True)
    relay_number = baker.make(
        RelayNumber, user=profile.user, remaining_texts=10, remaining_seconds=15
    )
    expected_now = patch_datetime_now
    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_free_phone_user_with_no_date_phone_subscription_end_does_not_get_reset_date_updated(
    patch_datetime_now, mock_free_phones_profile
):
    profile = mock_free_phones_profile
    expected_now = patch_datetime_now
    profile.date_phone_subscription_reset = expected_now - timedelta(15)
    profile.save()
    baker.make(RealPhone, user=profile.user, verified=True)
    relay_number = baker.make(
        RelayNumber, user=profile.user, remaining_texts=10, remaining_seconds=15
    )

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now - timedelta(15)
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 0
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == 10
    assert relay_number.remaining_seconds == 15


def test_free_phone_user_with_no_date_phone_subscription_end_phone_limits_updated(
    patch_datetime_now, mock_free_phones_profile
):
    profile = mock_free_phones_profile
    expected_now = patch_datetime_now
    profile.date_phone_subscription_reset = expected_now - timedelta(45)
    profile.save()
    baker.make(RealPhone, user=profile.user, verified=True)
    relay_number = baker.make(
        RelayNumber, user=profile.user, remaining_texts=10, remaining_seconds=15
    )

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_subscribed_3_day_ago_wo_date_phone_subscription_reset_does_phone_limits_updated(
    patch_datetime_now, phone_user
):
    # any users phone users whose date_phone_subscription_reset was not set
    # will get their limits reset and reset date set today
    expected_now = patch_datetime_now
    profile = Profile.objects.get(user=phone_user)
    profile.date_subscribed_phone = expected_now - timedelta(3)
    profile.save()
    baker.make(RealPhone, user=phone_user, verified=True)
    relay_number = baker.make(
        RelayNumber, user=phone_user, remaining_texts=10, remaining_seconds=15
    )

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_w_phones_reset_1_day_ago_does_not_update_stats(
    patch_datetime_now, phone_user
):
    expected_now = patch_datetime_now
    profile = Profile.objects.get(user=phone_user)
    reset_datetime = expected_now - timedelta(1)
    profile.date_phone_subscription_reset = reset_datetime
    profile.save()
    baker.make(RealPhone, user=phone_user, verified=True)
    relay_number = baker.make(
        RelayNumber, user=phone_user, remaining_texts=10, remaining_seconds=15
    )

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == reset_datetime
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 0
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == 10
    assert relay_number.remaining_seconds == 15


def test_phone_subscriber_wo_date_phone_subscription_reset_and_no_relay_number_reset_date_updated(
    patch_datetime_now, phone_user
):
    expected_now = patch_datetime_now
    profile = Profile.objects.get(user=phone_user)
    profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1


def test_phone_subscriber_w_date_phone_subscription_reset_31_days_ago_and_no_relay_number_reset_date_updated(
    patch_datetime_now, phone_user
):
    expected_now = patch_datetime_now
    profile = Profile.objects.get(user=phone_user)
    profile.date_phone_subscription_reset = expected_now - timedelta(31)
    profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1


def test_phone_subscriber_with_phones_reset_31_day_ago_phone_limits_updated(
    patch_datetime_now, phone_user
):
    expected_now = patch_datetime_now
    profile = Profile.objects.get(user=phone_user)
    profile.date_phone_subscription_reset = expected_now - timedelta(31)
    profile.save()
    _make_real_phone(
        phone_user, verified=True
    )  # update other tests to use this util func
    relay_number = _make_relay_number(phone_user)
    relay_number.remaining_texts = 10
    relay_number.remaining_seconds = 15
    relay_number.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_minutes == settings.MAX_MINUTES_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_with_subscription_end_date_sooner_than_31_days_since_reset_phone_limits_updated(
    patch_datetime_now, phone_user
):
    expected_now = patch_datetime_now
    profile = Profile.objects.get(user=phone_user)
    profile.date_subscribed_phone = expected_now.replace(month=1, day=1)
    new_subscription_start_and_previous_reset_date = expected_now.replace(
        month=2, day=1
    )
    profile.date_phone_subscription_start = (
        new_subscription_start_and_previous_reset_date
    )
    profile.date_phone_subscription_end = expected_now.replace(month=3, day=1)
    profile.date_phone_subscription_reset = (
        new_subscription_start_and_previous_reset_date
    )
    profile.save()
    _make_real_phone(
        phone_user, verified=True
    )  # update other tests to use this util func
    relay_number = _make_relay_number(phone_user)
    relay_number.remaining_texts = 10
    relay_number.remaining_seconds = 15
    relay_number.save()

    # TODO: today needs to be pinned to Mar 1-3 to check that the subscription end date was used
    # instead of calculated reset date
    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_minutes == settings.MAX_MINUTES_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60
