"""
Paid plans for Relay with SubPlat3 urls.

There is currently a free plan and 3 paid plans:

* free - limited random email masks, one reply
* premium - unlimited email masks, replies, and a custom subdomain
* phones - premium, plus a phone mask
* bundle - premium and phones, plus Mozilla VPN
* megabundle - relay, monitor, and vpn

get_sp3_country_language_mapping gets the details of the paid plans in this structure:

{
  "AT": {
    "*": {
      "monthly": {
        "id": "",
        "price": 1.99,
        "currency": "EUR",
        "url": "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127/monthly/landing",
      },
      "yearly": {
        "id": "",
        "price": 0.99,
        "currency": "EUR",
        "url": "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127/yearly/landing",
      },
    },
  },
  ...
}

This says that Austria (RelayCountryStr "AT") with any language ("*")
has a monthly and a yearly plan. The monthly plan has a Stripe ID of
"price_1LYC79JNcmPzuWtRU7Q238yL", costs €1.99 (CurrencyStr "EUR"), and the sp3 purchase
link url is "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127/monthly/landing".
The yearly plan has a Stripe ID of "price_1LYC7xJNcmPzuWtRcdKXCVZp", costs €11.88 a year
(equivalent to €0.99 a month), and the SP3 purchase link url is
"https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127/yearly/landing".

The top-level keys say which countries are supported. The function get_premium_countries
returns these as a set, when the rest of the data is unneeded.

The second-level keys are the languages for that country. When all languages in that
country have the same plan, the single entry is "*". In SubPlat3, all countries have
"*", because Relay does not need to distinguish between the languages in a country:
SubPlat3 does that for us. We have kept the second-level structure for backwards
compatibility with SP2 code while we migrate to SP3. When we have migrated to SP3, we
could refactor the data structure to remove the unneeded 2nd-level language keys.

The third-level keys are the plan periods. Premium and phones are available on
monthly and yearly periods, and bundle is yearly only.
"""

from functools import lru_cache
from typing import Literal, TypedDict, assert_never, get_args

from django.conf import settings
from django.http import HttpRequest

from privaterelay.country_utils import _get_cc_from_request

#
# Public types
#

PlanType = Literal["premium", "phones", "bundle", "megabundle"]
PeriodStr = Literal["monthly", "yearly"]
CurrencyStr = Literal["CHF", "CZK", "DKK", "EUR", "PLN", "USD"]
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
# See https://docs.google.com/spreadsheets/d/1qThASP94f4KBSwc4pOJRcb09cSInw7vUy_SE8y4KKPc/edit?usp=sharing for valid product keys  # noqa: E501  # ignore long line for URL
ProductKey = Literal[
    # local product keys
    "relay-premium-127",
    "relay-premium-127-phone",
    "relay-email-phone-protection-127",
    # dev product keys
    "relay-premium-dev",
    "relay-email-phone-protection-dev",
    "bundle-relay-vpn-dev",
    # stage product keys
    "relaypremiumemailstage",
    "relaypremiumphonestage",
    "vpnrelaybundlestage",
    # production product keys
    "relaypremium",
    "relaypremiumphone",
    "vpn-relay-bundle",
    "privacyprotectionplan",
]

TEST_PRODUCT_KEYS = [
    "premium-key",
    "phones-key",
    "bundle-key",
    "new-premium-key",
    "new-phones-key",
    "new-bundle-key",
]


class PlanPricing(TypedDict):
    monthly: dict[Literal["price", "currency", "url"], float | CurrencyStr | str]
    yearly: dict[Literal["price", "currency", "url"], float | CurrencyStr | str]


SP3PlanCountryLangMapping = dict[CountryStr, dict[Literal["*"], PlanPricing]]

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
    "megabundle": {
        "USD": {"monthly": 8.25, "yearly": 8.25},
    },
}


#
# Public functions
#


def get_sp3_country_language_mapping(plan: PlanType) -> SP3PlanCountryLangMapping:
    """Get plan mapping for the given plan type."""
    return _cached_country_language_mapping(plan)


def get_supported_countries(plan: PlanType) -> set[CountryStr]:
    """Get the country codes where the plan is available."""
    return set(get_sp3_country_language_mapping(plan).keys())


def get_subscription_url(plan: PlanType, period: PeriodStr) -> str:
    """Generate the URL for a given plan and period."""
    product_key: str
    match plan:
        case "phones":
            product_key = settings.SUBPLAT3_PHONES_PRODUCT_KEY
        case "premium":
            product_key = settings.SUBPLAT3_PREMIUM_PRODUCT_KEY
        case "bundle":
            product_key = settings.SUBPLAT3_BUNDLE_PRODUCT_KEY
        case "megabundle":
            product_key = settings.SUBPLAT3_MEGABUNDLE_PRODUCT_KEY
        case _ as unreachable:  # pragma: no cover
            assert_never(unreachable)
    valid_keys = list(get_args(ProductKey))
    if settings.IN_PYTEST:
        valid_keys.extend(TEST_PRODUCT_KEYS)
    if product_key not in valid_keys:
        raise ValueError("'{product_key}' is not a ProductKey")
    return f"{settings.SUBPLAT3_HOST}/{product_key}/{period}/landing"


def get_premium_countries() -> set[CountryStr]:
    """Return the merged set of premium, phones, and bundle country codes."""
    return (
        get_supported_countries("premium")
        | get_supported_countries("phones")
        | get_supported_countries("bundle")
    )


def is_plan_available_in_country(request: HttpRequest, plan: PlanType) -> bool:
    country_code = _get_cc_from_request(request)
    return country_code in get_supported_countries(plan)


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
                "monthly": {
                    "price": prices["monthly"],
                    "currency": currency,
                    "url": get_subscription_url(plan, "monthly"),
                },
                "yearly": {
                    "price": prices["yearly"],
                    "currency": currency,
                    "url": get_subscription_url(plan, "yearly"),
                },
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
        "megabundle": ["US"],
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
