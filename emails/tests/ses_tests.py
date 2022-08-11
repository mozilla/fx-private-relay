from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterator
from unittest.mock import ANY, Mock, patch
from uuid import uuid4

import pytest

from emails.ses import (
    BotoResponseMetadata,
    CommonHeaders,
    ComplaintFeedbackType,
    ComplaintNotification,
    ComplaintSubType,
    DeliveryNotification,
    SendRawEmailResponse,
    SesChannelType,
    SesNotificationType,
    SimulatorScenario,
    send_simulator_email,
)


def _ok_response_from_send_raw_email() -> dict[str, Any]:
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
    assert response.ResponseMetadata.HTTPStatusCode == 200
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
    assert response.ResponseMetadata.HTTPStatusCode == 200
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


def test_complaint_notification_with_feedback_parses() -> None:
    """
    A complaint with a feedback report can be parsed.

    This example is from:
    https://docs.aws.amazon.com/ses/latest/dg/notification-examples.html
    """
    complaint_notification = {
        "notificationType": "Complaint",
        "complaint": {
            "userAgent": "AnyCompany Feedback Loop (V0.01)",
            "complainedRecipients": [{"emailAddress": "richard@example.com"}],
            "complaintFeedbackType": "abuse",
            "arrivalDate": "2016-01-27T14:59:38.237Z",
            "timestamp": "2016-01-27T14:59:38.237Z",
            "feedbackId": "000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000",
        },
        "mail": {
            "timestamp": "2016-01-27T14:59:38.237Z",
            "messageId": "000001378603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000",
            "source": "john@example.com",
            "sourceArn": "arn:aws:ses:us-east-1:888888888888:identity/example.com",
            "sourceIp": "127.0.3.0",
            "sendingAccountId": "123456789012",
            "callerIdentity": "IAM_user_or_role_name",
            "destination": [
                "jane@example.com",
                "mary@example.com",
                "richard@example.com",
            ],
            "headersTruncated": False,
            "headers": [
                {"name": "From", "value": '"John Doe" <john@example.com>'},
                {
                    "name": "To",
                    "value": '"Jane Doe" <jane@example.com>, "Mary Doe" <mary@example.com>, "Richard Doe" <richard@example.com>',
                },
                {"name": "Message-ID", "value": "custom-message-ID"},
                {"name": "Subject", "value": "Hello"},
                {"name": "Content-Type", "value": 'text/plain; charset="UTF-8"'},
                {"name": "Content-Transfer-Encoding", "value": "base64"},
                {"name": "Date", "value": "Wed, 27 Jan 2016 14:05:45 +0000"},
            ],
            "commonHeaders": {
                "from": ["John Doe <john@example.com>"],
                "date": "Wed, 27 Jan 2016 14:05:45 +0000",
                "to": [
                    "Jane Doe <jane@example.com>, Mary Doe <mary@example.com>, Richard Doe <richard@example.com>"
                ],
                "messageId": "custom-message-ID",
                "subject": "Hello",
            },
        },
    }
    note = ComplaintNotification.from_dict(complaint_notification)
    assert note.channelType == SesChannelType.NOTIFICATION
    assert note.messageType.is_type("Complaint")
    assert note.messageType == SesNotificationType.COMPLAINT
    assert note.notificationType == SesNotificationType.COMPLAINT
    assert note.eventType is None

    assert note.complaint.complaintSubType is None
    assert note.complaint.complaintFeedbackType == ComplaintFeedbackType.ABUSE
    assert note.mail.headersTruncated is False
    assert note.mail.headers is not None
    assert len(note.mail.headers) == 7
    assert note.mail.commonHeaders is not None
    assert note.mail.commonHeaders.from_ == ["John Doe <john@example.com>"]
    assert note.mail.commonHeaders.messageId == "custom-message-ID"
    assert note.mail.commonHeaders.bcc is None


def test_complaint_notification_without_feedback_parses() -> None:
    """
    A complaint without a feedback report can be parsed.

    This example is from:
    https://docs.aws.amazon.com/ses/latest/dg/notification-examples.html
    """
    complaint_notification = {
        "notificationType": "Complaint",
        "complaint": {
            "complainedRecipients": [{"emailAddress": "richard@example.com"}],
            "timestamp": "2016-01-27T14:59:38.237Z",
            "feedbackId": "0000013786031775-fea503bc-7497-49e1-881b-a0379bb037d3-000000",
        },
        "mail": {
            "timestamp": "2016-01-27T14:59:38.237Z",
            "messageId": "0000013786031775-163e3910-53eb-4c8e-a04a-f29debf88a84-000000",
            "source": "john@example.com",
            "sourceArn": "arn:aws:ses:us-east-1:888888888888:identity/example.com",
            "sourceIp": "127.0.3.0",
            "sendingAccountId": "123456789012",
            "callerIdentity": "IAM_user_or_role_name",
            "destination": [
                "jane@example.com",
                "mary@example.com",
                "richard@example.com",
            ],
            "headersTruncated": False,
            "headers": [
                {"name": "From", "value": '"John Doe" <john@example.com>'},
                {
                    "name": "To",
                    "value": '"Jane Doe" <jane@example.com>, "Mary Doe" <mary@example.com>, "Richard Doe" <richard@example.com>',
                },
                {"name": "Message-ID", "value": "custom-message-ID"},
                {"name": "Subject", "value": "Hello"},
                {"name": "Content-Type", "value": 'text/plain; charset="UTF-8"'},
                {"name": "Content-Transfer-Encoding", "value": "base64"},
                {"name": "Date", "value": "Wed, 27 Jan 2016 14:05:45 +0000"},
            ],
            "commonHeaders": {
                "from": ["John Doe <john@example.com>"],
                "date": "Wed, 27 Jan 2016 14:05:45 +0000",
                "to": [
                    "Jane Doe <jane@example.com>, Mary Doe <mary@example.com>, Richard Doe <richard@example.com>"
                ],
                "messageId": "custom-message-ID",
                "subject": "Hello",
            },
        },
    }

    note = ComplaintNotification.from_dict(complaint_notification)
    assert note.complaint.complaintSubType is None
    assert note.complaint.complaintFeedbackType is None
    assert note.mail.headersTruncated is False
    assert note.mail.headers is not None
    assert len(note.mail.headers) == 7
    assert note.mail.commonHeaders is not None
    assert note.mail.commonHeaders.from_ == ["John Doe <john@example.com>"]
    assert note.mail.commonHeaders.returnPath is None


def test_complaint_notification_on_suppression_list_parses() -> None:
    """
    A complaint of an account-supressed email is parsed.

    This content is a guess based on AWS SES documentation, demonstrating
    parsing of OnAccountSuppressionList
    """
    complaint_notification = {
        "notificationType": "Complaint",
        "complaint": {
            "feedbackId": "010001810261be75-4db7c1c4-7394-4f44-bbbd-9fcfe72f530d-000000",
            "complaintSubType": "OnAccountSuppressionList",
            "complainedRecipients": [
                {"emailAddress": "suppressionlist+blocked@simulator.amazonses.com"}
            ],
            "timestamp": "2022-05-26T21:59:29.000Z",
        },
        "mail": {
            "timestamp": "2022-05-26T21:59:28.484Z",
            "source": "sender@relay.example.com",
            "sourceArn": "arn:aws:ses:us-east-1:111122223333:identity/relay.example.com",
            "sourceIp": "130.211.19.131",
            "callerIdentity": "test-relay",
            "sendingAccountId": "111122223333",
            "messageId": "010001810261bbe4-ab55f8e7-a948-47ae-9ae3-7dd17fffb2ea-000000",
            "destination": ["suppressionlist+blocked@simulator.amazonses.com"],
        },
    }
    note = ComplaintNotification.from_dict(complaint_notification)
    assert note.complaint.complaintSubType == ComplaintSubType.SUPPRESSED
    assert note.complaint.complaintFeedbackType is None
    assert note.mail.headersTruncated is None
    assert note.mail.headers is None
    assert note.mail.commonHeaders is None


def test_complaint_notification_without_headers_parses() -> None:
    """
    A complaint with a feedback report but no headers can be parsed.

    This example is based on a complaint from the SES simulator mailbox
    """
    complaint_notification = {
        "notificationType": "Complaint",
        "complaint": {
            "feedbackId": "010001813aaafe95-3c5caa5c-1a3f-4c6c-8a13-367d66349b64-000000",
            "complaintSubType": None,
            "complainedRecipients": [
                {"emailAddress": "complaint@simulator.amazonses.com"}
            ],
            "timestamp": "2022-06-06T20:18:13.000Z",
            "userAgent": "Amazon SES Mailbox Simulator",
            "complaintFeedbackType": "abuse",
            "arrivalDate": "2022-06-06T20:18:13.943Z",
        },
        "mail": {
            "timestamp": "2022-06-06T20:18:13.070Z",
            "source": "pr1968@rt202205192.relay.quhitlo.ch",
            "sourceArn": "arn:aws:ses:us-east-1:032756942992:identity/relay.quhitlo.ch",
            "sourceIp": "37.19.200.155",
            "callerIdentity": "mozilla-relay",
            "sendingAccountId": "032756942992",
            "messageId": "010001813aaafbce-2912a132-59f7-40bf-8a4d-a03641687054-000000",
            "destination": ["complaint@simulator.amazonses.com"],
        },
    }
    note = ComplaintNotification.from_dict(complaint_notification)
    assert note.complaint.complaintSubType is None
    assert note.complaint.complaintFeedbackType == ComplaintFeedbackType.ABUSE
    assert note.mail.headersTruncated is None
    assert note.mail.headers is None
    assert note.mail.commonHeaders is None


def test_common_headers_with_all_options_parses() -> None:
    """A CommonHeaders object can parse all the optional fields."""
    common_headers = {
        "from": ["from@example.com"],
        "to": ["to@example.com"],
        "cc": ["cc@example.com"],
        "bcc": ["bcc@example.com"],
        "subject": "Mail Subject",
        "date": "Mon, 6 Jun 2022 17:29:45+00:00",
        "messageId": "a-custom-ID",
        "sender": "the-sender",
        "returnPath": "return@example.com",
        "replyTo": ["replies@example.com"],
    }
    parsed = CommonHeaders.from_dict(common_headers)
    assert parsed.from_ == ["from@example.com"]
    assert parsed.to == ["to@example.com"]
    assert parsed.cc == ["cc@example.com"]
    assert parsed.bcc == ["bcc@example.com"]
    assert parsed.date == "Mon, 6 Jun 2022 17:29:45+00:00"
    assert parsed.messageId == "a-custom-ID"
    assert parsed.sender == "the-sender"
    assert parsed.returnPath == "return@example.com"
    assert parsed.replyTo == ["replies@example.com"]


def test_delivery_notification_parses() -> None:
    """
    A delivery notification can be parsed.

    This example is from the AWS docs:
    https://docs.aws.amazon.com/ses/latest/dg/notification-examples.html#notification-examples-delivery
    """
    delivery_notification = {
        "notificationType": "Delivery",
        "mail": {
            "timestamp": "2016-01-27T14:59:38.237Z",
            "messageId": "0000014644fe5ef6-9a483358-9170-4cb4-a269-f5dcdf415321-000000",
            "source": "john@example.com",
            "sourceArn": "arn:aws:ses:us-east-1:888888888888:identity/example.com",
            "sourceIp": "127.0.3.0",
            "sendingAccountId": "123456789012",
            "callerIdentity": "IAM_user_or_role_name",
            "destination": ["jane@example.com"],
            "headersTruncated": False,
            "headers": [
                {"name": "From", "value": '"John Doe" <john@example.com>'},
                {"name": "To", "value": '"Jane Doe" <jane@example.com>'},
                {"name": "Message-ID", "value": "custom-message-ID"},
                {"name": "Subject", "value": "Hello"},
                {"name": "Content-Type", "value": 'text/plain; charset="UTF-8"'},
                {"name": "Content-Transfer-Encoding", "value": "base64"},
                {"name": "Date", "value": "Wed, 27 Jan 2016 14:58:45 +0000"},
            ],
            "commonHeaders": {
                "from": ["John Doe <john@example.com>"],
                "date": "Wed, 27 Jan 2016 14:58:45 +0000",
                "to": ["Jane Doe <jane@example.com>"],
                "messageId": "custom-message-ID",
                "subject": "Hello",
            },
        },
        "delivery": {
            "timestamp": "2016-01-27T14:59:38.237Z",
            "recipients": ["jane@example.com"],
            "processingTimeMillis": 546,
            "reportingMTA": "a8-70.smtp-out.amazonses.com",
            "smtpResponse": "250 ok:  Message 64111812 accepted",
            "remoteMtaIp": "127.0.2.0",
        },
    }
    note = DeliveryNotification.from_dict(delivery_notification)
    assert note.mail.commonHeaders is not None
    assert note.mail.commonHeaders.subject == "Hello"
    assert note.delivery.timestamp == "2016-01-27T14:59:38.237Z"
    assert note.delivery.recipients == ["jane@example.com"]
    assert note.delivery.processingTimeMillis == 546
    assert note.delivery.reportingMTA == "a8-70.smtp-out.amazonses.com"
    assert note.delivery.smtpResponse == "250 ok:  Message 64111812 accepted"
    assert note.delivery.remoteMtaIp == "127.0.2.0"
