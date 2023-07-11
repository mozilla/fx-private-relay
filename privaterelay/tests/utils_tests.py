from typing import Iterator
from unittest.mock import patch
import logging

from django.contrib.auth.models import AbstractBaseUser, Group, User
from django.core.cache.backends.base import BaseCache
from django.test import TestCase

from _pytest.fixtures import SubRequest
from _pytest.logging import LogCaptureFixture
from pytest_django.fixtures import SettingsWrapper
from waffle.models import Flag
from waffle.testutils import override_flag
from waffle.utils import get_cache as get_waffle_cache
import pytest

from ..plans import get_premium_country_language_mapping
from ..utils import (
    flag_is_active_in_task,
    get_premium_country_lang,
)


class GetPremiumCountryLangTest(TestCase):
    def setUp(self):
        self.mapping = get_premium_country_language_mapping(None)

    def test_get_premium_country_lang(self):
        cc, lang = get_premium_country_lang("en-au,", self.mapping)
        assert cc == "au"
        assert lang == "en"

        cc, lang = get_premium_country_lang("en-us,", self.mapping)
        assert cc == "us"
        assert lang == "en"

        cc, lang = get_premium_country_lang("de-be,", self.mapping)
        assert cc == "be"
        assert lang == "de"

        cc, lang = get_premium_country_lang("de-be,", self.mapping, "at")
        assert cc == "at"
        assert lang == "de"

    def test_en_fallback(self) -> None:
        cc, lang = get_premium_country_lang("en,", self.mapping)
        assert cc == "us"
        assert lang == "en"

    def test_first_lang_fallback_two_parts(self) -> None:
        accept_lang = "sgn-us,"  # American Sign Language
        cc, lang = get_premium_country_lang(accept_lang, self.mapping)
        assert cc == "us"
        assert lang == "en"

    def test_first_lang_fallback_three_parts(self) -> None:
        accept_lang = "sgn-ch-de,"  # Swiss German Sign Language
        cc, lang = get_premium_country_lang(accept_lang, self.mapping)
        assert cc == "ch"
        assert lang == "fr"

    def test_eu_country_expansion_active(self) -> None:
        mapping = get_premium_country_language_mapping(eu_country_expansion=True)
        cc, lang = get_premium_country_lang("et-ee", mapping)
        assert cc == "ee"
        assert lang == "et"

    def test_eu_country_expansion_inactive(self) -> None:
        mapping = get_premium_country_language_mapping(eu_country_expansion=False)
        cc, lang = get_premium_country_lang("et-ee", mapping)
        assert cc == "ee"
        assert lang == "en"


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
