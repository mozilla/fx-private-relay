import logging
from datetime import UTC, datetime, timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command

import pytest

from privaterelay.management.commands.clear_bounce_pause import _BouncePause
from privaterelay.models import Profile

from .utils import make_free_test_user

COMMAND_NAME = "clear_bounce_pause"


@pytest.fixture
def unpaused_user(db: None) -> User:
    return make_free_test_user(email="unpaused@example.com")


@pytest.fixture
def hard_paused_user(db: None) -> User:
    user = make_free_test_user(email="hard-paused@example.com")
    profile: Profile = user.profile
    profile.last_hard_bounce = datetime.now(UTC)
    profile.save()
    return user


@pytest.fixture
def soft_paused_user(db: None) -> User:
    user = make_free_test_user(email="soft-paused@example.com")
    profile: Profile = user.profile
    profile.last_soft_bounce = datetime.now(UTC)
    profile.save()
    return user


@pytest.fixture
def fully_paused_user(db: None) -> User:
    user = make_free_test_user(email="full-paused@example.com")
    profile: Profile = user.profile
    profile.last_hard_bounce = datetime.now(UTC)
    profile.last_soft_bounce = datetime.now(UTC)
    profile.save()
    return user


def test_unknown_uid(db: None) -> None:
    stdout = StringIO()
    with pytest.raises(CommandError) as exception_info:
        call_command(COMMAND_NAME, "unknown-fxa-uid", stdout=stdout)

    assert str(exception_info.value) == "No user with FxA ID 'unknown-fxa-uid'."
    assert stdout.getvalue() == ""


def test_clears_hard_pause(hard_paused_user: User) -> None:
    profile: Profile = hard_paused_user.profile
    assert profile.fxa
    assert profile.last_hard_bounce is not None
    assert profile.last_soft_bounce is None

    stdout = StringIO()
    result = call_command(COMMAND_NAME, profile.fxa.uid, stdout=stdout)

    profile.refresh_from_db()
    assert profile.last_hard_bounce is None
    assert profile.last_soft_bounce is None
    assert result == (f"Cleared hard bounce pause for FxA ID '{profile.fxa.uid}'.")


def test_clears_soft_bounce(soft_paused_user: User) -> None:
    profile: Profile = soft_paused_user.profile
    assert profile.fxa
    assert profile.last_hard_bounce is None and profile.last_soft_bounce is not None

    stdout = StringIO()
    result = call_command(COMMAND_NAME, profile.fxa.uid, stdout=stdout)

    profile.refresh_from_db()
    assert profile.last_hard_bounce is None
    assert profile.last_soft_bounce is None
    assert result == (f"Cleared soft bounce pause for FxA ID '{profile.fxa.uid}'.")


def test_dry_run_writes_nothing(hard_paused_user: User) -> None:
    profile: Profile = hard_paused_user.profile
    assert profile.fxa
    last_hard_bounce = profile.last_hard_bounce

    stdout = StringIO()
    result = call_command(COMMAND_NAME, profile.fxa.uid, "--dry-run", stdout=stdout)

    profile.refresh_from_db()
    assert profile.last_hard_bounce == last_hard_bounce
    assert result == "No changes were written (dry run)."


def test_clears_both_pauses(fully_paused_user: User) -> None:
    profile: Profile = fully_paused_user.profile
    assert profile.fxa
    assert profile.last_soft_bounce is not None and profile.last_hard_bounce is not None

    result = call_command(COMMAND_NAME, profile.fxa.uid, stdout=StringIO())

    profile.refresh_from_db()
    assert profile.last_soft_bounce is None
    assert profile.last_hard_bounce is None
    assert result == (
        f"Cleared hard and soft bounce pause for FxA ID '{profile.fxa.uid}'."
    )


def test_clears_soft_pause_selective(fully_paused_user: User) -> None:
    profile: Profile = fully_paused_user.profile
    assert profile.fxa
    assert profile.last_soft_bounce is not None and profile.last_hard_bounce is not None

    result = call_command(COMMAND_NAME, profile.fxa.uid, "--soft", stdout=StringIO())

    profile.refresh_from_db()
    assert profile.last_soft_bounce is None
    assert profile.last_hard_bounce is not None
    assert result == (f"Cleared soft bounce pause for FxA ID '{profile.fxa.uid}'.")


def test_clears_hard_pause_selective(fully_paused_user: User) -> None:
    profile: Profile = fully_paused_user.profile
    assert profile.fxa
    assert profile.last_soft_bounce is not None and profile.last_hard_bounce is not None

    result = call_command(COMMAND_NAME, profile.fxa.uid, "--hard", stdout=StringIO())

    profile.refresh_from_db()
    assert profile.last_soft_bounce is not None
    assert profile.last_hard_bounce is None
    assert result == (f"Cleared hard bounce pause for FxA ID '{profile.fxa.uid}'.")


def test_soft_flag_with_only_hard_pause(hard_paused_user: User) -> None:
    profile: Profile = hard_paused_user.profile
    assert profile.fxa
    last_hard_bounce = profile.last_hard_bounce

    stdout = StringIO()
    with pytest.raises(CommandError) as exception_info:
        call_command(COMMAND_NAME, profile.fxa.uid, "--soft", stdout=stdout)

    assert str(exception_info.value) == "User has no soft bounce pause to clear."
    profile.refresh_from_db()
    assert profile.last_hard_bounce == last_hard_bounce


def test_logs_the_change(
    hard_paused_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    profile: Profile = hard_paused_user.profile
    assert profile.fxa
    last_hard_bounce = profile.last_hard_bounce
    assert last_hard_bounce

    with caplog.at_level(logging.INFO):
        call_command(COMMAND_NAME, profile.fxa.uid, stdout=StringIO())

    records = [r for r in caplog.records if r.name == "eventsinfo.clear_bounce_pause"]
    assert len(records) == 1
    assert getattr(records[0], "cleared") == ["hard"]
    assert getattr(records[0], "last_hard_bounce") == last_hard_bounce.isoformat()


def test_describe_shows_days_and_hours() -> None:
    bounced_at = datetime.now(UTC) - timedelta(days=1, hours=2, minutes=30)

    described = _BouncePause._describe(bounced_at, allowed_days=14)

    assert described.startswith(bounced_at.isoformat())
    assert described.endswith(" in 12d 21h)")


def test_describe_expired_pause() -> None:
    bounced_at = datetime.now(UTC) - timedelta(days=15)

    described = _BouncePause._describe(bounced_at, allowed_days=14)

    assert described == f"{bounced_at.isoformat()} (pause already expired)"
