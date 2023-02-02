"""
Tests for private_relay/management/commands/cleanup_data.py
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest

from django.conf import settings

pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)

from emails.models import Profile

if settings.PHONES_ENABLED:
    from phones.tests.models_tests import make_phone_test_user

from api.tests.phones_views_tests import (
    _make_real_phone,
    _make_relay_number,
    mocked_twilio_client,
)
from ..management.commands.update_phone_remaining_stats import (
    update_phone_remaining_stats,
)


@pytest.fixture()
def phone_user(db):
    yield make_phone_test_user()


def test_no_accounts_with_phones(db):
    update_phone_remaining_stats()


def test_one_account_with_phones_subscribed_3_day_ago_does_not_update_stats(phone_user):
    profile = Profile.objects.get(user=phone_user)
    datetime_now = datetime.now(timezone.utc)
    profile.date_subscribed_phone = datetime_now - timedelta(3)
    profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_checked == None
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 0


def test_one_account_with_phones_checked_1_day_ago_does_not_update_stats(phone_user):
    profile = Profile.objects.get(user=phone_user)
    pre_update_datetime = datetime.now(timezone.utc) - timedelta(1)
    profile.date_phone_subscription_checked = pre_update_datetime
    profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_checked == pre_update_datetime
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 0


@patch(
    "privaterelay.management.commands.update_phone_remaining_stats.get_phone_subscription_dates"
)
def test_one_account_with_phones_checked_31_day_ago_no_relay_number(
    mocked_dates, phone_user
):
    profile = Profile.objects.get(user=phone_user)
    pre_update_datetime = datetime.now(timezone.utc) - timedelta(31)
    profile.date_phone_subscription_checked = pre_update_datetime
    profile.save()
    mocked_dates.return_value = (
        pre_update_datetime,
        pre_update_datetime,
        datetime.now(timezone.utc),
    )

    with patch(
        "privaterelay.management.commands.update_phone_remaining_stats.update_fxa"
    ):
        num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert (
        profile.date_phone_subscription_checked.date()
        == datetime.now(timezone.utc).today().date()
    )
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1


@patch(
    "privaterelay.management.commands.update_phone_remaining_stats.get_phone_subscription_dates"
)
def test_one_account_with_phones_checked_31_day_ago_with_relay_number(
    mocked_dates, phone_user
):
    profile = Profile.objects.get(user=phone_user)
    pre_update_datetime = datetime.now(timezone.utc) - timedelta(31)
    profile.date_phone_subscription_checked = pre_update_datetime
    profile.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)
    relay_number.remaining_texts = 6
    relay_number.remaining_seconds = 25 * 60
    relay_number.save()
    mocked_dates.return_value = (
        pre_update_datetime,
        pre_update_datetime,
        datetime.now(timezone.utc),
    )

    with patch(
        "privaterelay.management.commands.update_phone_remaining_stats.update_fxa"
    ):
        num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    relay_number.refresh_from_db()
    assert profile.date_phone_subscription_checked >= pre_update_datetime
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_minutes == settings.MAX_MINUTES_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60
