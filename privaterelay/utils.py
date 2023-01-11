from functools import wraps
from typing import Callable

from django.conf import settings
from django.http import Http404


def get_countries_info_from_request_and_mapping(request, mapping):
    country_code = _get_cc_from_request(request)
    countries = mapping.keys()
    available_in_country = country_code in countries
    return {
        "country_code": country_code,
        "countries": countries,
        "available_in_country": available_in_country,
        "plan_country_lang_mapping": mapping,
    }


def _get_cc_from_request(request):
    if "X-Client-Region" in request.headers:
        return request.headers["X-Client-Region"].lower()
    if "Accept-Language" in request.headers:
        return get_premium_country_lang(request.headers["Accept-Language"])[0]
    if settings.DEBUG:
        return "us"
    return "us"


def get_premium_country_lang(accept_lang, cc=None):
    lang = accept_lang.split(",")[0]
    lang_parts = lang.split("-") if lang and "-" in lang else [lang]
    lang = lang_parts[0].lower()
    if cc is None:
        cc = lang_parts[1] if len(lang_parts) == 2 else lang_parts[0]
        cc = cc.lower()
        # if the language was just "en", default to US
        if cc == "en":
            cc = "us"

    if cc in settings.PERIODICAL_PREMIUM_PLAN_COUNTRY_LANG_MAPPING.keys():
        languages = settings.PERIODICAL_PREMIUM_PLAN_COUNTRY_LANG_MAPPING[cc]
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
