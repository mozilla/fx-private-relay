"""Tests for privaterelay/plans.py"""

import pytest

from privaterelay.plans import (
    get_bundle_country_language_mapping,
    get_phone_country_language_mapping,
    get_premium_countries,
    get_premium_country_language_mapping,
)

_PREMIUM_COUNTRIES = [
    "at",
    "be",
    "ca",
    "ch",
    "de",
    "es",
    "fi",
    "fr",
    "gb",
    "ie",
    "it",
    "my",
    "nl",
    "nz",
    "se",
    "sg",
    "us",
]
_EU_EXPANSION_PREMIUM_COUNTRIES = [
    "cy",
    "ee",
    "gr",
    "lv",
    "lt",
    "lu",
    "mt",
    "pt",
    "sk",
    "si",
]
_NON_PREMIUM_COUNTRY = "mx"


def test_get_premium_countries_without_eu_country_expansion() -> None:
    premium_countries = get_premium_countries(eu_country_expansion=False)
    assert sorted(premium_countries) == sorted(_PREMIUM_COUNTRIES)
    assert _NON_PREMIUM_COUNTRY not in premium_countries


def test_get_premium_countries_with_eu_country_expansion() -> None:
    premium_countries = get_premium_countries(eu_country_expansion=True)
    assert sorted(premium_countries) == sorted(
        _PREMIUM_COUNTRIES + _EU_EXPANSION_PREMIUM_COUNTRIES
    )
    assert _NON_PREMIUM_COUNTRY not in premium_countries


_PREMIUM_PRICE_DATA = {
    "de-CH": ("CHF", "_1LYCqOJNcmPzuWtRuIXpQRxi", "_1LYCqyJNcmPzuWtR3Um5qDPu"),
    "de": ("EUR", "_1LYC79JNcmPzuWtRU7Q238yL", "_1LYC7xJNcmPzuWtRcdKXCVZp"),
    "el": ("EUR", "_1NHA5CJNcmPzuWtR1JSmxqFA", "_1NHA4lJNcmPzuWtRniS23IuE"),
    "en-IE": ("EUR", "_1LhdrkJNcmPzuWtRvCc4hsI2", "_1LhdprJNcmPzuWtR7HqzkXTS"),
    "en-CY": ("EUR", "_1NH9saJNcmPzuWtRpffF5I59", "_1NH9rKJNcmPzuWtRzDiXCeEG"),
    "en-MT": ("EUR", "_1NH9yxJNcmPzuWtRChanpIQU", "_1NH9y3JNcmPzuWtRIJkQos9q"),
    "en-LU": ("EUR", "_1NHAFZJNcmPzuWtRm5A7w5qJ", "_1NHAF8JNcmPzuWtRG1FiPK0N"),
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
}
_PREMIUM_PRICES = {
    "CHF": (2.0, 1.0),
    "EUR": (1.99, 0.99),
    "USD": (1.99, 0.99),
}


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
        ("cy", "en", "en-CY"),
        ("ee", "et", "et"),
        ("gr", "el", "el"),
        ("lv", "lv", "lv"),
        ("lt", "lt", "lt"),
        ("lu", "en", "en-LU"),
        ("mt", "en", "en-MT"),
        ("pt", "pt", "pt"),
        ("sk", "sk", "sk"),
        ("si", "sl", "sl"),
    ),
)
@pytest.mark.parametrize("eu_expansion", (True, None))
def test_get_premium_country_language_mapping(
    country, language, price_data_key, eu_expansion
) -> None:
    mapping = get_premium_country_language_mapping(eu_country_expansion=eu_expansion)
    if country in _EU_EXPANSION_PREMIUM_COUNTRIES and not eu_expansion:
        assert country not in mapping
        return
    assert country in mapping
    assert language in mapping[country]
    prices = mapping[country][language]
    currency, monthly_sid, yearly_sid = _PREMIUM_PRICE_DATA[price_data_key]
    monthly_price, yearly_price = _PREMIUM_PRICES[currency]
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
def test_get_phone_country_language_mapping(country, language, price_data_key) -> None:
    mapping = get_phone_country_language_mapping()
    assert country in mapping
    assert language in mapping[country]
    prices = mapping[country][language]
    currency, monthly_sid, yearly_sid = _PHONE_PRICE_DATA[price_data_key]
    monthly_price, yearly_price = _PHONE_PRICES[currency]
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
def test_get_bundle_country_language_mapping(country, language, price_data_key) -> None:
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
