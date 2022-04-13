from datetime import datetime, timezone, timedelta
from unittest.mock import ANY, patch
import json
import logging

import pytest

from django.core.management import call_command, CommandError

from emails.management.commands.check_health import Command


def write_healthcheck(folder, age=0):
    """
    Write a valid healthcheck file.

    Arguments:
    folder - A pathlib.Path folder for the healthcheck file
    age - How far in the past the timestamp should be

    Returns the path to the healthcheck file
    """
    path = folder / "healthcheck.json"
    timestamp = (datetime.now(tz=timezone.utc) - timedelta(seconds=age)).isoformat()
    data = {"timestamp": timestamp, "testing": True}
    with path.open("w", encoding="utf8") as f:
        json.dump(data, f)
    return path


def test_check_health_passed_no_logs(tmp_path, caplog):
    """check health succeeds when the timestamp is recent."""
    path = write_healthcheck(tmp_path)
    call_command("check_health", str(path))
    assert caplog.record_tuples == []


def test_check_health_passed_logs(tmp_path, caplog):
    """check health success and logs at verbosity 2."""
    path = write_healthcheck(tmp_path)
    call_command("check_health", str(path), f"--verbosity=2")
    assert caplog.record_tuples == [
        ("eventsinfo.check_health", logging.INFO, "Healthcheck passed")
    ]


def test_check_health_too_old(tmp_path, caplog):
    """check health fails when the timestamp is too old."""
    path = write_healthcheck(tmp_path, 130)
    with pytest.raises(CommandError) as excinfo:
        call_command("check_health", str(path), "--max-age=120")
    assert str(excinfo.value) == "Healthcheck failed: Timestamp is too old"
    assert caplog.record_tuples == [
        ("eventsinfo.check_health", logging.ERROR, "Healthcheck failed")
    ]


def test_check_health_failed_no_logs(tmp_path, caplog):
    """check health failure do not log at verbosity=0."""
    path = write_healthcheck(tmp_path, 130)
    with pytest.raises(CommandError) as excinfo:
        call_command("check_health", str(path), "--max-age=120", "--verbosity=0")
    assert str(excinfo.value) == "Healthcheck failed: Timestamp is too old"
    assert caplog.record_tuples == []
