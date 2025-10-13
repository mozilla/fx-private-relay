import logging
from string import ascii_uppercase

from django.http import HttpRequest
from django.utils.translation.trans_real import parse_accept_lang_header

info_logger = logging.getLogger("eventsinfo")


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
    # Spanish in UN region 419 (Latin America and Caribbean)
    # Pick Mexico, which has highest number of Spanish speakers
    ("es", "419"): "MX",
    # Would be Galician (Greenland) -> Greenland
    # Change to Galician (Galicia region of Spain) -> Spain
    ("gl", "GL"): "ES",
}


class AcceptLanguageError(ValueError):
    """There was an issue processing the Accept-Language header."""

    def __init__(self, message: str, accept_lang: str | None = None):
        super().__init__(message)
        self.accept_lang = accept_lang


def guess_country_from_accept_lang(accept_lang: str) -> str:
    """
    Guess the user's country from the Accept-Language header

    Return is a 2-letter ISO 3166 country code

    If an issue is detected, a AcceptLanguageError is raised.

    The header may come directly from a web request, or may be the header
    captured by Mozilla Accounts (FxA) at signup.

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
        raise AcceptLanguageError("Unknown language", accept_lang)


def _get_cc_from_lang(accept_lang: str) -> str:
    try:
        return guess_country_from_accept_lang(accept_lang)
    except AcceptLanguageError:
        return ""


def _get_cc_from_request(request: HttpRequest) -> str:
    """Determine the user's region / country code."""

    log_data: dict[str, str] = {}
    cdn_region = None
    region = None
    if "X-Client-Region" in request.headers:
        cdn_region = region = request.headers["X-Client-Region"].upper()
        log_data["cdn_region"] = cdn_region
        log_data["region_method"] = "cdn"

    accept_language_region = None
    if "Accept-Language" in request.headers:
        log_data["accept_lang"] = request.headers["Accept-Language"]
        accept_language_region = _get_cc_from_lang(request.headers["Accept-Language"])
        log_data["accept_lang_region"] = accept_language_region
        if region is None:
            region = accept_language_region
            log_data["region_method"] = "accept_lang"

    if region is None:
        region = "US"
        log_data["region_method"] = "fallback"
    log_data["region"] = region

    # MPP-3284: Log details of region selection. Only log once per request, since some
    # endpoints, like /api/v1/runtime_data, call this multiple times.
    if not getattr(request, "_logged_region_details", False):
        setattr(request, "_logged_region_details", True)
        info_logger.info("region_details", extra=log_data)

    return region
