"""
Tests for private_relay/management/commands/cleanup_data.py

These tests run on an empty database, to check the command logic paths.
Non-empty databases are tested in the cleaner tests.
"""
from io import StringIO

from django.core.management import call_command

import pytest

from emails.tests.cleaners_tests import setup_profile_mismatch_test_data

COMMAND_NAME = "cleanup_data"
MOCK_BASE = f"private_relay.management.commands.{COMMAND_NAME}"
CLEANERS = {"server-storage", "missing-profile"}
KNOWN_CLEANER = "server-storage"


@pytest.mark.django_db
def test_dry_run(caplog) -> None:
    """In dry run mode, issues are counted but not cleaned."""
    out = StringIO()
    call_command(COMMAND_NAME, stdout=out)
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" not in output
    log = caplog.records[0]
    assert log.message == "cleanup_data complete, found 0 issues (dry run)."
    assert not log.cleaned
    assert log.timers.keys() == {"query_s"}
    assert log.tasks.keys() == CLEANERS
    assert KNOWN_CLEANER in CLEANERS
    assert log.tasks[KNOWN_CLEANER]["counts"].keys() == {"summary"}


@pytest.mark.django_db
def test_clean(caplog) -> None:
    """An empty database can be cleaned."""
    out = StringIO()
    call_command(COMMAND_NAME, "--clean", stdout=out)
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" not in output
    log = caplog.records[0]
    assert log.message == "cleanup_data complete, cleaned 0 of 0 issues."
    assert log.cleaned
    assert log.timers.keys() == {"query_s", "clean_s"}


@pytest.mark.django_db
def test_verbosity_2_dry_run(caplog) -> None:
    """More data is recorded at verbosity=2 when detecting issues."""
    out = StringIO()
    call_command(COMMAND_NAME, "--verbosity=2", stdout=out)
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" in output
    assert "\nDetected 0 issues" in output
    assert "\nCleaned 0 issues" not in output
    log = caplog.records[0]
    assert not log.cleaned
    assert log.timers.keys() == {"query_s"}
    assert log.tasks.keys() == CLEANERS
    assert log.tasks[KNOWN_CLEANER]["counts"].keys() == {
        "summary",
        "profiles",
        "relay_addresses",
        "domain_addresses",
    }


@pytest.mark.django_db
def test_verbosity_2_cleaned() -> None:
    """More data is recorded at verbosity=2 when cleaning data."""
    out = StringIO()
    call_command(COMMAND_NAME, "--clean", "--verbosity=2", stdout=out)
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" in output
    assert "\nDetected 0 issues" in output
    assert "\nCleaned 0 issues" in output


@pytest.mark.django_db
def test_verbosity_0(caplog) -> None:
    """Less data is recorded at verbosity=0."""
    out = StringIO()
    call_command(COMMAND_NAME, "--clean", "--verbosity=0", stdout=out)
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" not in output
    log = caplog.records[0]
    assert log.cleaned
    assert log.timers.keys() == {"query_s", "clean_s"}
    assert not hasattr(log, "tasks")


@pytest.mark.django_db
def test_selected_cleaner(caplog) -> None:
    """A single cleaner can run."""
    out = StringIO()
    call_command(COMMAND_NAME, f"--{KNOWN_CLEANER}", "--clean", stdout=out)
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" not in output
    log = caplog.records[0]
    assert log.cleaned
    assert log.timers.keys() == {"query_s", "clean_s"}
    assert log.tasks.keys() == {KNOWN_CLEANER}


@pytest.mark.django_db
def test_issues_cleaned_by_detector() -> None:
    """When a detector finds an issue, it cleans it."""
    setup_profile_mismatch_test_data(add_problems=True)
    out = StringIO()
    call_command(
        COMMAND_NAME, "--missing-profile", "--clean", "--verbosity=2", stdout=out
    )
    output = out.getvalue()
    assert "# Summary\n" in output
    assert "# Details\n" in output
    assert "Cleaned 1 issue in " in output
