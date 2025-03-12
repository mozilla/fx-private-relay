from functools import lru_cache
from typing import Literal, TypedDict

#
# Public types
#

CurrencyStr = Literal["CHF", "CZK", "DKK", "EUR", "PLN", "USD"]
LanguageStr = Literal["de", "fr", "it", "nl"]
CountryStr = Literal[
    "AT",
    "BE",
    "BG",
    "CA",
    "CH",
    "CY",
    "CZ",
    "DE",
    "DK",
    "EE",
    "ES",
    "FI",
    "FR",
    "GB",
    "GR",
    "HR",
    "HU",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "MY",
    "NL",
    "NZ",
    "PL",
    "PR",
    "PT",
    "RO",
    "SE",
    "SG",
    "SI",
    "SK",
    "US",
]
PeriodStr = Literal["monthly", "yearly"]
PlanType = Literal["premium", "phones", "bundle"]
"""
PlanType = Literal[
    "relay-premium-127",
    "relay-premium-127-phone",
    "relay-email-phone-protection-127",
    "relay-premium-dev",
    "relay-email-phone-protection-dev",
    "bundle-relay-vpn-dev",
    "relaypremiumemailstage",
    "relaypremiumphonestage",
    "vpnrelaybundlestage"
]
"""


class PlanPricing(TypedDict):
    monthly: dict[Literal["price", "currency"], float | CurrencyStr]
    yearly: dict[Literal["price", "currency"], float | CurrencyStr]


SP3PlanCountryLangMapping = dict[CountryStr, dict[LanguageStr | Literal["*"], PlanPricing]]

#
# Pricing Data (simplified, no Stripe IDs)
#

PLAN_PRICING: dict[PlanType, dict[CurrencyStr, dict[PeriodStr, float]]] = {
    "premium": {
        "CHF": {"monthly": 2.00, "yearly": 1.00},
        "CZK": {"monthly": 47.0, "yearly": 23.0},
        "DKK": {"monthly": 15.0, "yearly": 7.00},
        "EUR": {"monthly": 1.99, "yearly": 0.99},
        "PLN": {"monthly": 8.00, "yearly": 5.00},
        "USD": {"monthly": 1.99, "yearly": 0.99},
    },
    "phones": {
        "USD": {"monthly": 4.99, "yearly": 3.99},
    },
    "bundle": {
        "USD": {"monthly": 6.99, "yearly": 6.99},
    },
}


#
# Public functions
#


def get_country_language_mapping(plan: PlanType) -> SP3PlanCountryLangMapping:
    """Get plan mapping for the given plan type."""
    return _cached_country_language_mapping(plan)


def get_supported_countries(plan: PlanType) -> set[CountryStr]:
    """Get the country codes where the plan is available."""
    return set(get_country_language_mapping(plan).keys())


def get_subscription_url(plan: PlanType, period: PeriodStr) -> str:
    """Generate the URL for a given plan and period."""
    return f"https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/{plan}/{period}/landing"


def get_premium_countries() -> set[CountryStr]:
    """Return the merged set of premium, phones, and bundle country codes."""
    return (
        get_supported_countries("premium")
        | get_supported_countries("phones")
        | get_supported_countries("bundle")
    )


#
# Internal caching
#


@lru_cache
def _cached_country_language_mapping(plan: PlanType) -> SP3PlanCountryLangMapping:
    """Create the plan mapping."""
    mapping: SP3PlanCountryLangMapping = {}

    for country in _get_supported_countries_by_plan(plan):
        currency = _get_country_currency(country)
        prices = PLAN_PRICING[plan].get(currency, {"monthly": 0.0, "yearly": 0.0})
        mapping[country] = {
            "*": {
                "monthly": {"price": prices["monthly"], "currency": currency},
                "yearly": {"price": prices["yearly"], "currency": currency},
            }
        }

    return mapping


def _get_supported_countries_by_plan(plan: PlanType) -> list[CountryStr]:
    """Return the list of supported countries for the given plan."""
    plan_countries: dict[PlanType, list[CountryStr]] = {
        "premium": [
            "AT",
            "BE",
            "BG",
            "CA",
            "CH",
            "CY",
            "CZ",
            "DE",
            "DK",
            "EE",
            "ES",
            "FI",
            "FR",
            "GB",
            "GR",
            "HR",
            "HU",
            "IE",
            "IT",
            "LT",
            "LU",
            "LV",
            "MT",
            "MY",
            "NL",
            "NZ",
            "PL",
            "PR",
            "PT",
            "RO",
            "SE",
            "SG",
            "SI",
            "SK",
            "US",
        ],
        "phones": ["US", "CA", "PR"],
        "bundle": ["US", "CA", "PR"],
    }
    return plan_countries.get(plan, [])


def _get_country_currency(country: CountryStr) -> CurrencyStr:
    """Return the default currency for a given country."""
    country_currency_map: dict[CountryStr, CurrencyStr] = {
        "AT": "EUR",
        "BE": "EUR",
        "BG": "EUR",
        "CA": "USD",
        "CH": "CHF",
        "CY": "EUR",
        "CZ": "CZK",
        "DE": "EUR",
        "DK": "DKK",
        "EE": "EUR",
        "ES": "EUR",
        "FI": "EUR",
        "FR": "EUR",
        "GB": "USD",
        "GR": "EUR",
        "HR": "EUR",
        "HU": "EUR",
        "IE": "EUR",
        "IT": "EUR",
        "LT": "EUR",
        "LU": "EUR",
        "LV": "EUR",
        "MT": "EUR",
        "MY": "USD",
        "NL": "EUR",
        "NZ": "USD",
        "PL": "PLN",
        "PR": "USD",
        "PT": "EUR",
        "RO": "EUR",
        "SE": "EUR",
        "SG": "USD",
        "SI": "EUR",
        "SK": "EUR",
        "US": "USD",
    }
    return country_currency_map.get(country, "USD")
