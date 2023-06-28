"""Paid plans for Relay"""

from typing import Literal, TypedDict

from django.conf import settings


# ISO 4217 currency identifier
# See https://en.wikipedia.org/wiki/ISO_4217
CurrencyStr = Literal[
    "CHF",  # Swiss Franc, Fr. or fr.
    "EUR",  # Euro, €
    "USD",  # US Dollar, $
]

# ISO 4217 currency identifer, lowercased for matrix key
# TODO: Replace with CurrencyStr
LowerCurrencyKey = Literal[
    "chf",  # Swiss Franc, Fr. or fr.
    "euro",  # Euro, €
    "usd",  # US Dollar, $
]

# ISO 639 language codes handled by Relay
# Uses the 2-letter ISO 639-1 code if available, otherwise the 3-letter ISO 639-2 code.
# See https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
# and https://www.loc.gov/standards/iso639-2/php/English_list.php
LanguageStr = Literal[
    "de",  # German
    "el",  # Greek, Modern (1453-)
    "en",  # English
    "es",  # Spanish
    "et",  # Estonian
    "fi",  # Finnish
    "fr",  # French
    "it",  # Italian
    "lt",  # Lithuanian
    "lv",  # Latvian
    "nl",  # Dutch
    "pt",  # Portuguese
    "sk",  # Slovak
    "sl",  # Slovernian
    "sv",  # Swedish
]

# Country codes with Stripe plans. Most lowercased IS0 3166 codes, some outliers
# TODO: Replace with ISO 3166 codes
StripeCountryStr = Literal[
    "cy",  # Cyprus
    "de",  # Germany (or German-speaking Switzerland)
    "ee",  # Estonia
    "es",  # Spain
    "fi",  # Finland
    "fr",  # France (or French-speaking Switzerland)
    "gr",  # Greece
    "ie",  # Ireland
    "it",  # Italy (or Italian-speaking Switzerland)
    "lt",  # Lithuania
    "lu",  # Luxembourg
    "lv",  # Latvia
    "mt",  # Malta
    "nl",  # Netherlands
    "pt",  # Portugual
    "se",  # Sweden
    "si",  # Slovenia
    "sk",  # Slovakia
    "en",  # United States (should be US)
    "gb",  # United Kingdom
]

# Periodic subscription categories
PeriodStr = Literal["monthly", "yearly"]


# A Stripe Price, along with key details for Relay website
# https://stripe.com/docs/api/prices/object
class StripePriceDef(TypedDict):
    id: str  # Must start with "price_"
    price: float
    currency: CurrencyStr


PricesForPeriodDict = dict[PeriodStr, StripePriceDef]
PricePeriodsForCountryDict = dict[StripeCountryStr, PricesForPeriodDict]
CountryPricePeriodsForCurrencyDict = dict[LowerCurrencyKey, PricePeriodsForCountryDict]

# Lowercased ISO 3166 country codes handled by Relay
# Specifically, the two-letter ISO 3116-1 alpha-2 codes
# See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
# and https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
LowerCountryStr = Literal[
    "at",  # Austria
    "be",  # Belgium
    "ca",  # Canada
    "ch",  # Switzerland
    "cy",  # Cyprus
    "de",  # Germany
    "ee",  # Estonia
    "es",  # Spain
    "fi",  # Finland
    "fr",  # France
    "gb",  # United Kingdom
    "gr",  # Greece
    "ie",  # Ireland
    "it",  # Italy
    "lt",  # Lituania
    "lu",  # Luxembourg
    "lv",  # Latvia
    "mt",  # Malta
    "my",  # Malaysia
    "nl",  # Netherlands
    "nz",  # New Zealand
    "pt",  # Portugal
    "se",  # Sweden
    "sg",  # Singapore
    "si",  # Slovenia
    "sk",  # Slovakia
    "us",  # United States
]
PricePeriodsForLanguageDict = dict[LanguageStr, PricesForPeriodDict]
PlanCountryLangMapping = dict[LowerCountryStr, PricePeriodsForLanguageDict]


def get_premium_country_language_mapping(
    eu_country_expansion: bool | None,
) -> PlanCountryLangMapping:
    mapping = _PERIODICAL_PREMIUM_PLAN_COUNTRY_LANG_MAPPING.copy()
    if eu_country_expansion:
        mapping.update(_EU_EXPANSION_PREMIUM_PLAN_COUNTRY_LANG_MAPPING)
    return mapping


def get_premium_countries(eu_country_expansion: bool | None) -> set[LowerCountryStr]:
    mapping = get_premium_country_language_mapping(eu_country_expansion)
    return set(mapping.keys())


def get_phone_country_language_mapping() -> PlanCountryLangMapping:
    return _PHONE_PLAN_COUNTRY_LANG_MAPPING


def get_bundle_country_language_mapping() -> PlanCountryLangMapping:
    return _BUNDLE_PLAN_COUNTRY_LANG_MAPPING.copy()


_PERIODICAL_PREMIUM_PLAN_ID_MATRIX: CountryPricePeriodsForCurrencyDict = {
    "chf": {
        "de": {
            "monthly": {
                "id": "price_1LYCqOJNcmPzuWtRuIXpQRxi",
                "price": 2.00,
                "currency": "CHF",
            },
            "yearly": {
                "id": "price_1LYCqyJNcmPzuWtR3Um5qDPu",
                "price": 1.00,
                "currency": "CHF",
            },
        },
        "fr": {
            "monthly": {
                "id": "price_1LYCvpJNcmPzuWtRq9ci2gXi",
                "price": 2.00,
                "currency": "CHF",
            },
            "yearly": {
                "id": "price_1LYCwMJNcmPzuWtRm6ebmq2N",
                "price": 1.00,
                "currency": "CHF",
            },
        },
        "it": {
            "monthly": {
                "id": "price_1LYCiBJNcmPzuWtRxtI8D5Uy",
                "price": 2.00,
                "currency": "CHF",
            },
            "yearly": {
                "id": "price_1LYClxJNcmPzuWtRWjslDdkG",
                "price": 1.00,
                "currency": "CHF",
            },
        },
    },
    "euro": {
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
        "es": {
            "monthly": {
                "id": "price_1LYCWmJNcmPzuWtRtopZog9E",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LYCXNJNcmPzuWtRu586XOFf",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "fr": {
            "monthly": {
                "id": "price_1LYBuLJNcmPzuWtRn58XQcky",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LYBwcJNcmPzuWtRpgoWcb03",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "it": {
            "monthly": {
                "id": "price_1LYCMrJNcmPzuWtRTP9vD8wY",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LYCN2JNcmPzuWtRtWz7yMno",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "nl": {
            "monthly": {
                "id": "price_1LYCdLJNcmPzuWtR0J1EHoJ0",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LYCdtJNcmPzuWtRVm4jLzq2",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "ie": {
            "monthly": {
                "id": "price_1LhdrkJNcmPzuWtRvCc4hsI2",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LhdprJNcmPzuWtR7HqzkXTS",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "se": {
            "monthly": {
                "id": "price_1LYBblJNcmPzuWtRGRHIoYZ5",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LYBeMJNcmPzuWtRT5A931WH",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "fi": {
            "monthly": {
                "id": "price_1LYBn9JNcmPzuWtRI3nvHgMi",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1LYBq1JNcmPzuWtRmyEa08Wv",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "si": {
            "monthly": {
                "id": "price_1NHALmJNcmPzuWtR2nIoAzEt",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHAL9JNcmPzuWtRSZ3BWQs0",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "sk": {
            "monthly": {
                "id": "price_1NHAJsJNcmPzuWtR71WX0Pz9",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHAKYJNcmPzuWtRtETl30gb",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "pt": {
            "monthly": {
                "id": "price_1NHAI1JNcmPzuWtRx8jXjkrQ",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHAHWJNcmPzuWtRCRMnWyvK",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "lu": {
            "monthly": {
                "id": "price_1NHAFZJNcmPzuWtRm5A7w5qJ",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHAF8JNcmPzuWtRG1FiPK0N",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "lt": {
            "monthly": {
                "id": "price_1NHACcJNcmPzuWtR5ZJeVtJA",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHADOJNcmPzuWtR2PSMBMLr",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "lv": {
            "monthly": {
                "id": "price_1NHAASJNcmPzuWtRpcliwx0R",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHA9lJNcmPzuWtRLf7DV6GA",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "gr": {
            "monthly": {
                "id": "price_1NHA5CJNcmPzuWtR1JSmxqFA",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHA4lJNcmPzuWtRniS23IuE",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "ee": {
            "monthly": {
                "id": "price_1NHA1tJNcmPzuWtRvSeyiVYH",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NHA2TJNcmPzuWtR10yknZHf",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        "mt": {
            "monthly": {
                "id": "price_1NH9yxJNcmPzuWtRChanpIQU",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NH9y3JNcmPzuWtRIJkQos9q",
                "price": 0.99,
                "currency": "EUR",
            },
        },
        # TODO: clarify this entry
        # "cy" the language code means Welsh
        # "cy" means "Cyprus" in our usage, which is probably Greek or Turkish
        "cy": {
            "monthly": {
                "id": "price_1NH9saJNcmPzuWtRpffF5I59",
                "price": 1.99,
                "currency": "EUR",
            },
            "yearly": {
                "id": "price_1NH9rKJNcmPzuWtRzDiXCeEG",
                "price": 0.99,
                "currency": "EUR",
            },
        },
    },
    "usd": {
        "en": {
            "monthly": {
                "id": settings.PREMIUM_PLAN_ID_US_MONTHLY,
                "price": 1.99,
                "currency": "USD",
            },
            "yearly": {
                "id": settings.PREMIUM_PLAN_ID_US_YEARLY,
                "price": 0.99,
                "currency": "USD",
            },
        },
        "gb": {
            "monthly": {
                "id": "price_1LYCHpJNcmPzuWtRhrhSYOKB",
                "price": 1.99,
                "currency": "USD",
            },
            "yearly": {
                "id": "price_1LYCIlJNcmPzuWtRQtYLA92j",
                "price": 0.99,
                "currency": "USD",
            },
        },
    },
}

_PERIODICAL_PREMIUM_PLAN_COUNTRY_LANG_MAPPING: PlanCountryLangMapping = {
    # Austria
    "at": {
        "de": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["de"],
    },
    # Belgium
    "be": {
        "fr": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["fr"],
        "de": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["de"],
        "nl": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["nl"],
    },
    # Switzerland
    "ch": {
        "fr": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["chf"]["fr"],
        "de": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["chf"]["de"],
        "it": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["chf"]["it"],
    },
    # Germany
    "de": {
        "de": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["de"],
    },
    # Spain
    "es": {
        "es": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["es"],
    },
    # France
    "fr": {
        "fr": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["fr"],
    },
    # Ireland
    "ie": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["ie"],
    },
    # Italy
    "it": {
        "it": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["it"],
    },
    # Netherlands
    "nl": {
        "nl": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["nl"],
    },
    # Sweden
    "se": {
        "sv": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["se"],
    },
    # Finland
    "fi": {
        "fi": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["fi"],
    },
    # United States
    "us": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["usd"]["en"],
    },
    # United Kingdom
    "gb": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["usd"]["gb"],
    },
    # Canada
    "ca": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["usd"]["en"],
    },
    # New Zealand
    "nz": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["usd"]["gb"],
    },
    # Malaysia
    "my": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["usd"]["gb"],
    },
    # Singapore
    "sg": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["usd"]["gb"],
    },
}
_EU_EXPANSION_PREMIUM_PLAN_COUNTRY_LANG_MAPPING: PlanCountryLangMapping = {
    # Cyprus
    "cy": {
        # TODO: Welsh (cy) seems wrong. Maybe el (greek) and tr (turkish)?
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["cy"],
    },
    # Estonia
    "ee": {
        "et": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["ee"],
    },
    # Greece
    "gr": {
        "el": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["gr"],
    },
    # Latvia
    "lv": {
        "lv": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["lv"],
    },
    # Lithuania
    "lt": {
        "lt": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["lt"],
    },
    # Luxembourg
    "lu": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["lu"],
    },
    # Malta
    "mt": {
        "en": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["mt"],
    },
    # Portugal
    "pt": {
        "pt": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["pt"],
    },
    # Slovakia
    "sk": {
        "sk": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["sk"],
    },
    # Slovenia
    "si": {
        "sl": _PERIODICAL_PREMIUM_PLAN_ID_MATRIX["euro"]["si"],
    },
}

_PHONE_PLAN_ID_MATRIX: CountryPricePeriodsForCurrencyDict = {
    "usd": {
        "en": {
            "monthly": {
                "id": settings.PHONE_PLAN_ID_US_MONTHLY,
                "price": 4.99,
                "currency": "USD",
            },
            "yearly": {
                "id": settings.PHONE_PLAN_ID_US_YEARLY,
                "price": 3.99,
                "currency": "USD",
            },
        },
    },
}
_PHONE_PLAN_COUNTRY_LANG_MAPPING: PlanCountryLangMapping = {
    "us": {
        "en": _PHONE_PLAN_ID_MATRIX["usd"]["en"],
    },
    "ca": {
        "en": _PHONE_PLAN_ID_MATRIX["usd"]["en"],
    },
}

_BUNDLE_PLAN_ID_MATRIX: CountryPricePeriodsForCurrencyDict = {
    "usd": {
        "en": {
            "yearly": {
                # To allow testing the subscription flow on stage, we can set
                # a custom plan ID via an environment variable:
                "id": settings.BUNDLE_PLAN_ID_US,
                "price": 6.99,
                "currency": "USD",
            },
        },
    },
}
_BUNDLE_PLAN_COUNTRY_LANG_MAPPING: PlanCountryLangMapping = {
    "us": {
        "en": _BUNDLE_PLAN_ID_MATRIX["usd"]["en"],
    },
    "ca": {
        "en": _BUNDLE_PLAN_ID_MATRIX["usd"]["en"],
    },
}
