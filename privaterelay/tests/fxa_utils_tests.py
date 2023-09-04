"""
Tests for private_relay/fxa_utils.py
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.conf import settings

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from waffle.models import Flag

from privaterelay.fxa_utils import get_phone_subscription_dates

pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)

if settings.PHONES_ENABLED:
    from phones.tests.models_tests import make_phone_test_user


MOCK_BASE = "privaterelay.fxa_utils"


@pytest.fixture()
def phone_user(db):
    yield make_phone_test_user()


@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
def test_get_phone_subscription_dates_refreshed_twice(mocked_data_from_fxa, phone_user):
    social_account = SocialAccount.objects.get(user=phone_user)
    mocked_data_from_fxa.return_value = {"social_token": "new token", "refreshed": True}
    (
        date_subscribed_phone,
        date_phone_subscription_start,
        date_phone_subscription_end,
    ) = get_phone_subscription_dates(social_account)

    assert date_subscribed_phone is None
    assert date_phone_subscription_start is None
    assert date_phone_subscription_end is None


@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_not_in_data_no_free_phone(
    mocked_logger, mocked_data_from_fxa, phone_user
):
    social_account = SocialAccount.objects.get(user=phone_user)
    mocked_data_from_fxa.return_value = {"message": "dummy text"}
    (
        date_subscribed_phone,
        date_phone_subscription_start,
        date_phone_subscription_end,
    ) = get_phone_subscription_dates(social_account)

    assert date_subscribed_phone is None
    assert date_phone_subscription_start is None
    assert date_phone_subscription_end is None
    mocked_logger.assert_called_once_with(
        "accounts_subscription_endpoint_failed",
        extra={"fxa_message": "dummy text"},
    )


@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_not_in_data_has_free_phone(
    mocked_logger, mocked_data_from_fxa, phone_user
):
    social_account = SocialAccount.objects.get(user=phone_user)
    baker.make(Flag, name="free_phones")
    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    free_phones_flag.users.add(phone_user)
    free_phones_flag.save()
    mocked_data_from_fxa.return_value = {"message": "dummy text"}
    (
        date_subscribed_phone,
        date_phone_subscription_start,
        date_phone_subscription_end,
    ) = get_phone_subscription_dates(social_account)

    assert date_subscribed_phone is None
    assert date_phone_subscription_start is None
    assert date_phone_subscription_end is None
    mocked_logger.assert_not_called()


@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_not_phones(
    mocked_logger, mocked_data_from_fxa, phone_user
):
    social_account = SocialAccount.objects.get(user=phone_user)
    sample_subscription_data = {
        "_subscription_type": "web",
        "cancel_at_period_end": False,
        "created": 1673427825,
        "current_period_end": 1681203825,
        "current_period_start": 1678525425,
        "end_at": None,
        "latest_invoice": "D861D444-0006",
        "latest_invoice_items": {},
        "plan_id": "price_1J000000000000000000000p",
        "product_id": "prod_notPhone",
        "product_name": "MDN Plus",
    }
    # Sample subscription data from https://mozilla.sentry.io/issues/4062336484/events/b798a75eb05c4f67937309bf8148ab8e/?project=4503976951152641
    mocked_data_from_fxa.return_value = {"subscriptions": [sample_subscription_data]}
    (
        date_subscribed_phone,
        date_phone_subscription_start,
        date_phone_subscription_end,
    ) = get_phone_subscription_dates(social_account)

    assert date_subscribed_phone is None
    assert date_phone_subscription_start is None
    assert date_phone_subscription_end is None
    mocked_logger.assert_not_called()


@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_has_invalid_phone_susbscription_data(
    mocked_logger, mocked_data_from_fxa, phone_user
):
    social_account = SocialAccount.objects.get(user=phone_user)
    sample_subscription_data = {
        "_subscription_type": "web",
        "cancel_at_period_end": False,
        "end_at": None,
        "latest_invoice": "D861D444-0006",
        "latest_invoice_items": {},
        "plan_id": "price_1J000000000000000000000p",
        "product_id": settings.PHONE_PROD_ID,
        "product_name": "Relay Email & Phone Protection",
    }
    mocked_data_from_fxa.return_value = {"subscriptions": [sample_subscription_data]}
    (
        date_subscribed_phone,
        date_phone_subscription_start,
        date_phone_subscription_end,
    ) = get_phone_subscription_dates(social_account)

    assert date_subscribed_phone is None
    assert date_phone_subscription_start is None
    assert date_phone_subscription_end is None
    mocked_logger.assert_called_once_with(
        "accounts_subscription_subscription_date_invalid",
        extra={"subscription": sample_subscription_data},
    )


@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_has_phone_subscription_data(
    mocked_logger, mocked_data_from_fxa, phone_user
):
    first_day_this_month = datetime.now(timezone.utc).replace(day=1)
    first_day_next_month = (first_day_this_month + timedelta(31)).replace(day=1)
    social_account = SocialAccount.objects.get(user=phone_user)
    sample_subscription_data = {
        "_subscription_type": "web",
        "cancel_at_period_end": False,
        "created": first_day_this_month.timestamp(),
        "current_period_end": first_day_next_month.timestamp(),
        "current_period_start": first_day_this_month.timestamp(),
        "end_at": None,
        "latest_invoice": "D861D444-0006",
        "latest_invoice_items": {},
        "plan_id": "price_1J000000000000000000000p",
        "product_id": settings.PHONE_PROD_ID,
        "product_name": "Relay Email & Phone Protection",
    }
    # Sample subscription data from https://mozilla.sentry.io/issues/4062336484/events/b798a75eb05c4f67937309bf8148ab8e/?project=4503976951152641
    mocked_data_from_fxa.return_value = {"subscriptions": [sample_subscription_data]}
    (
        date_subscribed_phone,
        date_phone_subscription_start,
        date_phone_subscription_end,
    ) = get_phone_subscription_dates(social_account)

    assert date_subscribed_phone == first_day_this_month
    assert date_phone_subscription_start == first_day_this_month
    assert date_phone_subscription_end == first_day_next_month
    mocked_logger.assert_not_called()
