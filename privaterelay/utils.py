from decimal import Decimal
from functools import wraps
from typing import Callable
import random

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.http import Http404

from waffle import get_waffle_flag_model
from waffle.models import logger as waffle_logger
from waffle.utils import (
    get_cache as get_waffle_cache,
    get_setting as get_waffle_setting,
)


def get_countries_info_from_request_and_mapping(request, mapping):
    country_code = _get_cc_from_request(request, mapping)
    countries = mapping.keys()
    available_in_country = country_code in countries
    return {
        "country_code": country_code,
        "countries": countries,
        "available_in_country": available_in_country,
        "plan_country_lang_mapping": mapping,
    }


def _get_cc_from_request(request, premium_mapping):
    if "X-Client-Region" in request.headers:
        return request.headers["X-Client-Region"].lower()
    if "Accept-Language" in request.headers:
        return get_premium_country_lang(
            request.headers["Accept-Language"], premium_mapping
        )[0]
    if settings.DEBUG:
        return "us"
    return "us"


def get_premium_country_lang(accept_lang, mapping, cc=None):
    lang = accept_lang.split(",")[0]
    lang_parts = lang.split("-") if lang and "-" in lang else [lang]
    lang = lang_parts[0].lower()
    if cc is None:
        cc = lang_parts[1] if len(lang_parts) >= 2 else lang_parts[0]
        cc = cc.lower()
        # if the language was just "en", default to US
        if cc == "en":
            cc = "us"

    if languages := mapping.get(cc):
        if lang in languages.keys():
            return cc, lang
        return cc, list(languages.keys())[0]
    return cc, "en"


def enable_or_404(
    check_function: Callable[[], bool],
    message: str = "This conditional view is disabled.",
):
    """
    Returns decorator that enables a view if a check function passes,
    otherwise returns a 404.

    Usage:

        def percent_1():
           import random
           return random.randint(1, 100) == 1

        @enable_if(coin_flip)
        def lucky_view(request):
            #  1 in 100 chance of getting here
            # 99 in 100 chance of 404
    """

    def decorator(func):
        @wraps(func)
        def inner(*args, **kwargs):
            if check_function():
                return func(*args, **kwargs)
            else:
                raise Http404(message)  # Display a message with DEBUG=True

        return inner

    return decorator


def enable_if_setting(
    setting_name: str,
    message_fmt: str = "This view is disabled because {setting_name} is False",
):
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

        if Decimal(str(random.uniform(0, 100))) <= flag.percent:
            # Removed - setting the flag for future checks
            return True

    return False
