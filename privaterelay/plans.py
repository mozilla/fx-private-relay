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
  "at": {
    "de": {
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

This says that Austria (RelayCountryStr "at") defaults to German (LanguageStr "de"),
and has a monthly and a yearly plan. The monthly plan has a Stripe ID of
"price_1LYC79JNcmPzuWtRU7Q238yL", and costs €1.99 (CurrencyStr "EUR"). The yearly
plan has a Stripe ID of "price_1LYC7xJNcmPzuWtRcdKXCVZp", and costs €11.88 a year,
equivalent to €0.99 a month.

The top-level keys say which countries are supported. The function get_premium_countries
returns these as a set, when the rest of the data is unneeded.

The second-level keys are the languages for that country. When the country is known but
the language is not, or is not one of the listed languages, the first language is the
default for that country.

The third-level keys are the plan periods. Premium and phones are available on
monthly and yearly periods, and bundle is yearly only.

The raw data is stored in two dicts:
* _STRIPE_PLAN_DATA
* _RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE

These are extended to support more countries, languages, plans, etc. They are parsed
on first use to create the PlanCountryLangMapping, and served from cache on later uses.
"""

from copy import deepcopy
from functools import lru_cache
from typing import Literal, TypedDict

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
# These are the 3rd-level keys in _RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE, and are
# unrelated to the supported languages in Pontoon.
#
# Use the 2-letter ISO 639-1 code if available, otherwise the 3-letter ISO 639-2 code.
# See https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
# and https://www.loc.gov/standards/iso639-2/php/English_list.php
LanguageStr = Literal[
    "bg",  # Bulgarian
    "cs",  # Czech
    "da",  # Danish
    "de",  # German
    "el",  # Greek, Modern (1453-)
    "en",  # English
    "es",  # Spanish
    "et",  # Estonian
    "fi",  # Finnish
    "fr",  # French
    "hr",  # Croatian
    "hu",  # Hungarian
    "it",  # Italian
    "lt",  # Lithuanian
    "lv",  # Latvian
    "nl",  # Dutch
    "pl",  # Polish
    "pt",  # Portuguese
    "ro",  # Romanian
    "sk",  # Slovak
    "sl",  # Slovenian / Slovene
    "sv",  # Swedish
]

# Lowercased ISO 3166 country codes handled by Relay
# Specifically, the two-letter ISO 3116-1 alpha-2 codes
# See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
# and https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
RelayCountryStr = Literal[
    "at",  # Austria
    "be",  # Belgium
    "bg",  # Bulgaria
    "ca",  # Canada
    "ch",  # Switzerland
    "cy",  # Cyprus
    "cz",  # Czech Republic / Czechia
    "de",  # Germany
    "dk",  # Denmark
    "ee",  # Estonia
    "es",  # Spain
    "fi",  # Finland
    "fr",  # France
    "gb",  # United Kingdom
    "gr",  # Greece
    "hr",  # Croatia
    "hu",  # Hungary
    "ie",  # Ireland
    "it",  # Italy
    "lt",  # Lituania
    "lu",  # Luxembourg
    "lv",  # Latvia
    "mt",  # Malta
    "my",  # Malaysia
    "nl",  # Netherlands
    "nz",  # New Zealand
    "pl",  # Poland
    "pt",  # Portugal
    "ro",  # Romania
    "se",  # Sweden
    "sg",  # Singapore
    "si",  # Slovenia
    "sk",  # Slovakia
    "us",  # United States
]

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
PricePeriodsForLanguageDict = dict[LanguageStr, PricesForPeriodDict]
PlanCountryLangMapping = dict[RelayCountryStr, PricePeriodsForLanguageDict]

#
# Public functions
#


def get_premium_country_language_mapping(
    eu_country_expansion: bool | None,
) -> PlanCountryLangMapping:
    """Get mapping for premium countries (unlimited masks, custom subdomain)"""
    return _country_language_mapping(
        "premium", eu_country_expansion=eu_country_expansion
    )


def get_premium_countries(eu_country_expansion: bool | None) -> set[RelayCountryStr]:
    """Get the country codes where Relay premium can be sold"""
    mapping = get_premium_country_language_mapping(eu_country_expansion)
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

# ISO 3166 country codes for Stripe prices
# Specifically, the two-letter ISO 3116-1 alpha-2 codes
# See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
# and https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
_CountryStr = Literal[
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
]

# RFC 5646 regional language tags handled by Relay
# Typically an ISO 639 language code, a dash, and an ISO 3166 country code
_RegionalLanguageStr = Literal[
    "de-CH",  # German (Swiss)
    "fr-CH",  # French (Swiss)
    "it-CH",  # Italian (Swiss)
]

# Stripe plans are associated with a country or country-language pair
_StripeCountryOrRegion = _CountryStr | _RegionalLanguageStr

# Types for _STRIPE_PLAN_DATA
_StripePlanData = TypedDict(
    "_StripePlanData",
    {
        "premium": "_StripeMonthlyPlanDetails",
        "phones": "_StripeMonthlyPlanDetails",
        "bundle": "_StripeYearlyPlanDetails",
    },
)
_StripeMonthlyPlanDetails = TypedDict(
    "_StripeMonthlyPlanDetails",
    {
        "periods": Literal["monthly_and_yearly"],
        "prices": "_StripeMonthlyPriceData",
        "countries_and_regions": "_StripeMonthlyCountryAndRegionDetails",
    },
)
_StripeYearlyPlanDetails = TypedDict(
    "_StripeYearlyPlanDetails",
    {
        "periods": Literal["yearly"],
        "prices": "_StripeYearlyPriceData",
        "countries_and_regions": "_StripeYearlyCountryAndRegionDetails",
    },
)
_StripeMonthlyPriceData = dict[CurrencyStr, "_StripeMonthlyPriceDetails"]
_StripeYearlyPriceData = dict[CurrencyStr, "_StripeYearlyPriceDetails"]
_StripeMonthlyPriceDetails = TypedDict(
    "_StripeMonthlyPriceDetails", {"monthly": float, "monthly_when_yearly": float}
)
_StripeYearlyPriceDetails = TypedDict(
    "_StripeYearlyPriceDetails", {"monthly_when_yearly": float}
)
_StripeMonthlyCountryAndRegionDetails = dict[
    _StripeCountryOrRegion, "_StripeMonthlyCountryDetails"
]
_StripeYearlyCountryAndRegionDetails = dict[
    _StripeCountryOrRegion, "_StripeYearlyCountryDetails"
]
_StripeMonthlyCountryDetails = TypedDict(
    "_StripeMonthlyCountryDetails",
    {
        "currency": CurrencyStr,
        "monthly_id": str,
        "yearly_id": str,
    },
)
_StripeYearlyCountryDetails = TypedDict(
    "_StripeYearlyCountryDetails",
    {
        "currency": CurrencyStr,
        "yearly_id": str,
    },
)

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


# Private types for _RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE
_RelayPlansByCountryAndLanguage = dict["_RelayPlanKey", "_RelayPlanCountryData"]
_RelayBasePlanKey = Literal["premium", "phones", "bundle"]
_RelayPlanKey = _RelayBasePlanKey | Literal["premium_eu_expansion"]
_RelayPlanCountryData = dict[RelayCountryStr, "_RelayCountryLanguageData"]
_RelayCountryLanguageData = dict[LanguageStr, _StripeCountryOrRegion]


# Map of Relay-supported countries to languages and their plans
# The top-level key is the plan, or a psuedo-plan for waffled expansion
# The second-level key is the RelayCountryStr, such as "ca" for Canada
# The third-level key is a LanguageStr, such as "en" for English. The first language
#   key is the default for that country. Multiple keys are only needed when
#   there are multiple plans for a country (Belgium and Switzerland), distinguished by
#   the language. In the 2023 EU expansion, we instead created a plan per country, so
#   only one third-level entry is needed, and the language is not used.
# The third-level value is a _CountryStr, such as "US" for the United States,
#   or a _RegionalLanguageStr, such as "de-CH" for German (Switzerland). This is an
#   index into the _STRIPE_PLAN_DATA. Multiple entries may point to the same Stripe
#   country data. The Stripe "US" entry can be overridden by settings to support
#   testing in non-production environments.
_RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE: _RelayPlansByCountryAndLanguage = {
    "premium": {
        "at": {"de": "DE"},  # Austria
        "be": {  # Belgium
            "fr": "FR",
            "de": "DE",
            "nl": "NL",
        },
        "ca": {"en": "US"},  # Canada
        "ch": {  # Switzerland
            "fr": "fr-CH",
            "de": "de-CH",
            "it": "it-CH",
        },
        "de": {"de": "DE"},  # Germany
        "es": {"es": "ES"},  # Spain
        "fi": {"fi": "FI"},  # Finland
        "fr": {"fr": "FR"},  # France
        "gb": {"en": "GB"},  # United Kingdom
        "ie": {"en": "IE"},  # Ireland
        "it": {"it": "IT"},  # Italy
        "my": {"en": "GB"},  # Malaysia
        "nl": {"nl": "NL"},  # Netherlands
        "nz": {"en": "GB"},  # New Zealand
        "se": {"sv": "SE"},  # Sweden
        "sg": {"en": "GB"},  # Singapore
        "us": {"en": "US"},  # United States
    },
    "premium_eu_expansion": {
        "bg": {"bg": "BG"},  # Bulgaria
        "cy": {"el": "CY"},  # Cyprus
        "cz": {"cs": "CZ"},  # Czech Republic / Czechia
        "dk": {"da": "DK"},  # Denmark
        "ee": {"et": "EE"},  # Estonia
        "gr": {"el": "GR"},  # Greece
        "hr": {"hr": "HR"},  # Croatia
        "hu": {"hu": "HU"},  # Hungary
        "lt": {"lt": "LT"},  # Lithuania
        "lu": {"fr": "LU"},  # Luxembourg
        "lv": {"lv": "LV"},  # Latvia
        "mt": {"en": "MT"},  # Malta
        "pl": {"pl": "PL"},  # Poland
        "pt": {"pt": "PT"},  # Portugal
        "ro": {"ro": "RO"},  # Romania
        "si": {"sl": "SI"},  # Slovenia
        "sk": {"sk": "SK"},  # Slovakia
    },
    "phones": {
        "ca": {"en": "US"},  # Canada
        "us": {"en": "US"},  # United States
    },
    "bundle": {
        "ca": {"en": "US"},  # Canada
        "us": {"en": "US"},  # United States
    },
}


#
# Private functions
#


def _country_language_mapping(
    plan: _RelayBasePlanKey,
    eu_country_expansion: bool | None = None,
) -> PlanCountryLangMapping:
    """Get plan mapping with cache parameters"""
    return _cached_country_language_mapping(
        plan=plan,
        eu_country_expansion=bool(eu_country_expansion),
        us_premium_monthly_price_id=settings.PREMIUM_PLAN_ID_US_MONTHLY,
        us_premium_yearly_price_id=settings.PREMIUM_PLAN_ID_US_YEARLY,
        us_phone_monthly_price_id=settings.PHONE_PLAN_ID_US_MONTHLY,
        us_phone_yearly_price_id=settings.PHONE_PLAN_ID_US_YEARLY,
        us_bundle_yearly_price_id=settings.BUNDLE_PLAN_ID_US,
    )


@lru_cache
def _cached_country_language_mapping(
    plan: _RelayBasePlanKey,
    eu_country_expansion: bool,
    us_premium_monthly_price_id: str,
    us_premium_yearly_price_id: str,
    us_phone_monthly_price_id: str,
    us_phone_yearly_price_id: str,
    us_bundle_yearly_price_id: str,
) -> PlanCountryLangMapping:
    """Create the plan mapping with settings overrides"""
    if plan == "premium":
        relay_countries = _RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE["premium"].copy()
        if eu_country_expansion:
            relay_countries.update(
                _RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE["premium_eu_expansion"]
            )
    else:
        relay_countries = _RELAY_PLANS_BY_COUNTRY_AND_LANGUAGE[plan]
    stripe_data = _get_stripe_data_with_overrides(
        us_premium_monthly_price_id=us_premium_monthly_price_id,
        us_premium_yearly_price_id=us_premium_yearly_price_id,
        us_phone_monthly_price_id=us_phone_monthly_price_id,
        us_phone_yearly_price_id=us_phone_yearly_price_id,
        us_bundle_yearly_price_id=us_bundle_yearly_price_id,
    )[plan]
    stripe_periods = stripe_data["periods"]
    stripe_prices = stripe_data["prices"]
    stripe_countries = stripe_data["countries_and_regions"]

    mapping: PlanCountryLangMapping = {}
    for relay_country, languages in relay_countries.items():
        lang_to_period_details: PricePeriodsForLanguageDict = {}
        for lang, stripe_country in languages.items():
            stripe_details = stripe_countries[stripe_country]
            currency = stripe_details["currency"]
            prices = stripe_prices[stripe_details["currency"]]
            period_to_details: PricesForPeriodDict = {}
            if stripe_periods == "monthly_and_yearly":
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
            lang_to_period_details[lang] = period_to_details
        mapping[relay_country] = lang_to_period_details
    return mapping


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
