from __future__ import annotations

import json
import logging
import random
from collections.abc import Callable
from decimal import Decimal
from functools import cache, wraps
from pathlib import Path
from typing import TYPE_CHECKING, ParamSpec, TypedDict, TypeVar, cast

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.http import Http404, HttpRequest

from waffle import get_waffle_flag_model
from waffle.models import logger as waffle_logger
from waffle.utils import get_cache as get_waffle_cache
from waffle.utils import get_setting as get_waffle_setting

from privaterelay.country_utils import (
    AcceptLanguageError,
    _get_cc_from_lang,
    _get_cc_from_request,
    guess_country_from_accept_lang,
)
from privaterelay.sp3_plans import SP3PlanCountryLangMapping

from .plans import (
    CountryStr,
    LanguageStr,
    PeriodStr,
    PlanCountryLangMapping,
    get_premium_country_language_mapping,
)

if TYPE_CHECKING:
    from .glean_interface import RelayGleanLogger

info_logger = logging.getLogger("eventsinfo")


class CountryInfo(TypedDict):
    country_code: str
    countries: list[CountryStr]
    available_in_country: bool
    plan_country_lang_mapping: PlanCountryLangMapping | SP3PlanCountryLangMapping


def get_countries_info_from_request_and_mapping(
    request: HttpRequest, mapping: PlanCountryLangMapping | SP3PlanCountryLangMapping
) -> CountryInfo:
    country_code = _get_cc_from_request(request)
    countries = sorted(mapping.keys())
    available_in_country = country_code in countries
    return {
        "country_code": country_code,
        "countries": countries,
        "available_in_country": available_in_country,
        "plan_country_lang_mapping": mapping,
    }


def get_countries_info_from_lang_and_mapping(
    accept_lang: str, mapping: PlanCountryLangMapping
) -> CountryInfo:
    country_code = _get_cc_from_lang(accept_lang)
    countries = sorted(mapping.keys())
    available_in_country = country_code in countries
    return {
        "country_code": country_code,
        "countries": countries,
        "available_in_country": available_in_country,
        "plan_country_lang_mapping": mapping,
    }


def get_subplat_upgrade_link_by_language(
    accept_language: str, period: PeriodStr = "yearly"
) -> str:
    try:
        country_str = guess_country_from_accept_lang(accept_language)
        country = cast(CountryStr, country_str)
    except AcceptLanguageError:
        country = "US"
    language_str = accept_language.split("-")[0].lower()
    language = cast(LanguageStr, language_str)
    country_lang_mapping = get_premium_country_language_mapping()
    country_details = country_lang_mapping.get(country, country_lang_mapping["US"])
    if language in country_details:
        plan = country_details[language][period]
    else:
        first_key = list(country_details.keys())[0]
        plan = country_details[first_key][period]
    return (
        f"{settings.FXA_BASE_ORIGIN}/subscriptions/products/"
        f"{settings.PERIODICAL_PREMIUM_PROD_ID}?plan={plan['id']}"
    )


# Generics for defining function decorators
# https://mypy.readthedocs.io/en/stable/generics.html#declaring-decorators
_Params = ParamSpec("_Params")
_RetVal = TypeVar("_RetVal")


def enable_or_404(
    check_function: Callable[[], bool],
    message: str = "This conditional view is disabled.",
) -> Callable[[Callable[_Params, _RetVal]], Callable[_Params, _RetVal]]:
    """
    Returns decorator that enables a view if a check function passes,
    otherwise returns a 404.

    Usage:

        def percent_1():
           import random
           return random.randint(1, 100) == 1

        @enable_if(percent_1)
        def lucky_view(request):
            #  1 in 100 chance of getting here
            # 99 in 100 chance of 404
    """

    def decorator(func: Callable[_Params, _RetVal]) -> Callable[_Params, _RetVal]:
        @wraps(func)
        def inner(*args: _Params.args, **kwargs: _Params.kwargs) -> _RetVal:
            if check_function():
                return func(*args, **kwargs)
            else:
                raise Http404(message)  # Display a message with DEBUG=True

        return inner

    return decorator


def enable_if_setting(
    setting_name: str,
    message_fmt: str = "This view is disabled because {setting_name} is False",
) -> Callable[[Callable[_Params, _RetVal]], Callable[_Params, _RetVal]]:
    """
    Returns decorator that enables a view if a setting is truthy, otherwise
    returns a 404.

    Usage:

        @enable_if_setting("DEBUG")
        def debug_only_view(request):
            # DEBUG == True

    Or in URLS:

        path(
            "developer_info",
            enable_if_setting("DEBUG")(debug_only_view)
        ),
        name="developer-info",
    ),

    """

    def setting_is_truthy() -> bool:
        return bool(getattr(settings, setting_name))

    return enable_or_404(
        setting_is_truthy, message_fmt.format(setting_name=setting_name)
    )


def flag_is_active_in_task(flag_name: str, user: AbstractBaseUser | None) -> bool:
    """
    Test if a flag is active in a task (not in a web request).

    This mirrors AbstractBaseFlag.is_active, replicating these checks:
    * Logs missing flags, if configured
    * Creates missing flags, if configured
    * Returns default for missing flags
    * Checks flag.everyone
    * Checks flag.users and flag.groups, if a user is passed
    * Returns random results for flag.percent

    It does not include:
    * Overriding a flag with a query parameter
    * Persisting a flag in a cookie (includes percent flags)
    * Language-specific overrides (could be added later)
    * Read-only mode for percent flags

    When using this function, use the @override_flag decorator in tests, rather
    than manually creating flags in the database.
    """
    flag = get_waffle_flag_model().get(flag_name)
    if not flag.pk:
        log_level = get_waffle_setting("LOG_MISSING_FLAGS")
        if log_level:
            waffle_logger.log(log_level, "Flag %s not found", flag_name)
        if get_waffle_setting("CREATE_MISSING_FLAGS"):
            flag, _created = get_waffle_flag_model().objects.get_or_create(
                name=flag_name,
                defaults={"everyone": get_waffle_setting("FLAG_DEFAULT")},
            )
            cache = get_waffle_cache()
            cache.set(flag._cache_key(flag.name), flag)

        return bool(get_waffle_setting("FLAG_DEFAULT"))

    # Removed - check for override as request query parameter

    if flag.everyone:
        return True
    elif flag.everyone is False:
        return False

    # Removed - check for testing override in request query or cookie
    # Removed - check for language-specific override

    if user is not None:
        active_for_user = flag.is_active_for_user(user)
        if active_for_user is not None:
            return bool(active_for_user)

    if flag.percent and flag.percent > 0:
        # Removed - check for waffles attribute of request
        # Removed - check for cookie setting for flag
        # Removed - check for read-only mode

        if Decimal(str(random.uniform(0, 100))) <= flag.percent:  # noqa: S311
            # Removed - setting the flag for future checks
            return True

    return False


class VersionInfo(TypedDict):
    source: str
    version: str
    commit: str
    build: str


@cache
def get_version_info(base_dir: str | Path | None = None) -> VersionInfo:
    """Return version information written by build process."""
    if base_dir is None:
        base_path = Path(settings.BASE_DIR)
    else:
        base_path = Path(base_dir)
    version_json_path = base_path / "version.json"
    info = {}
    if version_json_path.exists():
        with version_json_path.open() as version_file:
            try:
                info = json.load(version_file)
            except ValueError:
                pass
            if not hasattr(info, "get"):
                info = {}
    version_info = VersionInfo(
        source=info.get("source", "https://github.com/mozilla/fx-private-relay"),
        version=info.get("version", "unknown"),
        commit=info.get("commit", "unknown"),
        build=info.get("build", "not built"),
    )
    return version_info


@cache
def glean_logger() -> RelayGleanLogger:
    from .glean_interface import RelayGleanLogger

    version_info = get_version_info()
    return RelayGleanLogger(
        application_id="relay-backend",
        app_display_version=version_info["version"],
        channel=settings.RELAY_CHANNEL,
    )
