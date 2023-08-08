"""Tests for privaterelay/plans.py"""

from pytest_django.fixtures import SettingsWrapper
import pytest

from privaterelay.plans import (
    LanguageStr,
    RelayCountryStr,
    PlanCountryLangMapping,
    get_bundle_country_language_mapping,
    get_phone_country_language_mapping,
    get_premium_countries,
    get_premium_country_language_mapping,
)


@pytest.fixture(autouse=True)
def plan_settings(settings: SettingsWrapper) -> SettingsWrapper:
    """Set price IDs to the production defaults."""
    settings.PREMIUM_PLAN_ID_US_MONTHLY = "price_1LXUcnJNcmPzuWtRpbNOajYS"
    settings.PREMIUM_PLAN_ID_US_YEARLY = "price_1LXUdlJNcmPzuWtRKTYg7mpZ"
    settings.PHONE_PLAN_ID_US_MONTHLY = "price_1Li0w8JNcmPzuWtR2rGU80P3"
    settings.PHONE_PLAN_ID_US_YEARLY = "price_1Li15WJNcmPzuWtRIh0F4VwP"
    settings.BUNDLE_PLAN_ID_US = "price_1LwoSDJNcmPzuWtR6wPJZeoh"
    return settings


_PREMIUM_COUNTRIES = [
    "at",
    "be",
    "bg",
    "ca",
    "ch",
    "cy",
    "cz",
    "de",
    "dk",
    "ee",
    "es",
    "fi",
    "fr",
    "gb",
    "gr",
    "hr",
    "hu",
    "ie",
    "it",
    "lt",
    "lu",
    "lv",
    "mt",
    "my",
    "nl",
    "nz",
    "pl",
    "pt",
    "ro",
    "se",
    "sg",
    "si",
    "sk",
    "us",
]
_NON_PREMIUM_COUNTRY = "mx"


def test_get_premium_countries() -> None:
    premium_countries = get_premium_countries()
    assert sorted(premium_countries) == sorted(_PREMIUM_COUNTRIES)
    assert _NON_PREMIUM_COUNTRY not in premium_countries


_PREMIUM_PRICE_DATA = {
    "de-CH": ("CHF", "_1LYCqOJNcmPzuWtRuIXpQRxi", "_1LYCqyJNcmPzuWtR3Um5qDPu"),
    "de": ("EUR", "_1LYC79JNcmPzuWtRU7Q238yL", "_1LYC7xJNcmPzuWtRcdKXCVZp"),
    "el-GR": ("EUR", "_1NHA5CJNcmPzuWtR1JSmxqFA", "_1NHA4lJNcmPzuWtRniS23IuE"),
    "en-IE": ("EUR", "_1LhdrkJNcmPzuWtRvCc4hsI2", "_1LhdprJNcmPzuWtR7HqzkXTS"),
    "el-CY": ("EUR", "_1NH9saJNcmPzuWtRpffF5I59", "_1NH9rKJNcmPzuWtRzDiXCeEG"),
    "mt": ("EUR", "_1NH9yxJNcmPzuWtRChanpIQU", "_1NH9y3JNcmPzuWtRIJkQos9q"),
    "fr-LU": ("EUR", "_1NHAFZJNcmPzuWtRm5A7w5qJ", "_1NHAF8JNcmPzuWtRG1FiPK0N"),
    "en-US": ("USD", "_1LXUcnJNcmPzuWtRpbNOajYS", "_1LXUdlJNcmPzuWtRKTYg7mpZ"),
    "en-GB": ("USD", "_1LYCHpJNcmPzuWtRhrhSYOKB", "_1LYCIlJNcmPzuWtRQtYLA92j"),
    "es": ("EUR", "_1LYCWmJNcmPzuWtRtopZog9E", "_1LYCXNJNcmPzuWtRu586XOFf"),
    "et": ("EUR", "_1NHA1tJNcmPzuWtRvSeyiVYH", "_1NHA2TJNcmPzuWtR10yknZHf"),
    "fi": ("EUR", "_1LYBn9JNcmPzuWtRI3nvHgMi", "_1LYBq1JNcmPzuWtRmyEa08Wv"),
    "fr-CH": ("CHF", "_1LYCvpJNcmPzuWtRq9ci2gXi", "_1LYCwMJNcmPzuWtRm6ebmq2N"),
    "fr": ("EUR", "_1LYBuLJNcmPzuWtRn58XQcky", "_1LYBwcJNcmPzuWtRpgoWcb03"),
    "it-CH": ("CHF", "_1LYCiBJNcmPzuWtRxtI8D5Uy", "_1LYClxJNcmPzuWtRWjslDdkG"),
    "it": ("EUR", "_1LYCMrJNcmPzuWtRTP9vD8wY", "_1LYCN2JNcmPzuWtRtWz7yMno"),
    "lt": ("EUR", "_1NHACcJNcmPzuWtR5ZJeVtJA", "_1NHADOJNcmPzuWtR2PSMBMLr"),
    "lv": ("EUR", "_1NHAASJNcmPzuWtRpcliwx0R", "_1NHA9lJNcmPzuWtRLf7DV6GA"),
    "nl": ("EUR", "_1LYCdLJNcmPzuWtR0J1EHoJ0", "_1LYCdtJNcmPzuWtRVm4jLzq2"),
    "pt": ("EUR", "_1NHAI1JNcmPzuWtRx8jXjkrQ", "_1NHAHWJNcmPzuWtRCRMnWyvK"),
    "sk": ("EUR", "_1NHAJsJNcmPzuWtR71WX0Pz9", "_1NHAKYJNcmPzuWtRtETl30gb"),
    "sl": ("EUR", "_1NHALmJNcmPzuWtR2nIoAzEt", "_1NHAL9JNcmPzuWtRSZ3BWQs0"),
    "sv": ("EUR", "_1LYBblJNcmPzuWtRGRHIoYZ5", "_1LYBeMJNcmPzuWtRT5A931WH"),
    # Added with MPP-3202
    "bg": ("EUR", "_1NOSjBJNcmPzuWtRMQwYp5u1", "_1NOSkTJNcmPzuWtRpbKwsLcw"),
    "cs": ("CZK", "_1NNkAlJNcmPzuWtRxsfrXacj", "_1NNkDHJNcmPzuWtRHnQmCDGP"),
    "da": ("DKK", "_1NNfPCJNcmPzuWtR3SNA8gqG", "_1NNfLoJNcmPzuWtRpmLc9lst"),
    "hr": ("EUR", "_1NOSznJNcmPzuWtRH7CEeAwA", "_1NOT0WJNcmPzuWtRpeNDEjvC"),
    "hu": ("EUR", "_1NOOJAJNcmPzuWtRV7Kmwmdm", "_1NOOKvJNcmPzuWtR2DEWIRE4"),
    "pl": ("PLN", "_1NNKGJJNcmPzuWtRTlP7GKWW", "_1NNfCvJNcmPzuWtRCvFppHqt"),
    "ro": ("EUR", "_1NOOEnJNcmPzuWtRicUvOyUy", "_1NOOEJJNcmPzuWtRyHqMe2jb"),
}
_PREMIUM_PRICES = {
    "CHF": (2.0, 1.0),
    "EUR": (1.99, 0.99),
    "USD": (1.99, 0.99),
    # Added with MPP-3202
    "CZK": (47.0, 23.0),
    "DKK": (15.0, 7.0),
    "PLN": (8.0, 5.0),
}


def check_country_language_mapping_for_monthly_plan(
    country: RelayCountryStr,
    language: LanguageStr,
    price_data_key: str,
    mapping: PlanCountryLangMapping,
    price_data_by_key: dict[str, tuple[str, str, str]],
    prices_by_currency: dict[str, tuple[float, float]],
) -> None:
    """
    Perform PlanCountryLangMapping checks for monthly plans.

    This is used for the premium and phone plans.
    """
    assert country in mapping
    assert language in mapping[country]
    prices = mapping[country][language]
    currency, monthly_sid, yearly_sid = price_data_by_key[price_data_key]
    monthly_price, yearly_price = prices_by_currency[currency]
    expected_prices = {
        "monthly": {
            "id": f"price{monthly_sid}",
            "price": monthly_price,
            "currency": currency,
        },
        "yearly": {
            "id": f"price{yearly_sid}",
            "price": yearly_price,
            "currency": currency,
        },
    }
    assert prices == expected_prices


@pytest.mark.parametrize(
    "country,language,price_data_key",
    (
        ("at", "de", "de"),
        ("at", "de", "de"),
        ("be", "fr", "fr"),
        ("be", "de", "de"),
        ("be", "nl", "nl"),
        ("ch", "fr", "fr-CH"),
        ("ch", "de", "de-CH"),
        ("ch", "it", "it-CH"),
        ("de", "de", "de"),
        ("es", "es", "es"),
        ("fr", "fr", "fr"),
        ("ie", "en", "en-IE"),
        ("it", "it", "it"),
        ("nl", "nl", "nl"),
        ("se", "sv", "sv"),
        ("fi", "fi", "fi"),
        ("us", "en", "en-US"),
        ("gb", "en", "en-GB"),
        ("ca", "en", "en-US"),
        ("nz", "en", "en-GB"),
        ("my", "en", "en-GB"),
        ("sg", "en", "en-GB"),
        ("cy", "el", "el-CY"),
        ("ee", "et", "et"),
        ("gr", "el", "el-GR"),
        ("lv", "lv", "lv"),
        ("lt", "lt", "lt"),
        ("lu", "fr", "fr-LU"),
        ("mt", "en", "mt"),
        ("pt", "pt", "pt"),
        ("sk", "sk", "sk"),
        ("si", "sl", "sl"),
        # Added with MPP-3202
        ("bg", "bg", "bg"),
        ("cz", "cs", "cs"),
        ("dk", "da", "da"),
        ("hr", "hr", "hr"),
        ("hu", "hu", "hu"),
        ("pl", "pl", "pl"),
        ("ro", "ro", "ro"),
    ),
)
def test_get_premium_country_language_mapping(
    country: RelayCountryStr,
    language: LanguageStr,
    price_data_key: str,
) -> None:
    mapping = get_premium_country_language_mapping()
    check_country_language_mapping_for_monthly_plan(
        country, language, price_data_key, mapping, _PREMIUM_PRICE_DATA, _PREMIUM_PRICES
    )


def test_get_premium_country_language_mapping_overrides(
    plan_settings: SettingsWrapper,
) -> None:
    stage_monthly_id = "price_1LiMjeKb9q6OnNsLzwixHuRz"
    stage_yearly_id = "price_1LiMlBKb9q6OnNsL7tvrtI7y"
    assert plan_settings.PREMIUM_PLAN_ID_US_MONTHLY != stage_monthly_id
    plan_settings.PREMIUM_PLAN_ID_US_MONTHLY = stage_monthly_id
    assert plan_settings.PREMIUM_PLAN_ID_US_YEARLY != stage_yearly_id
    plan_settings.PREMIUM_PLAN_ID_US_YEARLY = stage_yearly_id
    mapping = get_premium_country_language_mapping()
    assert mapping["us"]["en"]["monthly"]["id"] == stage_monthly_id
    assert mapping["us"]["en"]["yearly"]["id"] == stage_yearly_id
    assert mapping["ca"]["en"]["monthly"]["id"] == stage_monthly_id
    assert mapping["ca"]["en"]["yearly"]["id"] == stage_yearly_id


_PHONE_PRICE_DATA = {
    "en-US": ("USD", "_1Li0w8JNcmPzuWtR2rGU80P3", "_1Li15WJNcmPzuWtRIh0F4VwP"),
}
_PHONE_PRICES = {
    "USD": (4.99, 3.99),
}


@pytest.mark.parametrize(
    "country,language,price_data_key",
    (
        ("us", "en", "en-US"),
        ("ca", "en", "en-US"),
    ),
)
def test_get_phone_country_language_mapping(
    country: RelayCountryStr, language: LanguageStr, price_data_key: str
) -> None:
    check_country_language_mapping_for_monthly_plan(
        country,
        language,
        price_data_key,
        get_phone_country_language_mapping(),
        _PHONE_PRICE_DATA,
        _PHONE_PRICES,
    )


def test_get_phone_country_language_mapping_overrides(
    plan_settings: SettingsWrapper,
) -> None:
    stage_monthly_id = "price_1LDqw3Kb9q6OnNsL6XIDst28"
    stage_yearly_id = "price_1Lhd35Kb9q6OnNsL9bAxjUGq"
    assert plan_settings.PHONE_PLAN_ID_US_MONTHLY != stage_monthly_id
    plan_settings.PHONE_PLAN_ID_US_MONTHLY = stage_monthly_id
    assert plan_settings.PHONE_PLAN_ID_US_YEARLY != stage_yearly_id
    plan_settings.PHONE_PLAN_ID_US_YEARLY = stage_yearly_id
    mapping = get_phone_country_language_mapping()
    assert mapping["us"]["en"]["monthly"]["id"] == stage_monthly_id
    assert mapping["us"]["en"]["yearly"]["id"] == stage_yearly_id
    assert mapping["ca"]["en"]["monthly"]["id"] == stage_monthly_id
    assert mapping["ca"]["en"]["yearly"]["id"] == stage_yearly_id


_BUNDLE_PRICE_DATA = {
    "en-US": ("USD", "_1LwoSDJNcmPzuWtR6wPJZeoh"),
}
_BUNDLE_PRICES = {
    "USD": 6.99,
}


@pytest.mark.parametrize(
    "country,language,price_data_key",
    (
        ("us", "en", "en-US"),
        ("ca", "en", "en-US"),
    ),
)
def test_get_bundle_country_language_mapping(
    country: RelayCountryStr, language: LanguageStr, price_data_key: str
) -> None:
    mapping = get_bundle_country_language_mapping()
    assert country in mapping
    assert language in mapping[country]
    prices = mapping[country][language]
    currency, yearly_sid = _BUNDLE_PRICE_DATA[price_data_key]
    yearly_price = _BUNDLE_PRICES[currency]
    expected_prices = {
        "yearly": {
            "id": f"price{yearly_sid}",
            "price": yearly_price,
            "currency": currency,
        },
    }
    assert prices == expected_prices


def test_get_bundle_country_language_mapping_overrides(
    plan_settings: SettingsWrapper,
) -> None:
    stage_yearly_id = "price_1Lwp7uKb9q6OnNsLQYzpzUs5"
    assert plan_settings.BUNDLE_PLAN_ID_US != stage_yearly_id
    plan_settings.BUNDLE_PLAN_ID_US = stage_yearly_id
    mapping = get_bundle_country_language_mapping()
    assert mapping["us"]["en"]["yearly"]["id"] == stage_yearly_id
    assert mapping["ca"]["en"]["yearly"]["id"] == stage_yearly_id
