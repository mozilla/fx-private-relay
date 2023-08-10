from typing import Iterator
from unittest.mock import patch
import logging

from django.contrib.auth.models import AbstractBaseUser, Group, User
from django.core.cache.backends.base import BaseCache

from _pytest.fixtures import SubRequest
from _pytest.logging import LogCaptureFixture
from pytest_django.fixtures import SettingsWrapper
from waffle.models import Flag
from waffle.testutils import override_flag
from waffle.utils import get_cache as get_waffle_cache
import pytest

from ..plans import get_premium_country_language_mapping
from ..utils import (
    AcceptLanguageError,
    flag_is_active_in_task,
    get_countries_info_from_request_and_mapping,
    guess_country_from_accept_lang,
)


@pytest.mark.parametrize(
    "accept_lang,expected_country_code",
    (
        ("en-au,", "AU"),
        ("en-us,", "US"),
        ("de-be,", "BE"),
        ("en", "US"),
        ("sgn-us", "US"),  # American Sign Language
        ("sgn-ch-de", "CH"),  # Swiss German Sign Language
        ("et-ee", "EE"),
        # Good headers, from Django test test_parse_spec_http_header
        ("de", "DE"),
        ("en-AU", "AU"),
        ("es-419", "MX"),
        ("en-AU;q=0.123", "AU"),
        ("en-au;q=0.5", "AU"),
        ("en-au;q=1.0", "AU"),
        ("da, en-gb;q=0.25, en;q=0.5", "DK"),
        ("de,en-au;q=0.75,en-us;q=0.5,en;q=0.25,es;q=0.125,fa;q=0.125", "DE"),
        ("de;q=0.", "DE"),
        ("en; q=1,", "US"),
        ("en; q=1.0, * ; q=0.5", "US"),
        # Default Accept-Language headers from Firefox
        # https://pontoon.mozilla.org/de/firefox/toolkit/chrome/global/intl.properties/?string=81017
        ("ace, id, en-US, en", "ID"),  # Acehnese -> Indonesia
        ("ach, en-GB, en-US, en", "UG"),  # Acholi -> Uganda
        ("af, en-ZA, en-GB, en-US, en", "ZA"),  # Afrikaans -> South Africa
        ("ar, en-us, en", "EG"),  # Arabic -> Egypt
        ("arn,es-CL,es-AR,es-MX,es-ES,es,en-US,en", "CL"),  # Mapudungun -> Chile
        ("an, es-ES, es, ca, en-US, en", "ES"),  # Aragonese -> Spain
        ("as, en-us, en", "IN"),  # Assamese -> India
        ("ast, es-ES, es, en-US, en", "ES"),  # Asturian -> Spain
        ("az-AZ, az, en-US, en", "AZ"),  # Azerbaijani -> Azerbaijan
        ("be, en-US, en", "BY"),  # Belerusian -> Belarus
        ("bg, en-US, en", "BG"),  # Bulgarian -> Bulgaria
        ("bn, en-US, en", "BD"),  # Bengali -> Bangladesh
        ("bn-in, bn, en-us, en", "IN"),  # Bengali (India) -> India
        ("bo-CN,bo-IN,bo,en-US, en", "CN"),  # Tibetan -> China
        ("br, fr-FR, fr, en-US, en", "FR"),  # Breton -> France
        ("brx,as,en-US,en", "IN"),  # Bodo -> India
        ("bs-ba, bs, en-us, en", "BA"),  # Bosnian -> Bosnia and Herzegovina
        ("ca, en-us, en", "FR"),  # Catalan -> France
        ("ca-valencia, ca, en-us, en", "ES"),  # Catalan (Valencian) -> Spain
        ("cak, kaq, es, en-us, en", "MX"),  # Kaqchikel -> Mexico
        ("ckb,en-US,en", "IQ"),  # Central Kurdish -> Iraq
        ("cs, sk, en-US, en", "CZ"),  # Czech -> Czech Republic
        ("cv, en-US, en", "RU"),  # Chuvash -> Russia
        ("cy-GB, cy, en-US, en", "GB"),  # Welsh -> United Kingdom
        ("da, en-us, en", "DK"),  # Danish -> Denmark
        ("de, en-US, en", "DE"),  # German -> Germany
        ("dsb, hsb, de, en-US, en", "DE"),  # Lower Sorbian -> Germany
        ("el-GR, el, en-US, en", "GR"),  # Greek -> Greece
        ("en-CA, en-US, en", "CA"),  # English (Canadian) -> Canada
        ("en-GB, en", "GB"),  # English (Great Britain) -> United Kingdom
        ("eo, en-US, en", "SM"),  # Esperanto -> San Marino
        ("es-AR, es, en-US, en", "AR"),  # Spanish (Argentina) -> Argentina
        ("es-CL, es, en-US, en", "CL"),  # Spanish (Chile) -> Chile
        ("es-ES, es, en-US, en", "ES"),  # Spanish (Spain) -> Spain
        ("es-MX, es, en-US, en", "MX"),  # Spanish (Mexico) -> Mexico
        ("et, et-ee, en-us, en", "EE"),  # Estonian -> Estonia
        ("eu, en-us, en", "ES"),  # Basque -> Spain
        ("fa-ir, fa, en-us, en", "IR"),  # Persian -> Iran
        ("ff, fr-FR, fr, en-GB, en-US, en", "SN"),  # Fulah -> Senegal
        ("fi-fi, fi, en-us, en", "FI"),  # Finnish -> Finland
        ("fr, fr-fr, en-us, en", "FR"),  # French -> France
        ("frp, fr-FR, fr, en-US, en", "FR"),  # Arpitan -> France
        ("fur-IT, fur, it-IT, it, en-US, en", "IT"),  # Friulian -> Italy
        ("fy-nl, fy, nl, en-us, en ", "NL"),  # Frisian -> Netherlands
        ("ga-ie, ga, en-ie, en-gb, en-us, en", "IE"),  # Irish -> Ireland
        ("gd-gb, gd, en-gb, en-us, en", "GB"),  # Gaelic, Scottish -> United Kingdom
        ("gl-gl, gl, en-us, en", "ES"),  # Galician -> Spain
        ("gn, es, en-US, en", "PY"),  # Guarani -> Paraguay
        ("gu-in, gu, en-us, en", "IN"),  # Gujarati -> India
        ("gv,en-GB,en-US,en", "IM"),  # Manx -> Isle of Man
        ("he, he-IL, en-US, en", "IL"),  # Hebrew -> Israel
        ("hi-in, hi, en-us, en", "IN"),  # Hindi -> India
        ("hr, hr-HR, en-US, en", "HR"),  # Croatian -> Croatia
        ("hsb, dsb, de, en-US, en", "DE"),  # Upper Sorbian -> Germany
        ("hu-hu, hu, en-US, en", "HU"),  # Hungarian -> Hungary
        ("hy-AM,hy,en-us,en", "AM"),  # Armenian -> Armenia
        ("hye,hy,en-US,en", "AM"),  # Armenian Eastern Classic Orthography -> Armenia
        ("ia, en-US, en", "FR"),  # Interlingua -> France
        ("id, en-us, en", "ID"),  # Indonesian -> Indonesia
        ("ilo-PH, ilo, en-US, en", "PH"),  # Iloko -> Philippines
        ("is, en-us, en", "IS"),  # Icelandic -> Iceland
        ("it-IT, it, en-US, en", "IT"),  # Italian -> Italy
        ("ixl, es-MX, es, en-US, en", "MX"),  # Ixil -> Mexico
        ("ja, en-US, en", "JP"),  # Japanese -> Japan
        ("jiv, es, en-US, en", "MX"),  # Shuar -> Mexico
        ("ka-GE,ka,en-US,en", "GE"),  # Georgian -> Georgia
        ("kab-DZ,kab,fr-FR,fr,en-US,en", "DZ"),  # Kayble -> Algeria
        ("kk, ru, ru-RU, en-US, en", "KZ"),  # Kazakh -> Kazakhstan
        ("km, en-US, en", "KH"),  # Khmer -> Cambodia
        ("kn-IN, kn, en-us, en", "IN"),  # Kannada -> India
        ("ko-KR, ko, en-US, en", "KR"),  # Korean -> South Korea
        ("ks,en-US,en", "IN"),  # Kashmiri -> India
        ("lb, de-DE, de, en-US, en", "LU"),  # Luxembourgish -> Luxembourg
        ("lg, en-gb, en-us, en", "UG"),  # Luganda -> Uganda
        ("lij, it, en-US, en", "IT"),  # Ligurian -> Italy
        ("lo, en-US, en", "LA"),  # Lao -> Laos
        ("lt, en-us, en, ru, pl", "LT"),  # Lithuanian -> Lithuania
        ("ltg, lv, en-US, en", "LV"),  # Latgalian -> Latvia
        ("lus,en-US,en", "US"),  # Mizo -> United States
        ("lv, en-us, en", "LV"),  # Latvian -> Latvia
        ("mai, hi-IN, en", "IN"),  # Maithili -> India
        ("meh,es-MX,es,en-US,en", "MX"),  # Mixteco Yucuhiti -> Mexico
        ("mix,es-MX,es,en-US,en", "MX"),  # Mixtepec Mixtec -> Mexico
        ("mk-mk, mk, en-us, en", "MK"),  # Macedonian -> North Macedonia
        ("ml-in, ml, en-US, en", "IN"),  # Malayalam -> India
        ("mr-IN, mr, en-US, en", "IN"),  # Marathi -> India
        ("ms,en-us, en", "MY"),  # Malay -> Malaysia
        ("my, en-GB, en", "MM"),  # Burmese -> Myanmar
        ("nb-no, nb, no-no, no, nn-no, nn, en-us, en", "NO"),  # No. Bokmål -> Norway
        ("ne-NP, ne, en-US, en", "NP"),  # Nepali -> Nepal
        ("nl, en-US, en", "NL"),  # Dutch -> Netherlands
        ("nn-no, nn, no-no, no, nb-no, nb, en-us, en", "NO"),  # No. Nynorsk -> Norway
        ("oc, ca, fr, es, it, en-US, en", "FR"),  # Occitan -> France
        ("or, en-US, en", "IN"),  # Odia -> India
        ("pa, pa-in, en-us, en", "IN"),  # Punjabi -> India
        ("pl, en-US, en", "PL"),  # Polish -> Poland
        ("ppl,es-MX,es,en-US,en", "MX"),  # Náhuat Pipil -> Mexico
        ("pt-BR, pt, en-US, en", "BR"),  # Portuguese (Brazil) -> Brazil
        ("pt-PT, pt, en, en-US", "PT"),  # Portuguese (Portugal) -> Portugal
        ("quc,es-MX,es,en-US,en", "GT"),  # K'iche' -> Guatemala
        ("rm, rm-ch, de-CH, de, en-us, en", "CH"),  # Romansh -> Switzerland
        ("ro-RO, ro, en-US, en-GB, en", "RO"),  # Romanian -> Romania
        ("ru-RU, ru, en-US, en", "RU"),  # Russian -> Russia
        ("sat, en-US, en", "IN"),  # Santali (Ol Chiki) -> India
        ("sc, it-IT, it, en-US, en", "IT"),  # Sardinian -> Italy
        ("scn, it-IT, it, en-US, en", "IT"),  # Sicilian -> Italy
        ("sco,en-GB,en", "GB"),  # Scots -> United Kingdom
        ("si-LK, si, en-US, en", "LK"),  # Sinhala -> Sri Lanka
        ("sk, cs, en-US, en", "SK"),  # Slovak -> Slovakia
        ("skr,en-US,en", "PK"),  # Saraiki -> Pakistan
        ("sl, en-gb, en", "SI"),  # Slovenian -> Slovenia
        ("son, son-ml, fr, en-us, en", "ML"),  # Songhay -> Mali
        ("sq, sq-AL, en-us, en", "AL"),  # Albanian -> Albania
        ("sr-RS, sr, en-US, en", "RS"),  # Serbian -> Serbia
        ("sv-SE, sv, en-US, en", "SE"),  # Swedish -> Sweeden
        ("sw, en-US, en", "TZ"),  # Swahili -> Tanzania
        ("szl,pl-PL,pl,en,de", "PL"),  # Silesian -> Poland
        ("ta-IN, ta, en-US, en", "IN"),  # Tamil -> India
        ("te-in, te, en-us, en", "IN"),  # Telugu -> India
        ("tg, en-US, en", "TJ"),  # Tajik -> Tajikistan
        ("th, en-US, en", "TH"),  # Thai -> Thailand
        ("tl-PH, tl, en-US, en", "PH"),  # Tagalog -> Philippines
        ("tr-TR, tr, en-US, en", "TR"),  # Turkish OR Crimean Tatar -> Turkey
        ("trs,es-MX,es,en-US,en", "MX"),  # Triqui -> Mexico
        ("uk-UA, uk, en-US, en", "UA"),  # Ukrainian -> Ukraine
        ("ur-PK, ur, en-US, en", "PK"),  # Urdu -> Pakistan
        ("uz, ru, en, en-US", "UZ"),  # Uzbek -> Uzbekistan
        ("vi-vn, vi, en-us, en", "VN"),  # Vietnamese -> Vietnam
        ("wo, en-US, en", "SN"),  # Wolof -> Senegal
        ("xcl,hy,en-US,en", "AM"),  # Armenian Classic -> Armenia
        ("xh-ZA, xh, en-US, en", "ZA"),  # Xhosa
        ("zam, es-MX, es, en-US, en", "MX"),  # Miahuatlán Zapotec
        ("zh-CN, zh, zh-TW, zh-HK, en-US, en", "CN"),  # Chinese (China)
        ("zh-tw, zh, en-us, en", "TW"),  # Chinese (Taiwan)
        # Test cases from RFC 5646, "Tags for Identifying Languages", Appendix A
        # RFC 5646 - Simple language subtag
        ("de", "DE"),  # German -> Germany
        ("fr", "FR"),  # French -> France
        ("ja", "JP"),  # Japanese -> Japan
        # RFC 5646 - Language subtag plus Script subtag
        ("zh-Hant", "CN"),  # Chinese in Traditional Chinese script -> China
        ("zh-Hans", "CN"),  # Chinese in Simplified Chinese script -> China
        ("sr-Cyrl", "RS"),  # Serbian in Cyrillic script -> Serbia
        ("sr-Latn", "RS"),  # Serbian in Latin script -> Serbia
        # RFC 5646 - Extended language subtags with primary language subtag counterparts
        ("zh-cmn-Hans-CN", "CN"),  # Chinese, Mandarin, Simplified script, in China
        ("cmn-Hans-CN", "CN"),  # Mandarin Chinese, Simplified script, as used in China
        ("zh-yue-HK", "HK"),  # Chinese, Cantonese, as used in Hong Kong SAR
        ("yue-HK", "HK"),  # Cantonese Chinese, as used in Hong Kong SAR
        # RFC 5646 - Language-Script-Region
        ("zh-Hans-CN", "CN"),  # Chinese in Simplified script in mainland China -> China
        ("sr-Latn-RS", "RS"),  # Serbian in Latin script in Serbia
        ("zh-Hans-TW", "TW"),  # Chinese in Simplified script in Taiwan (added)
        # RFC 5646 - Language-Variant
        ("sl-rozaj", "SI"),  # Resian dialect of Slovenian -> Slovenia
        ("sl-rozaj-biske", "SI"),  # San Giorgio dialect of Resian dialect of Slovenian
        ("sl-nedis", "SI"),  # Nadiza dialect of Slovenian -> Slovenia
        # RFC 5646 - Language-Region-Variant
        ("de-CH-1901", "CH"),  # German as used in Switzerland using the 1901 variant
        ("sl-IT-nedis", "IT"),  # Slovenian as used in Italy, Nadiza dialect
        # RFC 5646 - Language-Script-Region-Variant
        ("hy-Latn-IT-arevela", "IT"),  # Eastern Armenian in Latin script, in Italy
        # RFC 5646 - Language-Region
        ("de-DE", "DE"),  # German for Germany
        ("en-US", "US"),  # English as used in the United States
        ("es-419", "MX"),  # Spanish in Latin America and Caribbean region (UN code)
        # RFC 5646 - Private use subtags
        ("de-CH-x-phonebk", "CH"),  # Swiss German with private use subtag
        ("az-Arab-x-AZE-derbend", "AZ"),  # another private use subtag
        # RFC 5646 - Private use registry values
        ("de-Qaaa", "DE"),  # German, with a private script
        ("sr-Latn-QM", "RS"),  # Serbian, Latin-script, private region
        ("sr-Qaaa-CS", "CS"),  # Serbian, private script, for Serbia and Montenegro
        # RFC 5646 - Examples of possible tags that use extensions
        ("en-US-u-islamCal", "US"),
        ("zh-CN-a-myext-x-private", "CN"),
        ("en-a-myext-b-another", "US"),
        # RFC 5646 - Invalid tags
        ("de-419-DE", "DE"),  # two region tags
        ("ar-a-aaa-b-bbb-a-ccc", "EG"),  # two extensions with same 1 char prefix 'a'
    ),
)
def test_guess_country_from_accept_lang(accept_lang, expected_country_code) -> None:
    assert guess_country_from_accept_lang(accept_lang) == expected_country_code


@pytest.mark.parametrize(
    "accept_lang",
    (
        # Bad headers, from Django test test_parse_spec_http_header
        "en-gb;q=1.0000",
        "en;q=0.1234",
        "en;q=.2",
        "abcdefghi-au",
        "**",
        "en,,gb",
        "en-au;q=0.1.0",
        ("X" * 97) + "Z,en",
        "da, en-gb;q=0.8, en;q=0.7,#",
        "de;q=2.0",
        "de;q=0.a",
        "12-345",
        "",
        "en;q=1e0",
        "-",
    ),
)
def test_guess_country_from_accept_lang_invalid_fails(accept_lang) -> None:
    """AcceptLanguageError is raised when an Accept-Language string is invalid."""
    with pytest.raises(AcceptLanguageError) as exc_info:
        guess_country_from_accept_lang(accept_lang)
    assert str(exc_info.value) == "Invalid Accept-Language string"
    assert exc_info.value.accept_lang == accept_lang


@pytest.mark.parametrize("accept_lang", ("i-enochian", "i-klingon"))
def test_guess_country_from_accept_lang_irregular_fails(accept_lang) -> None:
    """AcceptLanguageError is raised when an i-X irregular language is first."""
    with pytest.raises(AcceptLanguageError) as exc_info:
        guess_country_from_accept_lang(accept_lang)
    assert str(exc_info.value) == "Irregular language tag"
    assert exc_info.value.accept_lang == accept_lang


def test_guess_country_from_accept_lang_x_private_use_fails() -> None:
    """AcceptLanguageError is raised when a x-X private-use language is first."""
    with pytest.raises(AcceptLanguageError) as exc_info:
        guess_country_from_accept_lang("x-whatever")
    assert str(exc_info.value) == "Private-use language tag"
    assert exc_info.value.accept_lang == "x-whatever"


def test_guess_country_from_accept_lang_qxx_private_use_fails() -> None:
    """AcceptLanguageError is raised when a qXX private-use language is first."""
    with pytest.raises(AcceptLanguageError) as exc_info:
        guess_country_from_accept_lang("qaa-Qaaa-QM-x-southern")
    assert str(exc_info.value) == "Private-use language tag (RFC 5646 2.2.1)"
    assert exc_info.value.accept_lang == "qaa-Qaaa-QM-x-southern"


@pytest.mark.parametrize("accept_lang", ("*;q=1.00", "*"))
def test_guess_country_from_accept_lang_wildcard_fails(accept_lang) -> None:
    """AcceptLanguageError is raised when wildcard language is first."""
    with pytest.raises(AcceptLanguageError) as exc_info:
        guess_country_from_accept_lang(accept_lang)
    assert str(exc_info.value) == "Wildcard language tag"
    assert exc_info.value.accept_lang == accept_lang


@pytest.mark.parametrize("accept_lang", ("a-DE", "b-DE"))
def test_guess_country_from_accept_lang_short_primary_lang_fails(accept_lang) -> None:
    """AcceptLanguageError is raised when a one-character primary language is first."""
    with pytest.raises(AcceptLanguageError) as exc_info:
        guess_country_from_accept_lang(accept_lang)
    assert str(exc_info.value) == "Invalid one-character primary language"
    assert exc_info.value.accept_lang == accept_lang


def test_get_countries_info_bad_accept_language(rf) -> None:
    request = rf.get("/api/v1/runtime_data", HTTP_ACCEPT_LANGUAGE="xx")
    mapping = get_premium_country_language_mapping()
    result = get_countries_info_from_request_and_mapping(request, mapping)
    assert result == {
        "country_code": "",
        "countries": sorted(mapping.keys()),
        "available_in_country": False,
        "plan_country_lang_mapping": mapping,
    }


#
# flag_is_active_in_task tests
#

TEST_FLAG_NAME = "test_flag_name"


@pytest.fixture()
def waffle_cache() -> Iterator[BaseCache]:
    cache = get_waffle_cache()
    yield cache
    cache.clear()


@pytest.fixture
def waffle_settings(settings: SettingsWrapper) -> SettingsWrapper:
    """Initialize waffle-related settings to default values."""
    settings.WAFFLE_FLAG_MODEL = "waffle.Flag"
    settings.WAFFLE_CREATE_MISSING_FLAGS = False
    settings.WAFFLE_LOG_MISSING_FLAGS = None
    settings.WAFFLE_FLAG_DEFAULT = False
    return settings


@pytest.fixture(params=["with_user", "without_user"])
def flag_user(
    request: SubRequest,
    django_user_model: type[AbstractBaseUser],
    waffle_cache: BaseCache,
    waffle_settings: SettingsWrapper,
) -> User | None:
    """Return a Django user, and load fixtures for waffle tests."""
    if request.param == "with_user":
        user = django_user_model.objects.create(username="flag_user")
        assert isinstance(user, User)
        return user
    return None


def test_flag_is_active_for_task_missing_flag(
    flag_user: User | None, caplog: LogCaptureFixture
) -> None:
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_for_task_missing_flag_logged(
    flag_user: User | None, waffle_settings: SettingsWrapper, caplog: LogCaptureFixture
) -> None:
    waffle_settings.WAFFLE_LOG_MISSING_FLAGS = logging.WARNING
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == [
        ("waffle", logging.WARNING, f"Flag {TEST_FLAG_NAME} not found")
    ]
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_for_task_missing_flag_created(
    flag_user: User | None,
    waffle_settings: SettingsWrapper,
    waffle_cache: BaseCache,
    caplog: LogCaptureFixture,
) -> None:
    waffle_settings.WAFFLE_CREATE_MISSING_FLAGS = True
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    flag = Flag.objects.get(name=TEST_FLAG_NAME)
    assert waffle_cache.get(flag._cache_key(TEST_FLAG_NAME)) == flag


def test_flag_is_active_for_task_missing_flag_created_with_default_true(
    flag_user: User | None,
    waffle_settings: SettingsWrapper,
    waffle_cache: BaseCache,
    caplog: LogCaptureFixture,
) -> None:
    waffle_settings.WAFFLE_CREATE_MISSING_FLAGS = True
    waffle_settings.WAFFLE_FLAG_DEFAULT = True
    assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    flag = Flag.objects.get(name=TEST_FLAG_NAME)
    assert waffle_cache.get(flag._cache_key(TEST_FLAG_NAME)) == flag


def test_flag_is_active_for_task_missing_flag_with_default_true(
    flag_user: User | None, waffle_settings: SettingsWrapper, caplog: LogCaptureFixture
) -> None:
    waffle_settings.WAFFLE_FLAG_DEFAULT = True
    assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_for_task_existing_but_off_flag(flag_user: User | None) -> None:
    flag = Flag.objects.create(name=TEST_FLAG_NAME)
    assert flag.everyone is None
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_with_everyone_on_flag(flag_user: User | None) -> None:
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=True)
    assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_with_everyone_off_flag(flag_user: User | None) -> None:
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=False)
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_user_flag(flag_user: User | None) -> None:
    flag = Flag.objects.create(name=TEST_FLAG_NAME)
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    if flag_user is None:
        return  # Nothing further to test without a user
    flag.users.add(flag_user)
    assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_group_flag(flag_user: User | None) -> None:
    flag = Flag.objects.create(name=TEST_FLAG_NAME)
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    if flag_user is None:
        return  # Nothing further to test without a user
    group = Group.objects.create(name=TEST_FLAG_NAME)
    flag.groups.add(group)
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    group.user_set.add(flag_user)
    assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_everyone_overrides_user(
    flag_user: User | None,
) -> None:
    if flag_user is None:
        return  # Nothing further to test without a user
    flag = Flag.objects.create(name=TEST_FLAG_NAME, everyone=False)
    flag.users.add(flag_user)
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_percent_pass(flag_user: User | None) -> None:
    Flag.objects.create(name=TEST_FLAG_NAME, percent=50.0)
    with patch("privaterelay.utils.random.uniform", return_value=49.0):
        assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_percent_fail(flag_user: User | None) -> None:
    Flag.objects.create(name=TEST_FLAG_NAME, percent=50.0)
    with patch("privaterelay.utils.random.uniform", return_value=50.1):
        assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_override_missing_to_active(
    flag_user: User | None,
) -> None:
    with override_flag(TEST_FLAG_NAME, active=True):
        assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_for_task_override_missing_to_not_active(
    flag_user: User | None,
) -> None:
    with override_flag(TEST_FLAG_NAME, active=False):
        assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_for_task_override_existing_to_active(
    flag_user: User | None,
) -> None:
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=False)
    assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    with override_flag(TEST_FLAG_NAME, active=True):
        assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_for_task_override_existing_to_inactive(
    flag_user: User | None,
) -> None:
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=True)
    assert flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
    with override_flag(TEST_FLAG_NAME, active=False):
        assert not flag_is_active_in_task(TEST_FLAG_NAME, flag_user)
