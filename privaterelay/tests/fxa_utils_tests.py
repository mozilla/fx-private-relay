"""
Tests for private_relay/fxa_utils.py
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from django.conf import settings

import pytest
from allauth.socialaccount.models import SocialAccount
from waffle.testutils import override_flag, override_switch

from privaterelay.fxa_utils import (
    get_phone_subscription_dates,
    get_subscription_data_from_fxa,
)

if settings.PHONES_ENABLED:
    from phones.tests.models_tests import make_phone_test_user

MOCK_BASE = "privaterelay.fxa_utils"


def _call_get_subscription_data(mock_session: MagicMock) -> str:
    """Set up mocks and call get_subscription_data_from_fxa. Return the URL called."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"subscriptions": []}
    mock_client = MagicMock()
    mock_client.get.return_value = mock_resp
    mock_session.return_value = mock_client

    sa = MagicMock(spec=SocialAccount)
    get_subscription_data_from_fxa(sa)

    called_url: str = mock_client.get.call_args[0][0]
    return called_url


@pytest.mark.django_db
@override_switch("use_subplat_billing_api", active=True)
@patch(f"{MOCK_BASE}._get_oauth2_session")
def test_get_subscription_data_uses_subplat_api_when_switch_active(
    mock_session: MagicMock,
) -> None:
    called_url = _call_get_subscription_data(mock_session)
    assert called_url == settings.SUBPLAT_API_ENDPOINT + "/billing-and-subscriptions"


@pytest.mark.django_db
@override_switch("use_subplat_billing_api", active=False)
@patch(f"{MOCK_BASE}._get_oauth2_session")
def test_get_subscription_data_uses_fxa_when_switch_inactive(
    mock_session: MagicMock,
) -> None:
    called_url = _call_get_subscription_data(mock_session)
    expected = (
        settings.FXA_ACCOUNTS_ENDPOINT
        + "/oauth/mozilla-subscriptions/customer/billing-and-subscriptions"
    )
    assert called_url == expected


_phones_skip = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


@pytest.fixture()
def phone_user(db):
    yield make_phone_test_user()


@_phones_skip
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


@_phones_skip
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


@_phones_skip
@override_flag("free_phones", active=True)
@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_not_in_data_has_free_phone(
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
    mocked_logger.assert_not_called()


@_phones_skip
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
    # Sample subscription data from
    # https://mozilla.sentry.io/issues/4062336484/events/b798a75eb05c4f67937309bf8148ab8e/?project=4503976951152641
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


@_phones_skip
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


@_phones_skip
@patch(f"{MOCK_BASE}.get_subscription_data_from_fxa")
@patch(f"{MOCK_BASE}.logger.error")
def test_get_phone_subscription_dates_subscription_has_phone_subscription_data(
    mocked_logger, mocked_data_from_fxa, phone_user
):
    first_day_this_month = datetime.now(UTC).replace(day=1)
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
    # Sample subscription data from
    # https://mozilla.sentry.io/issues/4062336484/events/b798a75eb05c4f67937309bf8148ab8e/?project=4503976951152641
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
