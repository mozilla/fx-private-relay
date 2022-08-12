from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator
from unittest.mock import Mock, patch
from uuid import uuid4
import json

import pytest

from emails.ses import send_simulator_email, SimulatorScenario

# Test cases by message type - supported cases are loaded with JSON bodies
SES_TEST_CASES: dict[str, list[str]] = {
    "unsupported": [
        "click_event_example",
        "delivery_delay_event_example",
        "open_event_example",
        "reject_event_example",
        "rendering_failure_example",
        "send_event_example",
        "subscription_event_example",
    ],
    "bounce": [],
    "complaint": [],
    "delivery": [],
    "received": [],
}

# Load the SES json fixtures from files
SES_BODIES: dict[str, dict[str, Any]] = {}
my_path = Path(__file__)
fixtures_path = my_path.parent / "fixtures"
suffix = "_ses_body.json"
for fixture_file in sorted(fixtures_path.glob(f"*{suffix}")):
    key = fixture_file.name[: -len(suffix)]
    content = json.loads(fixture_file.read_text())
    SES_BODIES[key] = content
    if key in SES_TEST_CASES["unsupported"]:
        continue
    if "bounce_" in key:
        SES_TEST_CASES["bounce"].append(key)
    elif "complaint_event_" in key or "complaint_notification_" in key:
        SES_TEST_CASES["complaint"].append(key)
    elif "delivery_event_" in key or "delivery_notification_" in key:
        SES_TEST_CASES["delivery"].append(key)
    elif key == "received_notification_action_no_headers":
        pass  # Supported type, but missing commonHeaders
    else:
        assert "received_" in key
        SES_TEST_CASES["received"].append(key)

assert SES_TEST_CASES["bounce"]
assert SES_TEST_CASES["complaint"]
assert SES_TEST_CASES["received"]


def _ok_response_from_send_raw_email() -> dict[str, Any]:
    """
    Create a successful response to send_raw_email().

    All simulator emails respond with success, but may inject a failure
    message into the SQS queue.
    """
    message_id = f"010001812509de25-{uuid4()}-000000"
    request_id = str(uuid4())
    now = datetime.now(timezone.utc)

    return {
        "MessageId": message_id,
        "ResponseMetadata": {
            "RequestId": request_id,
            "HTTPStatusCode": 200,
            "HTTPHeaders": {
                "date": now.strftime("%a, %d %b %Y %H:%M:%S GMT"),
                "content-type": "text/xml",
                "content-length": "338",
                "connection": "keep-alive",
                "x-amzn-requestid": request_id,
            },
            "RetryAttempts": 0,
        },
    }


@pytest.fixture()
def mock_ses_client(settings) -> Iterator[Mock]:
    """Mock the SES client to successfully call send_raw_email()"""
    settings.AWS_SES_CONFIGSET = "configset-name"
    with patch(
        "emails.apps.EmailsConfig.ses_client", spec_set=("send_raw_email",)
    ) as mock_ses_client:
        mock_ses_client.send_raw_email.return_value = _ok_response_from_send_raw_email()
        yield mock_ses_client


@pytest.mark.parametrize("scenario", list(SimulatorScenario))
def test_send_simulator_email(mock_ses_client, scenario) -> None:
    response = send_simulator_email(scenario, "test@relay.example.com")
    assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
    dest_email = f"{scenario.value}@simulator.amazonses.com"
    mock_ses_client.send_raw_email.assert_called_once_with(
        Source="test@relay.example.com",
        Destinations=[dest_email],
        RawMessage={
            "Data": (
                'Content-Type: text/plain; charset="utf-8"\n'
                "Content-Transfer-Encoding: 7bit\n"
                "MIME-Version: 1.0\n"
                f"Subject: Test message for {scenario.value}\n"
                "From: test@relay.example.com\n"
                f"To: {dest_email}\n"
                "\n"
                "Test message\n"
            )
        },
        ConfigurationSetName="configset-name",
    )


def test_send_simulator_email_with_tag(mock_ses_client) -> None:
    response = send_simulator_email(
        SimulatorScenario.SUCCESS, "test@relay.example.com", "a-tag"
    )
    assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
    dest_email = "success+a-tag@simulator.amazonses.com"
    mock_ses_client.send_raw_email.assert_called_once_with(
        Source="test@relay.example.com",
        Destinations=[dest_email],
        RawMessage={
            "Data": (
                'Content-Type: text/plain; charset="utf-8"\n'
                "Content-Transfer-Encoding: 7bit\n"
                "MIME-Version: 1.0\n"
                "Subject: Test message for success\n"
                "From: test@relay.example.com\n"
                f"To: {dest_email}\n"
                "\n"
                "Test message\n"
            )
        },
        ConfigurationSetName="configset-name",
    )
