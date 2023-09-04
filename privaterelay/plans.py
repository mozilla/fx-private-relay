"""
Paid plans for Relay

There is currently a free plan and 3 paid plans:

* free - limited random email masks, one reply
* premium - unlimited email masks, replies, and a custom subdomain
* phones - premium, plus a phone mask
* bundle - premium and phones, plus Mozilla VPN

These functions get the details of the paid plans:

* get_premium_country_language_mapping
  * get_premium_countries
* get_phone_country_language_mapping
* get_bundle_country_language_mapping

They all return a PlanCountryLangMapping dict, which has this structure:

{
  "AT": {
    "*": {
      "monthly": {
        "id": "price_1LYC79JNcmPzuWtRU7Q238yL",
        "price": 1.99,
        "currency": "EUR",
      },
      "yearly": {
        "id": "price_1LYC7xJNcmPzuWtRcdKXCVZp",
        "price": 0.99,
        "currency": "EUR",
      },
    },
  },
  ...
}

This says that Austria (RelayCountryStr "AT") with any language ("*")
has a monthly and a yearly plan. The monthly plan has a Stripe ID of
"price_1LYC79JNcmPzuWtRU7Q238yL", and costs €1.99 (CurrencyStr "EUR"). The yearly
plan has a Stripe ID of "price_1LYC7xJNcmPzuWtRcdKXCVZp", and costs €11.88 a year,
equivalent to €0.99 a month.

The top-level keys say which countries are supported. The function get_premium_countries
returns these as a set, when the rest of the data is unneeded.

The second-level keys are the languages for that country. When all languages in that
country have the same plan, the single entry is "*". When the country is known but
the language is not, or is not one of the listed languages, the first language is the
default for that country.

The third-level keys are the plan periods. Premium and phones are available on
monthly and yearly periods, and bundle is yearly only.

The raw data is stored in two dicts:
* _STRIPE_PLAN_DATA
* _RELAY_PLANS

These are extended to support more countries, languages, plans, etc. They are parsed
on first use to create the PlanCountryLangMapping, and served from cache on later uses.
"""

from copy import deepcopy
from functools import lru_cache
from typing import Literal, TypedDict, get_args

from django.conf import settings

#
# Public types
#

# ISO 4217 currency identifier
# See https://en.wikipedia.org/wiki/ISO_4217
CurrencyStr = Literal[
    "CHF",  # Swiss Franc, Fr. or fr.
    "CZK",  # Czech koruna, Kč
    "DKK",  # Danish krone, kr.
    "EUR",  # Euro, €
    "PLN",  # Polish złoty, zł
    "USD",  # US Dollar, $
]

# ISO 639 language codes handled by Relay
# These are the 4th-level keys in _RELAY_PLANS[$PLAN][by_country_and_lang][$COUNTRY],
# and are unrelated to the supported languages in Pontoon.
#
# Use the 2-letter ISO 639-1 code if available, otherwise the 3-letter ISO 639-2 code.
# See https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
# and https://www.loc.gov/standards/iso639-2/php/English_list.php
LanguageStr = Literal[
    "de",  # German
    "fr",  # French
    "it",  # Italian
    "nl",  # Dutch
]

# ISO 3166 country codes handled by Relay
# Specifically, the two-letter ISO 3116-1 alpha-2 codes
# See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
# and https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
CountryStr = Literal[
    "AT",  # Austria
    "BE",  # Belgium
    "BG",  # Bulgaria
    "CA",  # Canada
    "CH",  # Switzerland
    "CY",  # Cyprus
    "CZ",  # Czech Republic / Czechia
    "DE",  # Germany
    "DK",  # Denmark
    "EE",  # Estonia
    "ES",  # Spain
    "FI",  # Finland
    "FR",  # France
    "GB",  # United Kingdom
    "GR",  # Greece
    "HR",  # Croatia
    "HU",  # Hungary
    "IE",  # Ireland
    "IT",  # Italy
    "LT",  # Lituania
    "LU",  # Luxembourg
    "LV",  # Latvia
    "MT",  # Malta
    "MY",  # Malaysia
    "NL",  # Netherlands
    "NZ",  # New Zealand
    "PL",  # Poland
    "PT",  # Portugal
    "RO",  # Romania
    "SE",  # Sweden
    "SG",  # Singapore
    "SI",  # Slovenia
    "SK",  # Slovakia
    "US",  # United States
]
relay_countries = set(get_args(CountryStr))

# Periodic subscription categories
PeriodStr = Literal["monthly", "yearly"]

# A Stripe Price, along with key details for Relay website
# https://stripe.com/docs/api/prices/object
StripePriceDef = TypedDict(
    "StripePriceDef",
    {
        "id": str,  # Must start with "price_"
        "price": float,
        "currency": CurrencyStr,
    },
)
PricesForPeriodDict = dict[PeriodStr, StripePriceDef]
LanguageOrAny = LanguageStr | Literal["*"]
PricePeriodsForLanguageDict = dict[LanguageOrAny, PricesForPeriodDict]
PlanCountryLangMapping = dict[CountryStr, PricePeriodsForLanguageDict]

#
# Public functions
#


def get_premium_country_language_mapping() -> PlanCountryLangMapping:
    """Get mapping for premium countries (unlimited masks, custom subdomain)"""
    return _country_language_mapping("premium")


def get_premium_countries() -> set[CountryStr]:
    """Get the country codes where Relay premium can be sold"""
    mapping = get_premium_country_language_mapping()
    return set(mapping.keys())


def get_phone_country_language_mapping() -> PlanCountryLangMapping:
    """Get mapping for phone countries (premium + phone mask)"""
    return _country_language_mapping("phones")


def get_bundle_country_language_mapping() -> PlanCountryLangMapping:
    """Get mapping for bundle countries (premium + phone mask + VPN)"""
    return _country_language_mapping("bundle")


#
# Private types for Selected Stripe data (_STRIPE_PLAN_DATA)
#

# RFC 5646 regional language tags handled by Relay
# Typically an ISO 639 language code, a dash, and an ISO 3166 country code
_RegionalLanguageStr = Literal[
    "de-CH",  # German (Swiss)
    "fr-CH",  # French (Swiss)
    "it-CH",  # Italian (Swiss)
]

# Stripe plans are associated with a country or country-language pair
_CountryOrRegion = CountryStr | _RegionalLanguageStr

# Types for _STRIPE_PLAN_DATA
_StripeMonthlyPriceDetails = TypedDict(
    "_StripeMonthlyPriceDetails", {"monthly": float, "monthly_when_yearly": float}
)
_StripeMonthlyCountryDetails = TypedDict(
    "_StripeMonthlyCountryDetails",
    {
        "currency": CurrencyStr,
        "monthly_id": str,
        "yearly_id": str,
    },
)
_StripeMonthlyPlanDetails = TypedDict(
    "_StripeMonthlyPlanDetails",
    {
        "periods": Literal["monthly_and_yearly"],
        "prices": dict[CurrencyStr, _StripeMonthlyPriceDetails],
        "countries_and_regions": dict[_CountryOrRegion, _StripeMonthlyCountryDetails],
    },
)
_StripeYearlyPriceDetails = TypedDict(
    "_StripeYearlyPriceDetails", {"monthly_when_yearly": float}
)
_StripeYearlyCountryDetails = TypedDict(
    "_StripeYearlyCountryDetails",
    {
        "currency": CurrencyStr,
        "yearly_id": str,
    },
)
_StripeYearlyPlanDetails = TypedDict(
    "_StripeYearlyPlanDetails",
    {
        "periods": Literal["yearly"],
        "prices": dict[CurrencyStr, _StripeYearlyPriceDetails],
        "countries_and_regions": dict[_CountryOrRegion, _StripeYearlyCountryDetails],
    },
)
_StripePlanData = TypedDict(
    "_StripePlanData",
    {
        "premium": _StripeMonthlyPlanDetails,
        "phones": _StripeMonthlyPlanDetails,
        "bundle": _StripeYearlyPlanDetails,
    },
)
_StripePlanDetails = _StripeMonthlyPlanDetails | _StripeYearlyPlanDetails

# Selected Stripe data
# The "source of truth" is the Stripe data, this copy is used for upsell views
# and directing users to the correct Stripe purchase page.
_STRIPE_PLAN_DATA: _StripePlanData = {
    "premium": {
        "periods": "monthly_and_yearly",
        "prices": {
            "CHF": {"monthly": 2.00, "monthly_when_yearly": 1.00},
            "CZK": {"monthly": 47.0, "monthly_when_yearly": 23.0},
            "DKK": {"monthly": 15.0, "monthly_when_yearly": 7.00},
            "EUR": {"monthly": 1.99, "monthly_when_yearly": 0.99},
            "PLN": {"monthly": 8.00, "monthly_when_yearly": 5.00},
            "USD": {"monthly": 1.99, "monthly_when_yearly": 0.99},
        },
        "countries_and_regions": {
            "de-CH": {  # German-speaking Switzerland
                "currency": "CHF",
                "monthly_id": "price_1LYCqOJNcmPzuWtRuIXpQRxi",
                "yearly_id": "price_1LYCqyJNcmPzuWtR3Um5qDPu",
            },
            "fr-CH": {  # French-speaking Switzerland
                "currency": "CHF",
                "monthly_id": "price_1LYCvpJNcmPzuWtRq9ci2gXi",
                "yearly_id": "price_1LYCwMJNcmPzuWtRm6ebmq2N",
            },
            "it-CH": {  # Italian-speaking Switzerland
                "currency": "CHF",
                "monthly_id": "price_1LYCiBJNcmPzuWtRxtI8D5Uy",
                "yearly_id": "price_1LYClxJNcmPzuWtRWjslDdkG",
            },
            "BG": {  # Bulgaria
                "currency": "EUR",
                "monthly_id": "price_1NOSjBJNcmPzuWtRMQwYp5u1",
                "yearly_id": "price_1NOSkTJNcmPzuWtRpbKwsLcw",
            },
            "CY": {  # Cyprus
                "currency": "EUR",
                "monthly_id": "price_1NH9saJNcmPzuWtRpffF5I59",
                "yearly_id": "price_1NH9rKJNcmPzuWtRzDiXCeEG",
            },
            "CZ": {  # Czech Republic / Czechia
                "currency": "CZK",
                "monthly_id": "price_1NNkAlJNcmPzuWtRxsfrXacj",
                "yearly_id": "price_1NNkDHJNcmPzuWtRHnQmCDGP",
            },
            "DE": {  # Germany
                "currency": "EUR",
                "monthly_id": "price_1LYC79JNcmPzuWtRU7Q238yL",
                "yearly_id": "price_1LYC7xJNcmPzuWtRcdKXCVZp",
            },
            "DK": {  # Denmark
                "currency": "DKK",
                "monthly_id": "price_1NNfPCJNcmPzuWtR3SNA8gqG",
                "yearly_id": "price_1NNfLoJNcmPzuWtRpmLc9lst",
            },
            "EE": {  # Estonia
                "currency": "EUR",
                "monthly_id": "price_1NHA1tJNcmPzuWtRvSeyiVYH",
                "yearly_id": "price_1NHA2TJNcmPzuWtR10yknZHf",
            },
            "ES": {  # Spain
                "currency": "EUR",
                "monthly_id": "price_1LYCWmJNcmPzuWtRtopZog9E",
                "yearly_id": "price_1LYCXNJNcmPzuWtRu586XOFf",
            },
            "FI": {  # Finland
                "currency": "EUR",
                "monthly_id": "price_1LYBn9JNcmPzuWtRI3nvHgMi",
                "yearly_id": "price_1LYBq1JNcmPzuWtRmyEa08Wv",
            },
            "FR": {  # France
                "currency": "EUR",
                "monthly_id": "price_1LYBuLJNcmPzuWtRn58XQcky",
                "yearly_id": "price_1LYBwcJNcmPzuWtRpgoWcb03",
            },
            "GB": {  # United Kingdom
                "currency": "USD",
                "monthly_id": "price_1LYCHpJNcmPzuWtRhrhSYOKB",
                "yearly_id": "price_1LYCIlJNcmPzuWtRQtYLA92j",
            },
            "GR": {  # Greece
                "currency": "EUR",
                "monthly_id": "price_1NHA5CJNcmPzuWtR1JSmxqFA",
                "yearly_id": "price_1NHA4lJNcmPzuWtRniS23IuE",
            },
            "HR": {  # Croatia
                "currency": "EUR",
                "monthly_id": "price_1NOSznJNcmPzuWtRH7CEeAwA",
                "yearly_id": "price_1NOT0WJNcmPzuWtRpeNDEjvC",
            },
            "HU": {  # Hungary
                "currency": "EUR",
                "monthly_id": "price_1NOOJAJNcmPzuWtRV7Kmwmdm",
                "yearly_id": "price_1NOOKvJNcmPzuWtR2DEWIRE4",
            },
            "IE": {  # Ireland
                "currency": "EUR",
                "monthly_id": "price_1LhdrkJNcmPzuWtRvCc4hsI2",
                "yearly_id": "price_1LhdprJNcmPzuWtR7HqzkXTS",
            },
            "IT": {  # Italy
                "currency": "EUR",
                "monthly_id": "price_1LYCMrJNcmPzuWtRTP9vD8wY",
                "yearly_id": "price_1LYCN2JNcmPzuWtRtWz7yMno",
            },
            "LT": {  # Lithuania
                "currency": "EUR",
                "monthly_id": "price_1NHACcJNcmPzuWtR5ZJeVtJA",
                "yearly_id": "price_1NHADOJNcmPzuWtR2PSMBMLr",
            },
            "LU": {  # Luxembourg
                "currency": "EUR",
                "monthly_id": "price_1NHAFZJNcmPzuWtRm5A7w5qJ",
                "yearly_id": "price_1NHAF8JNcmPzuWtRG1FiPK0N",
            },
            "LV": {  # Latvia
                "currency": "EUR",
                "monthly_id": "price_1NHAASJNcmPzuWtRpcliwx0R",
                "yearly_id": "price_1NHA9lJNcmPzuWtRLf7DV6GA",
            },
            "MT": {  # Malta
                "currency": "EUR",
                "monthly_id": "price_1NH9yxJNcmPzuWtRChanpIQU",
                "yearly_id": "price_1NH9y3JNcmPzuWtRIJkQos9q",
            },
            "NL": {  # Netherlands
                "currency": "EUR",
                "monthly_id": "price_1LYCdLJNcmPzuWtR0J1EHoJ0",
                "yearly_id": "price_1LYCdtJNcmPzuWtRVm4jLzq2",
            },
            "PL": {  # Poland
                "currency": "PLN",
                "monthly_id": "price_1NNKGJJNcmPzuWtRTlP7GKWW",
                "yearly_id": "price_1NNfCvJNcmPzuWtRCvFppHqt",
            },
            "PT": {  # Portugal
                "currency": "EUR",
                "monthly_id": "price_1NHAI1JNcmPzuWtRx8jXjkrQ",
                "yearly_id": "price_1NHAHWJNcmPzuWtRCRMnWyvK",
            },
            "RO": {  # Romania
                "currency": "EUR",
                "monthly_id": "price_1NOOEnJNcmPzuWtRicUvOyUy",
                "yearly_id": "price_1NOOEJJNcmPzuWtRyHqMe2jb",
            },
            "SE": {  # Sweden
                "currency": "EUR",
                "monthly_id": "price_1LYBblJNcmPzuWtRGRHIoYZ5",
                "yearly_id": "price_1LYBeMJNcmPzuWtRT5A931WH",
            },
            "SI": {  # Slovenia
                "currency": "EUR",
                "monthly_id": "price_1NHALmJNcmPzuWtR2nIoAzEt",
                "yearly_id": "price_1NHAL9JNcmPzuWtRSZ3BWQs0",
            },
            "SK": {  # Slovakia
                "currency": "EUR",
                "monthly_id": "price_1NHAJsJNcmPzuWtR71WX0Pz9",
                "yearly_id": "price_1NHAKYJNcmPzuWtRtETl30gb",
            },
            "US": {  # United States
                "currency": "USD",
                "monthly_id": "price_1LXUcnJNcmPzuWtRpbNOajYS",
                "yearly_id": "price_1LXUdlJNcmPzuWtRKTYg7mpZ",
            },
        },
    },
    "phones": {
        "periods": "monthly_and_yearly",
        "prices": {
            "USD": {"monthly": 4.99, "monthly_when_yearly": 3.99},
        },
        "countries_and_regions": {
            "US": {  # United States
                "currency": "USD",
                "monthly_id": "price_1Li0w8JNcmPzuWtR2rGU80P3",
                "yearly_id": "price_1Li15WJNcmPzuWtRIh0F4VwP",
            }
        },
    },
    "bundle": {
        "periods": "yearly",
        "prices": {
            "USD": {"monthly_when_yearly": 6.99},
        },
        "countries_and_regions": {
            "US": {  # United States
                "currency": "USD",
                "yearly_id": "price_1LwoSDJNcmPzuWtR6wPJZeoh",
            }
        },
    },
}


# Private types for _RELAY_PLANS
_RelayPlanCategory = Literal["premium", "phones", "bundle"]
_RelayPlansByType = TypedDict(
    "_RelayPlansByType",
    {
        "by_country_and_lang": dict[CountryStr, dict[LanguageStr, _CountryOrRegion]],
        "by_country_override": dict[CountryStr, CountryStr],
        "by_country": list[CountryStr],
    },
    total=False,
)
_RelayPlans = dict[_RelayPlanCategory, _RelayPlansByType]


# Map of Relay-supported countries to languages and their plans
# The top-level key is the plan type, "premium" or "phones" or "bundle"
# The second-level key is a map from criteria to the Stripe plan country index:
#   - "by_country": The plan is indexed by the original country code.
#   - "by_country_override": The plan is indexed by a different country code.
#     For example, the "phones" plan in Canada ("CA") is the same as the United
#     States ("US") plan.
#   - "by_country_and_lang": The plan is indexed by country and language. For
#     example, German speakers in Belgium have a different plan ("DE") than Dutch
#     speakers ("NL"). The first language has the default plan index if none match.
# The different maps are used to find the CountryStr that is an index into the
# _STRIPE_PLAN_DATA for that plan type.
_RELAY_PLANS: _RelayPlans = {
    "premium": {
        "by_country": [
            "BG",  # Bulgaria
            "CY",  # Cyprus
            "CZ",  # Czech Republic / Czechia
            "DE",  # Germany
            "DK",  # Denmark
            "EE",  # Estonia
            "ES",  # Spain
            "FI",  # Finland
            "FR",  # France
            "GB",  # United Kingdom
            "GR",  # Greece
            "HR",  # Croatia
            "HU",  # Hungary
            "IE",  # Ireland
            "IT",  # Italy
            "LT",  # Lithuania
            "LU",  # Luxembourg
            "LV",  # Latvia
            "MT",  # Malta
            "NL",  # Netherlands
            "PL",  # Poland
            "PT",  # Portugal
            "RO",  # Romania
            "SE",  # Sweden
            "SI",  # Slovenia
            "SK",  # Slovakia
            "US",  # United States
        ],
        "by_country_override": {
            "AT": "DE",  # Austria -> Germany
            "CA": "US",  # Canada -> United States
            "MY": "GB",  # Malaysia -> United Kingdom
            "NZ": "GB",  # New Zealand -> United Kingdom
            "SG": "GB",  # Singapore -> United Kingdom
        },
        "by_country_and_lang": {
            "BE": {  # Belgium
                "fr": "FR",  # French-speaking Belgium -> France
                "de": "DE",  # German-speaking Belgium -> Germany
                "nl": "NL",  # Dutch-speaking Belgium -> Netherlands
            },
            "CH": {  # Switzerland
                "fr": "fr-CH",  # French-speaking Swiss
                "de": "de-CH",  # Germany-speaking Swiss
                "it": "it-CH",  # Italian-speaking Swiss
            },
        },
    },
    "phones": {
        "by_country": ["US"],  # United States
        "by_country_override": {"CA": "US"},  # Canada -> United States
    },
    "bundle": {
        "by_country": ["US"],  # United States
        "by_country_override": {"CA": "US"},  # Canada -> United States
    },
}


#
# Private functions
#


def _country_language_mapping(plan: _RelayPlanCategory) -> PlanCountryLangMapping:
    """Get plan mapping with cache parameters"""
    return _cached_country_language_mapping(
        plan=plan,
        us_premium_monthly_price_id=settings.PREMIUM_PLAN_ID_US_MONTHLY,
        us_premium_yearly_price_id=settings.PREMIUM_PLAN_ID_US_YEARLY,
        us_phone_monthly_price_id=settings.PHONE_PLAN_ID_US_MONTHLY,
        us_phone_yearly_price_id=settings.PHONE_PLAN_ID_US_YEARLY,
        us_bundle_yearly_price_id=settings.BUNDLE_PLAN_ID_US,
    )


@lru_cache
def _cached_country_language_mapping(
    plan: _RelayPlanCategory,
    us_premium_monthly_price_id: str,
    us_premium_yearly_price_id: str,
    us_phone_monthly_price_id: str,
    us_phone_yearly_price_id: str,
    us_bundle_yearly_price_id: str,
) -> PlanCountryLangMapping:
    """Create the plan mapping with settings overrides"""
    relay_maps = _RELAY_PLANS[plan]
    stripe_data = _get_stripe_data_with_overrides(
        us_premium_monthly_price_id=us_premium_monthly_price_id,
        us_premium_yearly_price_id=us_premium_yearly_price_id,
        us_phone_monthly_price_id=us_phone_monthly_price_id,
        us_phone_yearly_price_id=us_phone_yearly_price_id,
        us_bundle_yearly_price_id=us_bundle_yearly_price_id,
    )[plan]

    mapping: PlanCountryLangMapping = {}
    for relay_country in relay_maps.get("by_country", []):
        assert relay_country not in mapping
        mapping[relay_country] = {"*": _get_stripe_prices(relay_country, stripe_data)}

    for relay_country, override in relay_maps.get("by_country_override", {}).items():
        assert relay_country not in mapping
        mapping[relay_country] = {"*": _get_stripe_prices(override, stripe_data)}

    for relay_country, languages in relay_maps.get("by_country_and_lang", {}).items():
        assert relay_country not in mapping
        mapping[relay_country] = {
            lang: _get_stripe_prices(stripe_country, stripe_data)
            for lang, stripe_country in languages.items()
        }
    # Sort by country code
    return {code: mapping[code] for code in sorted(mapping)}


def _get_stripe_prices(
    country_or_region: _CountryOrRegion, data: _StripePlanDetails
) -> PricesForPeriodDict:
    """Return the Stripe monthly and yearly price data for the given country."""
    stripe_details = data["countries_and_regions"][country_or_region]
    currency = stripe_details["currency"]
    prices = data["prices"][currency]
    period_to_details: PricesForPeriodDict = {}
    if data["periods"] == "monthly_and_yearly":
        # mypy thinks stripe_details _could_ be _StripeYearlyPriceDetails,
        # so extra asserts are needed to make mypy happy.
        monthly_id = str(stripe_details.get("monthly_id"))
        assert monthly_id.startswith("price_")
        price = prices.get("monthly", 0.0)
        assert price and isinstance(price, float)
        period_to_details["monthly"] = {
            "id": monthly_id,
            "currency": currency,
            "price": price,
        }
    yearly_id = stripe_details["yearly_id"]
    assert yearly_id.startswith("price_")
    period_to_details["yearly"] = {
        "id": yearly_id,
        "currency": currency,
        "price": prices["monthly_when_yearly"],
    }
    return period_to_details


@lru_cache
def _get_stripe_data_with_overrides(
    us_premium_monthly_price_id: str,
    us_premium_yearly_price_id: str,
    us_phone_monthly_price_id: str,
    us_phone_yearly_price_id: str,
    us_bundle_yearly_price_id: str,
) -> _StripePlanData:
    """Returns the Stripe plan data with settings overrides"""
    plan_data = deepcopy(_STRIPE_PLAN_DATA)
    plan_data["premium"]["countries_and_regions"]["US"][
        "monthly_id"
    ] = us_premium_monthly_price_id
    plan_data["premium"]["countries_and_regions"]["US"][
        "yearly_id"
    ] = us_premium_yearly_price_id
    plan_data["phones"]["countries_and_regions"]["US"][
        "monthly_id"
    ] = us_phone_monthly_price_id
    plan_data["phones"]["countries_and_regions"]["US"][
        "yearly_id"
    ] = us_phone_yearly_price_id
    plan_data["bundle"]["countries_and_regions"]["US"][
        "yearly_id"
    ] = us_bundle_yearly_price_id
    return plan_data
