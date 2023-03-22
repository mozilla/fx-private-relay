"""
Tests for private_relay/management/commands/sync_phone_related_dates_on_profile.py
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

from privaterelay.management.commands.sync_phone_related_dates_on_profile import (
    sync_phone_related_dates_on_profile,
)


MOCK_BASE = "privaterelay.management.commands.sync_phone_related_dates_on_profile"


@pytest.fixture()
def phone_user(db):
    yield make_phone_test_user()


def test_no_accounts_with_phones(db):
    num_profiles_updated = sync_phone_related_dates_on_profile("both")
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


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
@patch(f"{MOCK_BASE}.logger.error")
def test_phone_subscription_user_with_no_phone_subscription_data_does_not_get_updated(
    mocked_logger, mocked_dates, patch_datetime_now, phone_user
):
    mocked_dates.return_value = (None, None, None)
    profile = Profile.objects.get(user=phone_user)

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset is None
    assert profile.date_subscribed_phone is None
    assert profile.date_phone_subscription_start is None
    assert profile.date_phone_subscription_end is None
    assert num_profiles_updated == 0
    mocked_logger.assert_called_once_with(
        "no_subscription_data_in_fxa_for_user_with_phone_subscription",
        extra={"fxa_uid": profile.fxa.uid},
    )


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_free_phone_user_gets_only_date_phone_subscription_reset_field_updated(
    mocked_dates, patch_datetime_now, db
):
    expected_now = patch_datetime_now
    mocked_dates.return_value = (None, None, None)
    account = baker.make(SocialAccount, provider="fxa")
    profile = Profile.objects.get(user=account.user)
    baker.make(Flag, name="free_phones")
    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    free_phones_flag.users.add(profile.user)
    free_phones_flag.save()

    num_profiles_updated = sync_phone_related_dates_on_profile("free")

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now.replace(day=1)
    assert profile.date_subscribed_phone is None
    assert profile.date_phone_subscription_start is None
    assert profile.date_phone_subscription_end is None
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_free_phone_user_with_existing_date_phone_subscription_reset_field_does_not_update(
    mocked_dates, patch_datetime_now, db
):
    expected_now = patch_datetime_now
    mocked_dates.return_value = (None, None, None)
    account = baker.make(SocialAccount, provider="fxa")
    profile = Profile.objects.get(user=account.user)
    profile.date_phone_subscription_reset = expected_now
    baker.make(Flag, name="free_phones")
    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    free_phones_flag.users.add(profile.user)
    profile.save()
    free_phones_flag.save()

    num_profiles_updated = sync_phone_related_dates_on_profile("free")

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert profile.date_subscribed_phone is None
    assert profile.date_phone_subscription_start is None
    assert profile.date_phone_subscription_end is None
    assert num_profiles_updated == 0


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_monthly_phone_subscriber_profile_date_fields_all_updated(
    mocked_dates, patch_datetime_now, phone_user
):
    profile = Profile.objects.get(user=phone_user)
    date_subscribed_phone = datetime.now(timezone.utc) - timedelta(3)
    profile.date_subscribed_phone = date_subscribed_phone
    profile.save()
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(30),
    )

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == date_subscribed_phone
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(30)
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_monthly_phone_subscriber_renewed_subscription_profile_date_phone_subscription_start_and_end_updated(
    mocked_dates, patch_datetime_now, phone_user
):
    profile = Profile.objects.get(user=phone_user)
    first_day_of_current_month = datetime.now(timezone.utc).replace(day=1)
    # get first of the last month
    first_day_of_last_month = (first_day_of_current_month - timedelta(1)).replace(day=1)
    # get first of the next month
    first_day_of_next_month = (first_day_of_current_month + timedelta(31)).replace(
        day=1
    )
    profile.date_subscribed_phone = first_day_of_last_month
    profile.date_phone_subscription_start = first_day_of_last_month
    profile.date_phone_subscription_end = first_day_of_current_month
    # assume that phone limit reset command has not been ran
    profile.date_phone_subscription_reset = first_day_of_current_month
    profile.save()
    mocked_dates.return_value = (
        first_day_of_last_month,
        first_day_of_current_month,
        first_day_of_next_month,
    )

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile.refresh_from_db()
    # dates stayed same
    assert profile.date_phone_subscription_reset == first_day_of_current_month
    assert profile.date_subscribed_phone == first_day_of_last_month
    # dates updated
    assert profile.date_phone_subscription_start == first_day_of_current_month
    assert profile.date_phone_subscription_end == first_day_of_next_month
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_yearly_phone_subscriber_profile_date_fields_all_updated(
    mocked_dates, patch_datetime_now, phone_user
):
    profile = Profile.objects.get(user=phone_user)
    date_subscribed_phone = datetime.now(timezone.utc) - timedelta(3)
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(365),
    )

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == date_subscribed_phone
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(365)
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_yearly_phone_subscriber_with_subscription_date_older_than_31_days_profile_date_fields_all_updated(
    mocked_dates, patch_datetime_now, phone_user
):
    profile = Profile.objects.get(user=phone_user)
    date_subscribed_phone = datetime.now(timezone.utc) - timedelta(90)
    profile.date_subscribed_phone = date_subscribed_phone
    profile.save()
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(365),
    )
    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile.refresh_from_db()
    sixty_two_days_from_subsciprion_date = date_subscribed_phone + timedelta(62)
    assert profile.date_phone_subscription_reset == sixty_two_days_from_subsciprion_date
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(365)
    assert num_profiles_updated == 1
