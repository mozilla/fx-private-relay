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


def test_one_account_with_phones_checked_1_day_ago(phone_user):
    profile = Profile.objects.get(user=phone_user)
    pre_update_datetime = datetime.now(timezone.utc) - timedelta(1)
    profile.date_phone_subscription_checked = pre_update_datetime
    profile.save()

    updated_profiles = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_checked == pre_update_datetime
    assert len(updated_profiles) == 0


def test_one_account_with_phones_checked_31_day_ago_no_relay_number(phone_user):
    profile = Profile.objects.get(user=phone_user)
    pre_update_datetime = datetime.now(timezone.utc) - timedelta(31)
    profile.date_phone_subscription_checked = pre_update_datetime
    profile.save()

    with patch(
        "privaterelay.management.commands.update_phone_remaining_stats.update_fxa"
    ):
        updated_profiles = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert (
        profile.date_phone_subscription_checked.date()
        == datetime.now(timezone.utc).today().date()
    )
    assert len(updated_profiles) == 1
    assert profile in updated_profiles


def test_one_account_with_phones_checked_31_day_ago_with_relay_number(phone_user):
    profile = Profile.objects.get(user=phone_user)
    pre_update_datetime = datetime.now(timezone.utc) - timedelta(31)
    profile.date_phone_subscription_checked = pre_update_datetime
    profile.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)
    relay_number.remaining_texts = 6
    relay_number.remaining_minutes = 25
    relay_number.save()

    with patch(
        "privaterelay.management.commands.update_phone_remaining_stats.update_fxa"
    ):
        updated_profiles = update_phone_remaining_stats()

    profile.refresh_from_db()
    relay_number.refresh_from_db()
    assert profile.date_phone_subscription_checked >= pre_update_datetime
    assert len(updated_profiles) == 1
    assert profile in updated_profiles
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_minutes == settings.MAX_MINUTES_PER_BILLING_CYCLE
