"""Paid plans for Relay"""

from django.conf import settings


def get_premium_country_language_mapping(eu_country_expansion):
    mapping = settings.PERIODICAL_PREMIUM_PLAN_COUNTRY_LANG_MAPPING.copy()
    if eu_country_expansion:
        mapping.update(settings.EU_EXPANSION_PREMIUM_PLAN_COUNTRY_LANG_MAPPING)
    return mapping


def get_premium_countries(eu_country_expansion):
    mapping = get_premium_country_language_mapping(eu_country_expansion)
    return set(mapping.keys())


def get_phone_country_language_mapping():
    return settings.PHONE_PLAN_COUNTRY_LANG_MAPPING


def get_bundle_country_language_mapping():
    return settings.BUNDLE_PLAN_COUNTRY_LANG_MAPPING.copy()
