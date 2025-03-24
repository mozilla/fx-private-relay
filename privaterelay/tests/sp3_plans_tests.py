"""
Tests for privaterelay/sp3_plans.py
"""

import pytest

from privaterelay.sp3_plans import (
    CountryStr,  # for type annotation
    _cached_country_language_mapping,
    get_sp3_country_language_mapping,
    get_subscription_url,
)


# Fixture to set SP3 settings; these can be overridden by individual tests
@pytest.fixture(autouse=True)
def sp3_plan_settings(settings):
    settings.USE_SUBPLAT3 = True
    settings.SUBPLAT3_HOST = "https://payments-test.example.com"
    settings.SUBPLAT3_PREMIUM_PRODUCT_KEY = "premium-key"
    settings.SUBPLAT3_PHONES_PRODUCT_KEY = "phones-key"
    settings.SUBPLAT3_BUNDLE_PRODUCT_KEY = "bundle-key"
    return settings


@pytest.mark.parametrize(
    "plan, period, expected_product_key",
    [
        ("premium", "monthly", "premium-key"),
        ("premium", "yearly", "premium-key"),
        ("phones", "monthly", "phones-key"),
        ("phones", "yearly", "phones-key"),
        ("bundle", "monthly", "bundle-key"),
        ("bundle", "yearly", "bundle-key"),
    ],
)
def test_get_subscription_url_parametrized(
    settings, plan, period, expected_product_key
):
    """
    Test that get_subscription_url produces the correct URL for each plan and period.
    """
    expected_url = f"{settings.SUBPLAT3_HOST}/{expected_product_key}/{period}/landing"
    url = get_subscription_url(plan, period)
    assert url == expected_url


@pytest.mark.parametrize(
    "key1, key2, label1, label2",
    [
        (
            "SUBPLAT3_PREMIUM_PRODUCT_KEY",
            "SUBPLAT3_PHONES_PRODUCT_KEY",
            "Premium",
            "Phones",
        ),
        (
            "SUBPLAT3_PREMIUM_PRODUCT_KEY",
            "SUBPLAT3_BUNDLE_PRODUCT_KEY",
            "Premium",
            "Bundle",
        ),
        (
            "SUBPLAT3_PHONES_PRODUCT_KEY",
            "SUBPLAT3_BUNDLE_PRODUCT_KEY",
            "Phones",
            "Bundle",
        ),
    ],
)
def test_sp3_product_keys_are_different(settings, key1, key2, label1, label2):
    """Test that the two SP3 product keys are different."""
    key_val1 = getattr(settings, key1)
    key_val2 = getattr(settings, key2)
    assert key_val1 != key_val2, f"{label1} and {label2} product keys should differ"


@pytest.mark.parametrize(
    "plan, setting_attr, new_key",
    [
        ("premium", "SUBPLAT3_PREMIUM_PRODUCT_KEY", "new-premium-key"),
        ("phones", "SUBPLAT3_PHONES_PRODUCT_KEY", "new-phones-key"),
        ("bundle", "SUBPLAT3_BUNDLE_PRODUCT_KEY", "new-bundle-key"),
    ],
)
def test_sp3_overrides_parametrized(settings, plan, setting_attr, new_key):
    """
    Test that overriding the SP3 product keys in settings updates the subscription URLs.
    Since the mapping is cached, we clear the cache after overriding.
    """
    setattr(settings, setting_attr, new_key)
    _cached_country_language_mapping.cache_clear()
    mapping = get_sp3_country_language_mapping(plan)
    country: CountryStr = "US"
    expected_url = f"{settings.SUBPLAT3_HOST}/{new_key}/monthly/landing"
    assert mapping[country]["*"]["monthly"]["url"] == expected_url


@pytest.mark.parametrize(
    "plan, expected_product_key, expected_monthly_price, expected_yearly_price",
    [
        ("premium", "premium-key", 1.99, 0.99),
        ("phones", "phones-key", 4.99, 3.99),
        ("bundle", "bundle-key", 6.99, 6.99),
    ],
)
def test_sp3_country_language_mapping_parametrized(
    settings, plan, expected_product_key, expected_monthly_price, expected_yearly_price
):
    """
    For each plan type, verify that for country 'US' the generated URLs and pricing
    match the settings.
    """
    _cached_country_language_mapping.cache_clear()
    mapping = get_sp3_country_language_mapping(plan)
    country: CountryStr = "US"
    plan_mapping = mapping[country]["*"]
    expected_monthly_url = (
        f"{settings.SUBPLAT3_HOST}/{expected_product_key}/monthly/landing"
    )
    expected_yearly_url = (
        f"{settings.SUBPLAT3_HOST}/{expected_product_key}/yearly/landing"
    )
    assert plan_mapping["monthly"]["url"] == expected_monthly_url
    assert plan_mapping["yearly"]["url"] == expected_yearly_url
    assert plan_mapping["monthly"]["price"] == expected_monthly_price
    assert plan_mapping["yearly"]["price"] == expected_yearly_price
    # All SP3 plans use USD for US.
    assert plan_mapping["monthly"]["currency"] == "USD"
    assert plan_mapping["yearly"]["currency"] == "USD"
