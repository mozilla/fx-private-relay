from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterator
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from mypy_boto3_ses.type_defs import SendRawEmailResponseTypeDef

from emails.ses import (
    get_ses_message_type,
    send_simulator_email,
    SimulatorScenario,
)
from emails.ses_types import SesEventType


def _ok_response_from_send_raw_email() -> SendRawEmailResponseTypeDef:
    """
    Create a successful response to send_raw_email().

    All simulator emails response with success, but may inject a failure
    message into the SQS queue.
    """
    message_id = f"010001812509de25-{uuid4()}-000000"
    request_id = str(uuid4())
    now = datetime.now(timezone.utc)

    return {
        "MessageId": message_id,
        "ResponseMetadata": {
            "RequestId": request_id,
            "HostId": "aws.ses.example.com",
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


def test_get_ses_message_type() -> None:
    message_type = get_ses_message_type({"eventType": "Rendering Failure"})
    assert message_type == SesEventType.RENDERING_FAILURE


def test_get_ses_message_type_empty_is_exception() -> None:
    with pytest.raises(ValueError) as excinfo:
        get_ses_message_type({})
    assert str(excinfo.value) == ("Expected notificationType or eventType to be set.")


def test_get_ses_message_type_both_is_exception() -> None:
    with pytest.raises(ValueError) as excinfo:
        get_ses_message_type(
            {"notificationType": "Complaint", "eventType": "Complaint"}
        )
    assert str(excinfo.value) == (
        "notificationType and eventType are set, only one should be."
    )
