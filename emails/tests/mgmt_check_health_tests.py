from datetime import datetime, timezone, timedelta
from unittest.mock import ANY, patch
import json

import pytest

from django.core.management import call_command, CommandError

from emails.management.commands.check_health import Command


@pytest.fixture
def mock_logger():
    with patch(
        "emails.management.commands.check_health.logger", spec_set=("info", "error")
    ) as mock_logger:
        yield mock_logger


@pytest.mark.parametrize("verbosity", (1, 2))
def test_check_health_passed(tmp_path, mock_logger, verbosity):
    """check health succeeds when the timestamp is recent."""
    path = tmp_path / "healthcheck.json"
    timestamp = datetime.now(tz=timezone.utc).isoformat()
    data = {"timestamp": timestamp, "testing": True}
    with path.open("w", encoding="utf8") as f:
        json.dump(data, f)

    call_command("check_health", str(path), f"--verbosity={verbosity}")
    if verbosity == 1:
        mock_logger.info.assert_not_called()
    else:
        mock_logger.info.assert_called_once_with("Healthcheck passed", extra=ANY)
        extra = mock_logger.info.call_args.kwargs["extra"]
        age_s = extra["age_s"]
        assert extra == {
            "success": True,
            "healthcheck_path": str(path),
            "data": data,
            "age_s": age_s
        }
        assert 0.0 <= age_s <= 0.1


@pytest.mark.parametrize("verbosity", (0, 1))
def test_check_health_too_old_fails(tmp_path, mock_logger, verbosity):
    """check health fails when the timestamp is too old."""
    path = tmp_path / "healthcheck.json"
    timestamp = (datetime.now(tz=timezone.utc) - timedelta(seconds=130)).isoformat()
    data = {"timestamp": timestamp, "testing": "failure"}
    with path.open("w", encoding="utf8") as f:
        json.dump(data, f)

    with pytest.raises(CommandError) as excinfo:
        call_command("check_health", str(path), "--max-age=120", f"--verbosity={verbosity}")
    assert str(excinfo.value) == "Healthcheck failed: Timestamp is too old"

    if verbosity == 0:
        mock_logger.error.assert_not_called()
    else:
        mock_logger.error.assert_called_once_with("Healthcheck failed", extra=ANY)
        extra = mock_logger.error.call_args.kwargs["extra"]
        age_s = extra["age_s"]
        assert extra == {
            "success": False,
            "error": 'Timestamp is too old',
            "healthcheck_path": str(path),
            "data": data,
            "age_s": age_s
        }
        assert 130.0 <= age_s <= 130.1
