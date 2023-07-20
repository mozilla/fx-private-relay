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
        ("en-au,", "au"),
        ("en-us,", "us"),
        ("de-be,", "be"),
        ("en", "us"),
        ("sgn-us", "us"),  # American Sign Language
        ("sgn-ch-de", "ch"),  # Swiss German Sign Language
        ("et-ee", "ee"),
        # Good headers, from Django test test_parse_spec_http_header
        ("de", "de"),
        ("en-AU", "au"),
        ("es-419", "mx"),
        ("en-AU;q=0.123", "au"),
        ("en-au;q=0.5", "au"),
        ("en-au;q=1.0", "au"),
        ("da, en-gb;q=0.25, en;q=0.5", "dk"),
        ("de,en-au;q=0.75,en-us;q=0.5,en;q=0.25,es;q=0.125,fa;q=0.125", "de"),
        ("de;q=0.", "de"),
        ("en; q=1,", "us"),
        ("en; q=1.0, * ; q=0.5", "us"),
        # Default Accept-Language headers from Firefox
        # https://pontoon.mozilla.org/de/firefox/toolkit/chrome/global/intl.properties/?string=81017
        ("ace, id, en-US, en", "id"),  # Acehnese -> Indonesia
        ("ach, en-GB, en-US, en", "ug"),  # Acholi -> Uganda
        ("af, en-ZA, en-GB, en-US, en", "za"),  # Afrikaans -> South Africa
        ("ar, en-us, en", "eg"),  # Arabic -> Egypt
        ("arn,es-CL,es-AR,es-MX,es-ES,es,en-US,en", "cl"),  # Mapudungun -> Chile
        ("an, es-ES, es, ca, en-US, en", "es"),  # Aragonese -> Spain
        ("as, en-us, en", "in"),  # Assamese -> India
        ("ast, es-ES, es, en-US, en", "es"),  # Asturian -> Spain
        ("az-AZ, az, en-US, en", "az"),  # Azerbaijani -> Azerbaijan
        ("be, en-US, en", "by"),  # Belerusian -> Belarus
        ("bg, en-US, en", "bg"),  # Bulgarian -> Bulgaria
        ("bn, en-US, en", "bd"),  # Bengali -> Bangladesh
        ("bn-in, bn, en-us, en", "in"),  # Bengali (India) -> India
        ("bo-CN,bo-IN,bo,en-US, en", "cn"),  # Tibetan -> China
        ("br, fr-FR, fr, en-US, en", "fr"),  # Breton -> France
        ("brx,as,en-US,en", "in"),  # Bodo -> India
        ("bs-ba, bs, en-us, en", "ba"),  # Bosnian -> Bosnia and Herzegovina
        ("ca, en-us, en", "fr"),  # Catalan -> France
        ("ca-valencia, ca, en-us, en", "es"),  # Catalan (Valencian) -> Spain
        ("cak, kaq, es, en-us, en", "mx"),  # Kaqchikel -> Mexico
        ("ckb,en-US,en", "iq"),  # Central Kurdish -> Iraq
        ("cs, sk, en-US, en", "cz"),  # Czech -> Czech Republic
        ("cv, en-US, en", "ru"),  # Chuvash -> Russia
        ("cy-GB, cy, en-US, en", "gb"),  # Welsh -> United Kingdom
        ("da, en-us, en", "dk"),  # Danish -> Denmark
        ("de, en-US, en", "de"),  # German -> Germany
        ("dsb, hsb, de, en-US, en", "de"),  # Lower Sorbian -> Germany
        ("el-GR, el, en-US, en", "gr"),  # Greek -> Greece
        ("en-CA, en-US, en", "ca"),  # English (Canadian) -> Canada
        ("en-GB, en", "gb"),  # English (Great Britain) -> United Kingdom
        ("eo, en-US, en", "sm"),  # Esperanto -> San Marino
        ("es-AR, es, en-US, en", "ar"),  # Spanish (Argentina) -> Argentina
        ("es-CL, es, en-US, en", "cl"),  # Spanish (Chile) -> Chile
        ("es-ES, es, en-US, en", "es"),  # Spanish (Spain) -> Spain
        ("es-MX, es, en-US, en", "mx"),  # Spanish (Mexico) -> Mexico
        ("et, et-ee, en-us, en", "ee"),  # Estonian -> Estonia
        ("eu, en-us, en", "es"),  # Basque -> Spain
        ("fa-ir, fa, en-us, en", "ir"),  # Persian -> Iran
        ("ff, fr-FR, fr, en-GB, en-US, en", "sn"),  # Fulah -> Senegal
        ("fi-fi, fi, en-us, en", "fi"),  # Finnish -> Finland
        ("fr, fr-fr, en-us, en", "fr"),  # French -> France
        ("frp, fr-FR, fr, en-US, en", "fr"),  # Arpitan -> France
        ("fur-IT, fur, it-IT, it, en-US, en", "it"),  # Friulian -> Italy
        ("fy-nl, fy, nl, en-us, en ", "nl"),  # Frisian -> Netherlands
        ("ga-ie, ga, en-ie, en-gb, en-us, en", "ie"),  # Irish -> Ireland
        ("gd-gb, gd, en-gb, en-us, en", "gb"),  # Gaelic, Scottish -> United Kingdom
        ("gl-gl, gl, en-us, en", "es"),  # Galician -> Spain
        ("gn, es, en-US, en", "py"),  # Guarani -> Paraguay
        ("gu-in, gu, en-us, en", "in"),  # Gujarati -> India
        ("gv,en-GB,en-US,en", "im"),  # Manx -> Isle of Man
        ("he, he-IL, en-US, en", "il"),  # Hebrew -> Israel
        ("hi-in, hi, en-us, en", "in"),  # Hindi -> India
        ("hr, hr-HR, en-US, en", "hr"),  # Croatian -> Croatia
        ("hsb, dsb, de, en-US, en", "de"),  # Upper Sorbian -> Germany
        ("hu-hu, hu, en-US, en", "hu"),  # Hungarian -> Hungary
        ("hy-AM,hy,en-us,en", "am"),  # Armenian -> Armenia
        ("hye,hy,en-US,en", "am"),  # Armenian Eastern Classic Orthography -> Armenia
        ("ia, en-US, en", "fr"),  # Interlingua -> France
        ("id, en-us, en", "id"),  # Indonesian -> Indonesia
        ("ilo-PH, ilo, en-US, en", "ph"),  # Iloko -> Philippines
        ("is, en-us, en", "is"),  # Icelandic -> Iceland
        ("it-IT, it, en-US, en", "it"),  # Italian -> Italy
        ("ixl, es-MX, es, en-US, en", "mx"),  # Ixil -> Mexico
        ("ja, en-US, en", "jp"),  # Japanese -> Japan
        ("jiv, es, en-US, en", "mx"),  # Shuar -> Mexico
        ("ka-GE,ka,en-US,en", "ge"),  # Georgian -> Georgia
        ("kab-DZ,kab,fr-FR,fr,en-US,en", "dz"),  # Kayble -> Algeria
        ("kk, ru, ru-RU, en-US, en", "kz"),  # Kazakh -> Kazakhstan
        ("km, en-US, en", "kh"),  # Khmer -> Cambodia
        ("kn-IN, kn, en-us, en", "in"),  # Kannada -> India
        ("ko-KR, ko, en-US, en", "kr"),  # Korean -> South Korea
        ("ks,en-US,en", "in"),  # Kashmiri -> India
        ("lb, de-DE, de, en-US, en", "lu"),  # Luxembourgish -> Luxembourg
        ("lg, en-gb, en-us, en", "ug"),  # Luganda -> Uganda
        ("lij, it, en-US, en", "it"),  # Ligurian -> Italy
        ("lo, en-US, en", "la"),  # Lao -> Laos
        ("lt, en-us, en, ru, pl", "lt"),  # Lithuanian -> Lithuania
        ("ltg, lv, en-US, en", "lv"),  # Latgalian -> Latvia
        ("lus,en-US,en", "us"),  # Mizo -> United States
        ("lv, en-us, en", "lv"),  # Latvian -> Latvia
        ("mai, hi-IN, en", "in"),  # Maithili -> India
        ("meh,es-MX,es,en-US,en", "mx"),  # Mixteco Yucuhiti -> Mexico
        ("mix,es-MX,es,en-US,en", "mx"),  # Mixtepec Mixtec -> Mexico
        ("mk-mk, mk, en-us, en", "mk"),  # Macedonian -> North Macedonia
        ("ml-in, ml, en-US, en", "in"),  # Malayalam -> India
        ("mr-IN, mr, en-US, en", "in"),  # Marathi -> India
        ("ms,en-us, en", "my"),  # Malay -> Malaysia
        ("my, en-GB, en", "mm"),  # Burmese -> Myanmar
        ("nb-no, nb, no-no, no, nn-no, nn, en-us, en", "no"),  # No. Bokmål -> Norway
        ("ne-NP, ne, en-US, en", "np"),  # Nepali -> Nepal
        ("nl, en-US, en", "nl"),  # Dutch -> Netherlands
        ("nn-no, nn, no-no, no, nb-no, nb, en-us, en", "no"),  # No. Nynorsk -> Norway
        ("oc, ca, fr, es, it, en-US, en", "fr"),  # Occitan -> France
        ("or, en-US, en", "in"),  # Odia -> India
        ("pa, pa-in, en-us, en", "in"),  # Punjabi -> India
        ("pl, en-US, en", "pl"),  # Polish -> Poland
        ("ppl,es-MX,es,en-US,en", "mx"),  # Náhuat Pipil -> Mexico
        ("pt-BR, pt, en-US, en", "br"),  # Portuguese (Brazil) -> Brazil
        ("pt-PT, pt, en, en-US", "pt"),  # Portuguese (Portugal) -> Portugal
        ("quc,es-MX,es,en-US,en", "gt"),  # K'iche' -> Guatemala
        ("rm, rm-ch, de-CH, de, en-us, en", "ch"),  # Romansh -> Switzerland
        ("ro-RO, ro, en-US, en-GB, en", "ro"),  # Romanian -> Romania
        ("ru-RU, ru, en-US, en", "ru"),  # Russian -> Russia
        ("sat, en-US, en", "in"),  # Santali (Ol Chiki) -> India
        ("sc, it-IT, it, en-US, en", "it"),  # Sardinian -> Italy
        ("scn, it-IT, it, en-US, en", "it"),  # Sicilian -> Italy
        ("sco,en-GB,en", "gb"),  # Scots -> United Kingdom
        ("si-LK, si, en-US, en", "lk"),  # Sinhala -> Sri Lanka
        ("sk, cs, en-US, en", "sk"),  # Slovak -> Slovakia
        ("skr,en-US,en", "pk"),  # Saraiki -> Pakistan
        ("sl, en-gb, en", "si"),  # Slovenian -> Slovenia
        ("son, son-ml, fr, en-us, en", "ml"),  # Songhay -> Mali
        ("sq, sq-AL, en-us, en", "al"),  # Albanian -> Albania
        ("sr-RS, sr, en-US, en", "rs"),  # Serbian -> Serbia
        ("sv-SE, sv, en-US, en", "se"),  # Swedish -> Sweeden
        ("sw, en-US, en", "tz"),  # Swahili -> Tanzania
        ("szl,pl-PL,pl,en,de", "pl"),  # Silesian -> Poland
        ("ta-IN, ta, en-US, en", "in"),  # Tamil -> India
        ("te-in, te, en-us, en", "in"),  # Telugu -> India
        ("tg, en-US, en", "tj"),  # Tajik -> Tajikistan
        ("th, en-US, en", "th"),  # Thai -> Thailand
        ("tl-PH, tl, en-US, en", "ph"),  # Tagalog -> Philippines
        ("tr-TR, tr, en-US, en", "tr"),  # Turkish OR Crimean Tatar -> Turkey
        ("trs,es-MX,es,en-US,en", "mx"),  # Triqui -> Mexico
        ("uk-UA, uk, en-US, en", "ua"),  # Ukrainian -> Ukraine
        ("ur-PK, ur, en-US, en", "pk"),  # Urdu -> Pakistan
        ("uz, ru, en, en-US", "uz"),  # Uzbek -> Uzbekistan
        ("vi-vn, vi, en-us, en", "vn"),  # Vietnamese -> Vietnam
        ("wo, en-US, en", "sn"),  # Wolof -> Senegal
        ("xcl,hy,en-US,en", "am"),  # Armenian Classic -> Armenia
        ("xh-ZA, xh, en-US, en", "za"),  # Xhosa
        ("zam, es-MX, es, en-US, en", "mx"),  # Miahuatlán Zapotec
        ("zh-CN, zh, zh-TW, zh-HK, en-US, en", "cn"),  # Chinese (China)
        ("zh-tw, zh, en-us, en", "tw"),  # Chinese (Taiwan)
        # Test cases from RFC 5646, "Tags for Identifying Languages", Appendix A
        # RFC 5646 - Simple language subtag
        ("de", "de"),  # German -> Germany
        ("fr", "fr"),  # French -> France
        ("ja", "jp"),  # Japanese -> Japan
        # RFC 5646 - Language subtag plus Script subtag
        ("zh-Hant", "cn"),  # Chinese in Traditional Chinese script -> China
        ("zh-Hans", "cn"),  # Chinese in Simplified Chinese script -> China
        ("sr-Cyrl", "rs"),  # Serbian in Cyrillic script -> Serbia
        ("sr-Latn", "rs"),  # Serbian in Latin script -> Serbia
        # RFC 5646 - Extended language subtags with primary language subtag counterparts
        ("zh-cmn-Hans-CN", "cn"),  # Chinese, Mandarin, Simplified script, in China
        ("cmn-Hans-CN", "cn"),  # Mandarin Chinese, Simplified script, as used in China
        ("zh-yue-HK", "hk"),  # Chinese, Cantonese, as used in Hong Kong SAR
        ("yue-HK", "hk"),  # Cantonese Chinese, as used in Hong Kong SAR
        # RFC 5646 - Language-Script-Region
        ("zh-Hans-CN", "cn"),  # Chinese in Simplified script in mainland China -> China
        ("sr-Latn-RS", "rs"),  # Serbian in Latin script in Serbia
        ("zh-Hans-TW", "tw"),  # Chinese in Simplified script in Taiwan (added)
        # RFC 5646 - Language-Variant
        ("sl-rozaj", "si"),  # Resian dialect of Slovenian -> Slovenia
        ("sl-rozaj-biske", "si"),  # San Giorgio dialect of Resian dialect of Slovenian
        ("sl-nedis", "si"),  # Nadiza dialect of Slovenian -> Slovenia
        # RFC 5646 - Language-Region-Variant
        ("de-CH-1901", "ch"),  # German as used in Switzerland using the 1901 variant
        ("sl-IT-nedis", "it"),  # Slovenian as used in Italy, Nadiza dialect
        # RFC 5646 - Language-Script-Region-Variant
        ("hy-Latn-IT-arevela", "it"),  # Eastern Armenian in Latin script, in Italy
        # RFC 5646 - Language-Region
        ("de-DE", "de"),  # German for Germany
        ("en-US", "us"),  # English as used in the United States
        ("es-419", "mx"),  # Spanish in Latin America and Caribbean region (UN code)
        # RFC 5646 - Private use subtags
        ("de-CH-x-phonebk", "ch"),  # Swiss German with private use subtag
        ("az-Arab-x-AZE-derbend", "az"),  # another private use subtag
        # RFC 5646 - Private use registry values
        ("de-Qaaa", "de"),  # German, with a private script
        ("sr-Latn-QM", "rs"),  # Serbian, Latin-script, private region
        ("sr-Qaaa-CS", "cs"),  # Serbian, private script, for Serbia and Montenegro
        # RFC 5646 - Examples of possible tags that use extensions
        ("en-US-u-islamCal", "us"),
        ("zh-CN-a-myext-x-private", "cn"),
        ("en-a-myext-b-another", "us"),
        # RFC 5646 - Invalid tags
        ("de-419-DE", "de"),  # two region tags
        ("ar-a-aaa-b-bbb-a-ccc", "eg"),  # two extensions with same 1 char prefix 'a'
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
    mapping = get_premium_country_language_mapping(None)
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
