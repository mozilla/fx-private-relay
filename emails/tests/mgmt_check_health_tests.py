import json
import logging
from datetime import datetime, timedelta, timezone

from django.core.management import CommandError, call_command

import pytest


@pytest.fixture(autouse=True)
def test_settings(settings, tmp_path):
    """Override settings for tests"""
    settings.PROCESS_EMAIL_HEALTHCHECK_PATH = tmp_path / "healthcheck.json"
    settings.PROCESS_EMAIL_MAX_AGE = 120
    return settings


def write_healthcheck(path, age=0):
    """
    Write a valid healthcheck file.

    Arguments:
    folder - A pathlib.Path folder for the healthcheck file
    age - How far in the past the timestamp should be

    Returns the path to the healthcheck file
    """
    timestamp = (datetime.now(tz=timezone.utc) - timedelta(seconds=age)).isoformat()
    data = {"timestamp": timestamp, "testing": True}
    with path.open("w", encoding="utf8") as f:
        json.dump(data, f)


def test_check_health_passed_no_logs(test_settings, caplog):
    """check health succeeds when the timestamp is recent."""
    path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    write_healthcheck(path)
    call_command("check_health")
    assert caplog.record_tuples == []


def test_check_health_passed_logs(test_settings, caplog):
    """check health success and logs at verbosity 2."""
    path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    write_healthcheck(path)
    call_command("check_health", "--verbosity=2")
    assert caplog.record_tuples == [
        ("eventsinfo.check_health", logging.INFO, "Healthcheck passed")
    ]


def test_check_health_too_old(test_settings, caplog):
    """check health fails when the timestamp is too old."""
    path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    write_healthcheck(path, 130)
    with pytest.raises(CommandError) as excinfo:
        call_command("check_health")
    assert str(excinfo.value) == "Healthcheck failed: Timestamp is too old"
    assert caplog.record_tuples == [
        ("eventsinfo.check_health", logging.ERROR, "Healthcheck failed")
    ]


def test_check_health_empty_json(test_settings, caplog):
    """check health fails when the JSON is empty."""
    path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    path.touch()
    with pytest.raises(CommandError) as excinfo:
        call_command("check_health")
    assert str(excinfo.value) == (
        "Healthcheck failed:"
        " JSONDecodeError('Expecting value: line 1 column 1 (char 0)')"
    )
    assert caplog.record_tuples == [
        ("eventsinfo.check_health", logging.ERROR, "Healthcheck failed")
    ]


def test_check_health_failed_no_logs(test_settings, caplog):
    """check health failure do not log at verbosity=0."""
    path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    write_healthcheck(path, 130)
    with pytest.raises(CommandError) as excinfo:
        call_command("check_health", "--verbosity=0")
    assert str(excinfo.value) == "Healthcheck failed: Timestamp is too old"
    assert caplog.record_tuples == []
