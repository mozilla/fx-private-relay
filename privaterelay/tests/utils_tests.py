from unittest.mock import patch
import logging

from django.contrib.auth.models import Group
from django.test import TestCase

from waffle.models import Flag
from waffle.testutils import override_flag
from waffle.utils import get_cache as get_waffle_cache
import pytest

from ..utils import (
    flag_is_active_for_user,
    get_premium_country_lang,
)


class GetPremiumCountryLangTest(TestCase):
    def test_get_premium_country_lang(self):
        cc, lang = get_premium_country_lang("en-au,")
        assert cc == "au"
        assert lang == "en"

        cc, lang = get_premium_country_lang("en-us,")
        assert cc == "us"
        assert lang == "en"

        cc, lang = get_premium_country_lang("de-be,")
        assert cc == "be"
        assert lang == "de"

        cc, lang = get_premium_country_lang("de-be,", "at")
        assert cc == "at"
        assert lang == "de"


@pytest.fixture()
def waffle_cache():
    cache = get_waffle_cache()
    yield cache
    cache.clear()


@pytest.fixture
def waffle_settings(settings):
    """Initialize waffle-related settings to default values."""
    settings.WAFFLE_FLAG_MODEL = "waffle.Flag"
    settings.WAFFLE_CREATE_MISSING_FLAGS = False
    settings.WAFFLE_LOG_MISSING_FLAGS = None
    settings.WAFFLE_FLAG_DEFAULT = False
    return settings


@pytest.fixture
def flag_user(django_user_model, waffle_cache, waffle_settings):
    """Return a Django user, and load fixtures for waffle tests."""
    return django_user_model.objects.create(username="flag_user")


TEST_FLAG_NAME = "test_flag_name"


def test_flag_is_active_missing_flag(flag_user, caplog):
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_missing_flag_logged(flag_user, waffle_settings, caplog):
    waffle_settings.WAFFLE_LOG_MISSING_FLAGS = logging.WARNING
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == [
        ("waffle", logging.WARNING, f"Flag {TEST_FLAG_NAME} not found")
    ]
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_missing_flag_created(
    flag_user, waffle_settings, waffle_cache, caplog
):
    waffle_settings.WAFFLE_CREATE_MISSING_FLAGS = True
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    flag = Flag.objects.get(name=TEST_FLAG_NAME)
    assert waffle_cache.get(flag._cache_key(TEST_FLAG_NAME)) == flag


def test_flag_is_active_missing_flag_created_with_default_true(
    flag_user, waffle_settings, waffle_cache, caplog
):
    waffle_settings.WAFFLE_CREATE_MISSING_FLAGS = True
    waffle_settings.WAFFLE_FLAG_DEFAULT = True
    assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    flag = Flag.objects.get(name=TEST_FLAG_NAME)
    assert waffle_cache.get(flag._cache_key(TEST_FLAG_NAME)) == flag


def test_flag_is_active_missing_flag_with_default_true(
    flag_user, waffle_settings, caplog
):
    waffle_settings.WAFFLE_FLAG_DEFAULT = True
    assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert caplog.record_tuples == []
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_existing_but_off_flag(flag_user):
    flag = Flag.objects.create(name=TEST_FLAG_NAME)
    assert flag.everyone is None
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_with_everyone_on_flag(flag_user):
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=True)
    assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_with_everyone_off_flag(flag_user):
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=False)
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_user_flag(flag_user):
    flag = Flag.objects.create(name=TEST_FLAG_NAME)
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    flag.users.add(flag_user)
    assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_group_flag(flag_user):
    flag = Flag.objects.create(name=TEST_FLAG_NAME)
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    group = Group.objects.create(name=TEST_FLAG_NAME)
    flag.groups.add(group)
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    group.user_set.add(flag_user)
    assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_everyone_overrides_user(flag_user):
    flag = Flag.objects.create(name=TEST_FLAG_NAME, everyone=False)
    flag.users.add(flag_user)
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_percent_pass(flag_user):
    Flag.objects.create(name=TEST_FLAG_NAME, percent=50.0)
    with patch("privaterelay.utils.random.uniform", return_value=49.0):
        assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_percent_fail(flag_user):
    Flag.objects.create(name=TEST_FLAG_NAME, percent=50.0)
    with patch("privaterelay.utils.random.uniform", return_value=50.1):
        assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_override_missing_to_active(flag_user):
    with override_flag(TEST_FLAG_NAME, active=True):
        assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_override_missing_to_not_active(flag_user):
    with override_flag(TEST_FLAG_NAME, active=False):
        assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    assert not Flag.objects.filter(name=TEST_FLAG_NAME).exists()


def test_flag_is_active_override_existing_to_active(flag_user):
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=False)
    assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    with override_flag(TEST_FLAG_NAME, active=True):
        assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)


def test_flag_is_active_override_existing_to_not_active(flag_user):
    Flag.objects.create(name=TEST_FLAG_NAME, everyone=True)
    assert flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
    with override_flag(TEST_FLAG_NAME, active=False):
        assert not flag_is_active_for_user(TEST_FLAG_NAME, flag_user)
