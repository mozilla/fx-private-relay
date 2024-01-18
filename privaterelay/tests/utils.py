"""Helper functions for tests"""

from logging import LogRecord
from typing import Any
import json

import pytest


def log_extra(log_record: LogRecord) -> dict[str, Any]:
    """Reconstruct the "extra" argument to the log call"""
    omit_log_record_keys = set(
        (
            "args",
            "created",
            "exc_info",
            "exc_text",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "message",
            "module",
            "msecs",
            "msg",
            "name",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "stack_info",
            "thread",
            "threadName",
        )
    )
    return {
        key: val
        for key, val in log_record.__dict__.items()
        if key not in omit_log_record_keys
    }


def get_glean_event(caplog: pytest.LogCaptureFixture) -> dict[str, Any] | None:
    """Return the event payload from a Glean server event log."""
    event = None
    for record in caplog.records:
        if record.msg == "glean-server-event":
            assert hasattr(record, "payload")
            event = json.loads(record.payload)["events"][0]
    return event
