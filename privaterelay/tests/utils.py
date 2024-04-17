"""Helper functions for tests"""

from logging import LogRecord
from typing import Any
import json
from unittest._log import _LoggingWatcher

from django.contrib.auth.models import User

import pytest


def log_extra(log_record: LogRecord) -> dict[str, Any]:
    """Reconstruct the "extra" argument to the log call"""
    omit_log_record_keys = {
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
        "rid",
        "stack_info",
        "thread",
        "threadName",
    }
    return {
        key: val
        for key, val in log_record.__dict__.items()
        if key not in omit_log_record_keys
    }


def create_expected_glean_event(
    category: str,
    name: str,
    user: User,
    extra_items: dict[str, str],
    event_time: str,
) -> dict[str, str | dict[str, str]]:
    """
    Return the expected 'event' section of the event payload.

    category: The Glean event category
    name: The Glean event name / subcategory
    user: The requesting user. The fxa_id, date_joined_relay, date_joined_premium, and
      premium_status will be extracted from the user.
    extra_items: Additional or override extra items for this event
    event_time: The time of the event
    """
    user_extra_items: dict[str, str] = {}

    # Get values from the user object
    if user.profile.fxa:
        user_extra_items["fxa_id"] = user.profile.fxa.uid
        user_extra_items["premium_status"] = user.profile.metrics_premium_status
    user_extra_items["date_joined_relay"] = str(int(user.date_joined.timestamp()))
    if user.profile.date_subscribed:
        user_extra_items["date_joined_premium"] = str(
            int(user.profile.date_subscribed.timestamp())
        )

    extra = (
        {
            "fxa_id": "",
            "platform": "",
            "n_random_masks": "0",
            "n_domain_masks": "0",
            "n_deleted_random_masks": "0",
            "n_deleted_domain_masks": "0",
            "date_joined_relay": "-1",
            "premium_status": "free",
            "date_joined_premium": "-1",
            "has_extension": "false",
            "date_got_extension": "-1",
        }
        | user_extra_items
        | extra_items
    )
    return {
        "category": category,
        "name": name,
        "extra": extra,
        "timestamp": event_time,
    }


def get_glean_event(
    caplog: pytest.LogCaptureFixture | _LoggingWatcher,
    category: str | None = None,
    name: str | None = None,
) -> dict[str, Any] | None:
    """Return the event payload from a Glean server event log."""
    for record in caplog.records:
        if record.name == "glean-server-event":
            assert hasattr(record, "payload")
            event = json.loads(record.payload)["events"][0]
            assert isinstance(event, dict)
            if (not category or event["category"] == category) and (
                not name or event["name"] == name
            ):
                return event
    return None
