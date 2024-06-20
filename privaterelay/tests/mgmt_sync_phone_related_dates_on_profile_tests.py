"""
Tests for private_relay/management/commands/sync_phone_related_dates_on_profile.py
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from waffle.models import Flag

from privaterelay.management.commands.sync_phone_related_dates_on_profile import (
    sync_phone_related_dates_on_profile,
)

if settings.PHONES_ENABLED:
    from phones.tests.models_tests import make_phone_test_user


pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


MOCK_BASE = "privaterelay.management.commands.sync_phone_related_dates_on_profile"
SYNC_COMMAND = "sync_phone_related_dates_on_profile"


@pytest.fixture()
def phone_user(db: None) -> Iterator[User]:
    yield make_phone_test_user()


def test_no_accounts_with_phones(db: None) -> None:
    num_profiles_updated = sync_phone_related_dates_on_profile("both")
    assert num_profiles_updated == 0


@pytest.fixture
def patch_datetime_now() -> Iterator[datetime]:
    """
    Selectively patch datatime.now() for emails models

    https://docs.python.org/3/library/unittest.mock-examples.html#partial-mocking
    """
    with patch(f"{MOCK_BASE}.datetime") as mocked_datetime:
        expected_now = datetime.now(UTC)
        mocked_datetime.combine.return_value = datetime.combine(
            expected_now.date(), datetime.min.time()
        )
        mocked_datetime.now.return_value = expected_now
        mocked_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        yield expected_now


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
@patch(f"{MOCK_BASE}.logger.error")
def test_phone_subscription_user_with_no_phone_subscription_data_does_not_get_updated(
    mocked_logger: Mock,
    mocked_dates: Mock,
    patch_datetime_now: datetime,
    phone_user: User,
) -> None:
    mocked_dates.return_value = (None, None, None)

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile = phone_user.profile
    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset is None
    assert profile.date_subscribed_phone is None
    assert profile.date_phone_subscription_start is None
    assert profile.date_phone_subscription_end is None
    assert profile.fxa
    assert num_profiles_updated == 0
    mocked_logger.assert_called_once_with(
        "no_subscription_data_in_fxa_for_user_with_phone_subscription",
        extra={"fxa_uid": profile.fxa.uid},
    )


def create_free_phones_flag_for_user(user: User) -> None:
    """
    Create the "free_phones" flag, and add the User to it.

    This is necessary because we use (abuse?) the "free_phones" flag to allow test phone
    accounts in stage and development, and the `override_flag` decorator doesn't work
    because privaterelay.management.utils directly accesses the Flag table for
    efficiency rather than use the django_waffle tools to check flag settings.
    """
    baker.make(Flag, name="free_phones")
    free_phones_flag = Flag.objects.get(name="free_phones")
    free_phones_flag.users.add(user)
    free_phones_flag.save()


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_free_phone_user_gets_only_date_phone_subscription_reset_field_updated(
    mocked_dates, patch_datetime_now, db
):
    expected_now = patch_datetime_now
    mocked_dates.return_value = (None, None, None)
    account: SocialAccount = baker.make(SocialAccount, provider="fxa")
    create_free_phones_flag_for_user(account.user)

    num_profiles_updated = sync_phone_related_dates_on_profile("free")

    profile = account.user.profile
    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now.replace(day=1)
    assert profile.date_subscribed_phone is None
    assert profile.date_phone_subscription_start is None
    assert profile.date_phone_subscription_end is None
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_free_phone_user_with_existing_date_phone_subscription_reset_field_does_not_update(  # noqa: E501
    mocked_dates, patch_datetime_now, db
):
    expected_now = patch_datetime_now
    mocked_dates.return_value = (None, None, None)
    account: SocialAccount = baker.make(SocialAccount, provider="fxa")
    account.user.profile.date_phone_subscription_reset = expected_now
    account.user.profile.save()
    create_free_phones_flag_for_user(account.user)

    num_profiles_updated = sync_phone_related_dates_on_profile("free")

    profile = account.user.profile
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
    date_subscribed_phone = datetime.now(UTC) - timedelta(3)
    phone_user.profile.date_subscribed_phone = date_subscribed_phone
    phone_user.profile.save()
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(30),
    )

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile = phone_user.profile
    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == date_subscribed_phone
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(30)
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_monthly_phone_subscriber_renewed_subscription_profile_date_phone_subscription_start_and_end_updated(  # noqa: E501
    mocked_dates, patch_datetime_now, phone_user
):
    profile = phone_user.profile
    first_day_of_current_month = datetime.now(UTC).replace(day=1)
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
    date_subscribed_phone = datetime.now(UTC) - timedelta(3)
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(365),
    )

    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile = phone_user.profile
    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == date_subscribed_phone
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(365)
    assert num_profiles_updated == 1


@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_yearly_phone_subscriber_with_subscription_date_older_than_31_days_profile_date_fields_all_updated(  # noqa: E501
    mocked_dates, patch_datetime_now, phone_user
):
    date_subscribed_phone = datetime.now(UTC) - timedelta(90)
    phone_user.profile.date_subscribed_phone = date_subscribed_phone
    phone_user.profile.save()
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(365),
    )
    num_profiles_updated = sync_phone_related_dates_on_profile("subscription")

    profile = phone_user.profile
    profile.refresh_from_db()
    sixty_two_days_from_subsciprion_date = date_subscribed_phone + timedelta(62)
    assert profile.date_phone_subscription_reset == sixty_two_days_from_subsciprion_date
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(365)
    assert num_profiles_updated == 1


@pytest.mark.django_db
@patch(f"{MOCK_BASE}.get_phone_subscription_dates")
def test_command_with_one_update(
    mocked_dates,
    patch_datetime_now,
    phone_user,
    capsys,
):
    date_subscribed_phone = datetime.now(UTC)
    phone_user.profile.date_subscribed_phone = date_subscribed_phone
    phone_user.profile.save()
    mocked_dates.return_value = (
        date_subscribed_phone,
        date_subscribed_phone,
        date_subscribed_phone + timedelta(365),
    )
    call_command(SYNC_COMMAND, "--group", "subscription")
    out, err = capsys.readouterr()
    num_profiles_updated = int(out.split(" ")[0])

    profile = phone_user.profile
    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == date_subscribed_phone
    assert profile.date_subscribed_phone == date_subscribed_phone
    assert profile.date_phone_subscription_start == date_subscribed_phone
    assert profile.date_phone_subscription_end == date_subscribed_phone + timedelta(365)
    assert num_profiles_updated == 1


@pytest.mark.django_db
def test_command_sync_phone(
    capsys,
):
    call_command(SYNC_COMMAND, "--group", "free")
    out, err = capsys.readouterr()

    num_profiles_updated = int(out.split(" ")[0])

    assert num_profiles_updated == 0
