from decimal import Decimal
from functools import wraps
from string import ascii_uppercase
from typing import Callable, TypedDict
import random

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.http import Http404, HttpRequest
from django.utils.translation.trans_real import parse_accept_lang_header

from waffle import get_waffle_flag_model
from waffle.models import logger as waffle_logger
from waffle.utils import (
    get_cache as get_waffle_cache,
    get_setting as get_waffle_setting,
)

from .plans import PlanCountryLangMapping, CountryStr


class CountryInfo(TypedDict):
    country_code: str
    countries: list[CountryStr]
    available_in_country: bool
    plan_country_lang_mapping: PlanCountryLangMapping


def get_countries_info_from_request_and_mapping(
    request: HttpRequest, mapping: PlanCountryLangMapping
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


def _get_cc_from_request(request: HttpRequest) -> str:
    if "X-Client-Region" in request.headers:
        return request.headers["X-Client-Region"].upper()
    if "Accept-Language" in request.headers:
        return _get_cc_from_lang(request.headers["Accept-Language"])
    return "US"


def _get_cc_from_lang(accept_lang: str) -> str:
    try:
        return guess_country_from_accept_lang(accept_lang)
    except AcceptLanguageError:
        return ""


# Map a primary language to the most probable country
# Top country derived from CLDR42 Supplemental Data, Language-Territory Information
# with the exception of Spanish (es), which is mapped to Spain (es) instead of
# Mexico (mx), which has the most speakers, but usually specifies es-MX.
_PRIMARY_LANGUAGE_TO_COUNTRY = {
    "ace": "ID",  # # Acehnese -> Indonesia
    "ach": "UG",  # Acholi -> Uganda
    "af": "ZA",  # Afrikaans -> South Africa
    "an": "ES",  # Aragonese -> Spain
    "ar": "EG",  # Arabic -> Egypt
    "arn": "CL",  # Mapudungun -> Chile
    "as": "IN",  # Assamese -> India
    "ast": "ES",  # Asturian -> Spain
    "az": "AZ",  # Azerbaijani -> Azerbaijan
    "be": "BY",  # Belerusian -> Belarus
    "bg": "BG",  # Bulgarian -> Bulgaria
    "bn": "BD",  # Bengali -> Bangladesh
    "bo": "CN",  # Tibetan -> China
    "br": "FR",  # Breton -> France
    "brx": "IN",  # Bodo -> India
    "bs": "BA",  # Bosnian -> Bosnia and Herzegovina
    "ca": "FR",  # Catalan -> France
    "cak": "MX",  # Kaqchikel -> Mexico
    "ckb": "IQ",  # Central Kurdish -> Iraq
    "cs": "CZ",  # Czech -> Czech Republic
    "cv": "RU",  # Chuvash -> Russia
    "cy": "GB",  # Welsh -> United Kingdom
    "da": "DK",  # Danish -> Denmark
    "de": "DE",  # German -> Germany
    "dsb": "DE",  # Lower Sorbian -> Germany
    "el": "GR",  # Greek -> Greece
    "en": "US",  # English -> Canada
    "eo": "SM",  # Esperanto -> San Marino
    "es": "ES",  # Spanish -> Spain (instead of Mexico, top by population)
    "et": "EE",  # Estonian -> Estonia
    "eu": "ES",  # Basque -> Spain
    "fa": "IR",  # Persian -> Iran
    "ff": "SN",  # Fulah -> Senegal
    "fi": "FI",  # Finnish -> Finland
    "fr": "FR",  # French -> France
    "frp": "FR",  # Arpitan -> France
    "fur": "IT",  # Friulian -> Italy
    "fy": "NL",  # Frisian -> Netherlands
    "ga": "IE",  # Irish -> Ireland
    "gd": "GB",  # Scottish Gaelic -> United Kingdom
    "gl": "ES",  # Galician -> Spain
    "gn": "PY",  # Guarani -> Paraguay
    "gu": "IN",  # Gujarati -> India
    "gv": "IM",  # Manx -> Isle of Man
    "he": "IL",  # Hebrew -> Israel
    "hi": "IN",  # Hindi -> India
    "hr": "HR",  # Croatian -> Croatia
    "hsb": "DE",  # Upper Sorbian -> Germany
    "hu": "HU",  # Hungarian -> Hungary
    "hy": "AM",  # Armenian -> Armenia
    "hye": "AM",  # Armenian Eastern Classic Orthography -> Armenia
    "ia": "FR",  # Interlingua -> France
    "id": "ID",  # Indonesian -> Indonesia
    "ilo": "PH",  # Iloko -> Philippines
    "is": "IS",  # Icelandic -> Iceland
    "it": "IT",  # Italian -> Italy
    "ixl": "MX",  # Ixil -> Mexico
    "ja": "JP",  # Japanese -> Japan
    "jiv": "MX",  # Shuar -> Mexico
    "ka": "GE",  # Georgian -> Georgia
    "kab": "DZ",  # Kayble -> Algeria
    "kk": "KZ",  # Kazakh -> Kazakhstan
    "km": "KH",  # Khmer -> Cambodia
    "kn": "IN",  # Kannada -> India
    "ko": "KR",  # Korean -> South Korea
    "ks": "IN",  # Kashmiri -> India
    "lb": "LU",  # Luxembourgish -> Luxembourg
    "lg": "UG",  # Luganda -> Uganda
    "lij": "IT",  # Ligurian -> Italy
    "lo": "LA",  # Lao -> Laos
    "lt": "LT",  # Lithuanian -> Lithuania
    "ltg": "LV",  # Latgalian -> Latvia
    "lus": "US",  # Mizo -> United States
    "lv": "LV",  # Latvian -> Latvia
    "mai": "IN",  # Maithili -> India
    "meh": "MX",  # Mixteco Yucuhiti -> Mexico
    "mix": "MX",  # Mixtepec Mixtec -> Mexico
    "mk": "MK",  # Macedonian -> North Macedonia
    "ml": "IN",  # Malayalam -> India
    "mr": "IN",  # Marathi -> India
    "ms": "MY",  # Malay -> Malaysia
    "my": "MM",  # Burmese -> Myanmar
    "nb": "NO",  # Norwegian Bokmål -> Norway
    "ne": "NP",  # Nepali -> Nepal
    "nl": "NL",  # Dutch -> Netherlands
    "nn": "NO",  # Norwegian Nynorsk -> Norway
    "oc": "FR",  # Occitan -> France
    "or": "IN",  # Odia -> India
    "pa": "IN",  # Punjabi -> India
    "pl": "PL",  # Polish -> Poland
    "ppl": "MX",  # Náhuat Pipil -> Mexico
    "pt": "BR",  # Portuguese -> Brazil
    "quc": "GT",  # K'iche' -> Guatemala
    "rm": "CH",  # Romansh -> Switzerland
    "ro": "RO",  # Romanian -> Romania
    "ru": "RU",  # Russian -> Russia
    "sat": "IN",  # Santali (Ol Chiki) -> India
    "sc": "IT",  # Sardinian -> Italy
    "scn": "IT",  # Sicilian -> Italy
    "sco": "GB",  # Scots -> United Kingdom
    "si": "LK",  # Sinhala -> Sri Lanka
    "sk": "SK",  # Slovak -> Slovakia
    "skr": "PK",  # Saraiki -> Pakistan
    "sl": "SI",  # Slovenian -> Slovenia
    "son": "ML",  # Songhay -> Mali
    "sq": "AL",  # Albanian -> Albania
    "sr": "RS",  # Serbian -> Serbia
    "sv": "SE",  # Swedish -> Sweeden
    "sw": "TZ",  # Swahili -> Tanzania
    "szl": "PL",  # Silesian -> Poland
    "ta": "IN",  # Tamil -> India
    "te": "IN",  # Telugu -> India
    "tg": "TJ",  # Tajik -> Tajikistan
    "th": "TH",  # Thai -> Thailand
    "tl": "PH",  # Tagalog -> Philippines
    "tr": "TR",  # Turkish or Crimean Tatar -> Turkey
    "trs": "MX",  # Triqui -> Mexico
    "uk": "UA",  # Ukrainian -> Ukraine
    "ur": "PK",  # Urdu -> Pakistan
    "uz": "UZ",  # Uzbek -> Uzbekistan
    "vi": "VN",  # Vietnamese -> Vietnam
    "wo": "SN",  # Wolof -> Senegal
    "xcl": "AM",  # Armenian Classic -> Armenia
    "xh": "ZA",  # Xhosa -> South Africa
    "zam": "MX",  # Miahuatlán Zapotec -> Mexico
    "zh": "CN",  # Chinese -> China
}

# Special cases for language tags
_LANGUAGE_TAG_TO_COUNTRY_OVERRIDE = {
    # Would be Catalan in Valencian script -> France
    # Change to Valencian -> Spain
    ("ca", "VALENCIA"): "ES",
    # Spanish in UN region 419 (Latin America and Carribean)
    # Pick Mexico, which has highest number of Spanish speakers
    ("es", "419"): "MX",
    # Would be Galician (Greenland) -> Greenland
    # Change to Galician (Galicia region of Spain) -> Spain
    ("gl", "GL"): "ES",
}


class AcceptLanguageError(ValueError):
    """There was an issue processing the Accept-Language header."""

    def __init__(self, message, accept_lang):
        super().__init__(message)
        self.accept_lang = accept_lang


def guess_country_from_accept_lang(accept_lang: str) -> str:
    """
    Guess the user's country from the Accept-Language header

    Return is a 2-letter ISO 3166 country code

    If an issue is detected, a AcceptLanguageError is raised.

    The header may come directly from a web request, or may be the header
    captured by Firefox Accounts (FxA) at signup.

    Even with all this logic and special casing, it is still more accurate to
    use a GeoIP lookup or a country code provided by the infrastructure.

    See RFC 9110, "HTTP Semantics", section 12.5.4, "Accept-Language"
    See RFC 5646, "Tags for Identifying Languages", and examples in Appendix A
    """
    lang_q_pairs = parse_accept_lang_header(accept_lang.strip())
    if not lang_q_pairs:
        raise AcceptLanguageError("Invalid Accept-Language string", accept_lang)
    top_lang_tag = lang_q_pairs[0][0]

    subtags = top_lang_tag.split("-")
    lang = subtags[0].lower()
    if lang == "i":
        raise AcceptLanguageError("Irregular language tag", accept_lang)
    if lang == "x":
        raise AcceptLanguageError("Private-use language tag", accept_lang)
    if lang == "*":
        raise AcceptLanguageError("Wildcard language tag", accept_lang)
    if len(lang) < 2:
        raise AcceptLanguageError("Invalid one-character primary language", accept_lang)
    if len(lang) == 3 and lang[0] == "q" and lang[1] <= "t":
        raise AcceptLanguageError(
            "Private-use language tag (RFC 5646 2.2.1)", accept_lang
        )

    for maybe_region_raw in subtags[1:]:
        maybe_region = maybe_region_raw.upper()

        # Look for a special case
        if override := _LANGUAGE_TAG_TO_COUNTRY_OVERRIDE.get((lang, maybe_region)):
            return override

        if len(maybe_region) <= 1:
            # One-character extension or empty, stop processing
            break
        if (
            len(maybe_region) == 2
            and all(c in ascii_uppercase for c in maybe_region)
            and
            # RFC 5646 2.2.4 "Region Subtag" point 6, reserved subtags
            maybe_region != "AA"
            and maybe_region != "ZZ"
            and maybe_region[0] != "X"
            and (maybe_region[0] != "Q" or maybe_region[1] < "M")
        ):
            # Subtag is a non-private ISO 3166 country code
            return maybe_region

        # Subtag is probably a script, like "Hans" in "zh-Hans-CN"
        # Loop to the next subtag, which might be a ISO 3166 country code

    # Guess the country from a simple language tag
    try:
        return _PRIMARY_LANGUAGE_TO_COUNTRY[lang]
    except KeyError:
        raise AcceptLanguageError("Unknown langauge", accept_lang)


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
