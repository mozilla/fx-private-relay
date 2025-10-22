"""
Tests for private_relay/management/commands/cleanup_data.py
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from waffle.models import Flag

from privaterelay.management.commands.update_phone_remaining_stats import (
    update_phone_remaining_stats,
)

if settings.PHONES_ENABLED:
    from api.tests.phones_views_tests import mocked_twilio_client  # noqa: F401
    from phones.models import RealPhone, RelayNumber
    from phones.tests.models_tests import make_phone_test_user

pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


MOCK_BASE = "privaterelay.management.commands.update_phone_remaining_stats"
UPDATE_COMMAND = "update_phone_remaining_stats"


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
    Selectively patch datetime.now() for emails models

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


@pytest.fixture
def mock_free_phones_user(db: None) -> User:
    user = baker.make(User)
    baker.make(SocialAccount, user=user, provider="fxa")
    baker.make(Flag, name="free_phones")
    free_phones_flag = Flag.objects.get(name="free_phones")
    free_phones_flag.users.add(user)
    return user


def _make_used_relay_number(user):
    baker.make(RealPhone, user=user, verified=True)
    relay_number = baker.make(
        RelayNumber, user=user, remaining_texts=10, remaining_seconds=15
    )
    return relay_number


def test_free_phone_user_with_no_date_phone_subscription_reset_gets_phone_limits_updated(  # noqa: E501
    patch_datetime_now: datetime, mock_free_phones_user: User
) -> None:
    relay_number = _make_used_relay_number(mock_free_phones_user)
    expected_now = patch_datetime_now
    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile = mock_free_phones_user.profile
    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_free_phone_user_with_no_date_phone_subscription_end_does_not_get_reset_date_updated(  # noqa: E501
    patch_datetime_now: datetime, mock_free_phones_user: User
) -> None:
    relay_number = _make_used_relay_number(mock_free_phones_user)
    expected_now = patch_datetime_now
    profile = mock_free_phones_user.profile
    profile.date_phone_subscription_reset = expected_now - timedelta(15)
    profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now - timedelta(15)
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 0
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == 10
    assert relay_number.remaining_seconds == 15


def test_free_phone_user_with_no_date_phone_subscription_end_phone_limits_updated(  # noqa: E501
    patch_datetime_now: datetime, mock_free_phones_user: User
) -> None:
    relay_number = _make_used_relay_number(mock_free_phones_user)
    expected_now = patch_datetime_now
    profile = mock_free_phones_user.profile
    profile.date_phone_subscription_reset = expected_now - timedelta(45)
    profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    profile.refresh_from_db()
    assert profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_subscribed_3_day_ago_wo_date_phone_subscription_reset_does_phone_limits_updated(  # noqa: E501
    patch_datetime_now: datetime, phone_user: User
) -> None:
    # any users phone users whose date_phone_subscription_reset was not set
    # will get their limits reset and reset date set today
    expected_now = patch_datetime_now
    phone_user.profile.date_subscribed_phone = expected_now - timedelta(3)
    phone_user.profile.save()
    relay_number = _make_used_relay_number(phone_user)

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_w_phones_reset_1_day_ago_does_not_update_stats(
    patch_datetime_now: datetime, phone_user: User
) -> None:
    expected_now = patch_datetime_now
    reset_datetime = expected_now - timedelta(1)
    phone_user.profile.date_phone_subscription_reset = reset_datetime
    phone_user.profile.save()
    relay_number = _make_used_relay_number(phone_user)

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == reset_datetime
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 0
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == 10
    assert relay_number.remaining_seconds == 15


def test_phone_subscriber_wo_date_phone_subscription_reset_and_no_relay_number_reset_date_updated(  # noqa: E501
    patch_datetime_now: datetime, phone_user: User
) -> None:
    expected_now = patch_datetime_now

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1


def test_phone_subscriber_w_date_phone_subscription_reset_31_days_ago_and_no_relay_number_reset_date_updated(  # noqa: E501
    patch_datetime_now: datetime, phone_user: User
) -> None:
    expected_now = patch_datetime_now
    phone_user.profile.date_phone_subscription_reset = expected_now - timedelta(31)
    phone_user.profile.save()

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.profile.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1


def test_phone_subscriber_with_phones_reset_31_day_ago_phone_limits_updated(
    patch_datetime_now: datetime, phone_user: User
) -> None:
    expected_now = patch_datetime_now
    phone_user.profile.date_phone_subscription_reset = expected_now - timedelta(31)
    phone_user.profile.save()
    relay_number = _make_used_relay_number(phone_user)

    num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_minutes == settings.MAX_MINUTES_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_with_subscription_end_date_sooner_than_31_days_since_reset_phone_limits_updated(  # noqa: E501
    phone_user: User,
) -> None:
    datetime_now = datetime.now(UTC)
    datetime_first_of_march = datetime_now.replace(month=3, day=1)
    phone_user.profile.date_subscribed_phone = datetime_now.replace(month=1, day=1)
    new_subscription_start_and_previous_reset_date = datetime_now.replace(
        month=2, day=1
    )
    phone_user.profile.date_phone_subscription_start = (
        new_subscription_start_and_previous_reset_date
    )
    phone_user.profile.date_phone_subscription_end = datetime_first_of_march
    phone_user.profile.date_phone_subscription_reset = (
        new_subscription_start_and_previous_reset_date
    )
    phone_user.profile.save()
    relay_number = _make_used_relay_number(phone_user)

    # today needs to be pinned to Mar 1-3 to check that the subscription end date was
    # used instead of calculated reset date
    with patch(f"{MOCK_BASE}.datetime") as mocked_datetime:
        mocked_datetime.combine.return_value = datetime.combine(
            datetime_first_of_march.date(), datetime.min.time()
        )
        mocked_datetime.now.return_value = datetime_first_of_march
        mocked_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == datetime_first_of_march
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE
    assert relay_number.remaining_minutes == settings.MAX_MINUTES_PER_BILLING_CYCLE
    assert relay_number.remaining_seconds == settings.MAX_MINUTES_PER_BILLING_CYCLE * 60


def test_phone_subscriber_with_subscription_end_date_after_reset_phone_limits_updated(
    phone_user: User,
) -> None:
    datetime_now = datetime.now(UTC)
    datetime_fourth_of_march = datetime_now.replace(month=3, day=4)
    phone_user.profile.date_subscribed_phone = datetime_now.replace(month=1, day=2)
    new_subscription_start_and_previous_reset_date = datetime_now.replace(
        month=2, day=1
    )
    phone_user.profile.date_phone_subscription_start = (
        new_subscription_start_and_previous_reset_date
    )
    phone_user.profile.date_phone_subscription_end = datetime_fourth_of_march
    phone_user.profile.date_phone_subscription_reset = (
        new_subscription_start_and_previous_reset_date
    )
    phone_user.profile.save()
    relay_number = _make_used_relay_number(phone_user)

    # today must be after march 3rd, to use the calculated reset date
    # (subscription end date >= calculated_next_reset_date)
    with patch(f"{MOCK_BASE}.datetime") as mocked_datetime:
        mocked_datetime.combine.return_value = datetime.combine(
            datetime_fourth_of_march.date(), datetime.min.time()
        )
        mocked_datetime.now.return_value = datetime_fourth_of_march
        mocked_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == datetime_fourth_of_march
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == settings.MAX_TEXTS_PER_BILLING_CYCLE


@pytest.mark.django_db
def test_update_user_with_command(
    capsys: pytest.CaptureFixture[str],
    patch_datetime_now: datetime,
    phone_user: User,
) -> None:
    expected_now = patch_datetime_now
    phone_user.profile.date_phone_subscription_reset = expected_now - timedelta(31)
    phone_user.profile.save()
    _make_used_relay_number(phone_user)

    call_command(UPDATE_COMMAND)
    rawout, err = capsys.readouterr()

    out = rawout.split(" ")
    num_profiles_w_phones, num_profiles_updated = int(out[2]), int(out[4])

    phone_user.refresh_from_db()
    assert phone_user.profile.date_phone_subscription_reset == expected_now
    assert num_profiles_w_phones == 1
    assert num_profiles_updated == 1


@pytest.mark.django_db
def test_update_phones_command(
    capsys,
):
    call_command(UPDATE_COMMAND)
    out, err = capsys.readouterr()

    out = out.split(" ")
    # dependent on the string outputted from executing the command.
    num_profiles_w_phones, num_profiles_updated = int(out[2]), int(out[4])

    assert num_profiles_w_phones == 0
    assert num_profiles_updated == 0
