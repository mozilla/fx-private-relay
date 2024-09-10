"""Helper functions for tests"""

import json
import random
from datetime import UTC, datetime
from logging import LogRecord
from typing import Any
from unittest._log import _LoggingWatcher
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import User

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker


def make_free_test_user(email: str = "") -> User:
    """Make a user who has signed up for the free Relay plan."""
    if email:
        user = baker.make(User, email=email)
    else:
        user = baker.make(User)
    user.profile.server_storage = True
    user.profile.save()
    baker.make(
        SocialAccount,
        user=user,
        uid=str(uuid4()),
        provider="fxa",
        extra_data={"avatar": "avatar.png"},
    )
    return user


def make_premium_test_user() -> User:
    """Make a user who has the premium Relay plan, but hasn't picked a subdomain."""
    premium_user = baker.make(User, email="premium@email.com")
    premium_user.profile.server_storage = True
    premium_user.profile.date_subscribed = datetime.now(tz=UTC)
    premium_user.profile.save()
    upgrade_test_user_to_premium(premium_user)
    return premium_user


def upgrade_test_user_to_premium(user: User) -> None:
    """Create an FxA SocialAccount with an unlimited email masks plan."""
    if SocialAccount.objects.filter(user=user).exists():
        raise Exception("upgrade_test_user_to_premium does not (yet) handle this.")
    baker.make(
        SocialAccount,
        user=user,
        uid=str(uuid4()),
        provider="fxa",
        extra_data={"avatar": "avatar.png", "subscriptions": [premium_subscription()]},
    )


def make_storageless_test_user() -> User:
    storageless_user = baker.make(User)
    storageless_user_profile = storageless_user.profile
    storageless_user_profile.server_storage = False
    storageless_user_profile.subdomain = "mydomain"
    storageless_user_profile.date_subscribed = datetime.now(tz=UTC)
    storageless_user_profile.save()
    upgrade_test_user_to_premium(storageless_user)
    return storageless_user


def premium_subscription() -> str:
    """Return a Mozilla account subscription that provides unlimited emails"""
    assert settings.SUBSCRIPTIONS_WITH_UNLIMITED
    premium_only_plans = list(
        set(settings.SUBSCRIPTIONS_WITH_UNLIMITED)
        - set(settings.SUBSCRIPTIONS_WITH_PHONE)
        - set(settings.SUBSCRIPTIONS_WITH_VPN)
    )
    assert premium_only_plans
    return random.choice(premium_only_plans)


def phone_subscription() -> str:
    """Return a Mozilla account subscription that provides a phone mask"""
    assert settings.SUBSCRIPTIONS_WITH_PHONE
    phones_only_plans = list(
        set(settings.SUBSCRIPTIONS_WITH_PHONE)
        - set(settings.SUBSCRIPTIONS_WITH_VPN)
        - set(settings.SUBSCRIPTIONS_WITH_UNLIMITED)
    )
    assert phones_only_plans
    return random.choice(phones_only_plans)


def vpn_subscription() -> str:
    """Return a Mozilla account subscription that provides the VPN"""
    assert settings.SUBSCRIPTIONS_WITH_VPN
    vpn_only_plans = list(
        set(settings.SUBSCRIPTIONS_WITH_VPN)
        - set(settings.SUBSCRIPTIONS_WITH_PHONE)
        - set(settings.SUBSCRIPTIONS_WITH_UNLIMITED)
    )
    assert vpn_only_plans
    return random.choice(vpn_only_plans)


def omit_markus_logs(caplog: pytest.LogCaptureFixture) -> list[LogRecord]:
    """
    Return log records that are not markus debug logs.

    Markus debug logs are enabled at Django setup with STATSD_DEBUG=True
    """
    return [rec for rec in caplog.records if rec.name != "markus"]


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
        "taskName",
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
        user_extra_items["fxa_id"] = user.profile.metrics_fxa_id
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
            "date_got_extension": "-2",
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
