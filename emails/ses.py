"""Interface to AWS Simple Email Service (SES)"""
from __future__ import annotations

from dataclasses import dataclass, field
from email.message import EmailMessage
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional, Union
from uuid import UUID

from django.apps import apps
from django.conf import settings

from botocore.client import BaseClient

from .apps import EmailsConfig


@dataclass
class SendRawEmailResponse:
    """A response from send_raw_email"""

    MessageId: str
    ResponseMetadata: BotoResponseMetadata

    @classmethod
    def from_dict(cls, raw_response: dict[str, Any]) -> SendRawEmailResponse:
        assert isinstance(raw_response["MessageId"], str)
        return cls(
            MessageId=raw_response["MessageId"],
            ResponseMetadata=BotoResponseMetadata.from_dict(
                raw_response["ResponseMetadata"]
            ),
        )


@dataclass
class BotoResponseMetadata:
    """
    Response data from a boto3 API call.

    This is not documented, but comes from inspecting multiple responses.
    """

    RequestId: UUID
    HTTPStatusCode: int
    HTTPHeaders: dict[str, str]
    RetryAttempts: int

    @classmethod
    def from_dict(cls, raw_metadata: dict[str, Any]) -> BotoResponseMetadata:
        assert isinstance(raw_metadata["RequestId"], str)
        assert isinstance(raw_metadata["HTTPStatusCode"], int)
        assert isinstance(raw_metadata["HTTPHeaders"], dict)
        for key, value in raw_metadata["HTTPHeaders"].items():
            assert isinstance(key, str)
            assert isinstance(value, str)
        assert isinstance(raw_metadata["RetryAttempts"], int)
        return cls(
            RequestId=UUID(raw_metadata["RequestId"]),
            HTTPStatusCode=raw_metadata["HTTPStatusCode"],
            HTTPHeaders=raw_metadata["HTTPHeaders"],
            RetryAttempts=raw_metadata["RetryAttempts"],
        )


def ses_client() -> BaseClient:
    """An SES client, configured during Django setup."""
    emails_config = apps.get_app_config("emails")
    assert isinstance(emails_config, EmailsConfig)
    client = emails_config.ses_client
    assert client is not None
    assert hasattr(client, "send_raw_email")
    return client


def send_raw_email(
    from_address: str,
    to_addresses: list[str],
    raw_message: str,
) -> SendRawEmailResponse:
    """
    Send an email using send_raw_email()

    Keyword Arguments:
    raw_message - The email message as a string, will be base64 encoded
    from_address - The sender email address
    to_addresses - A list of To:, CC: and BCC: recipient email addresses

    Return is an SesSendRawEmailResponse

    Can raise:
    * SES.Client.exceptions.MessageRejected
    * SES.Client.exceptions.MailFromDomainNotVerifiedException
    * SES.Client.exceptions.ConfigurationSetDoesNotExistException
    * SES.Client.exceptions.ConfigurationSetSendingPausedException
    * SES.Client.exceptions.AccountSendingPausedException
    """
    client = ses_client()
    raw_response = client.send_raw_email(
        Source=from_address,
        Destinations=to_addresses,
        RawMessage={"Data": raw_message},
        ConfigurationSetName=settings.AWS_SES_CONFIGSET,
    )
    return SendRawEmailResponse.from_dict(raw_response)


class SimulatorScenario(Enum):
    """
    Amazon provides email addresses to test SES client.

    The email addresses end with @simulator.amazonses.com . See:
    https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html
    """

    # Successfully delivererd
    SUCCESS = "success"
    # Rejects with SMTP 550 5.1.1 ("Unknown User")
    BOUNCE = "bounce"
    # Replies with out-of-the-office message
    OOTO = "ooto"
    # Marked as spam
    COMPLAINT = "complaint"
    # AWS generates "hard bounce", as if on global suppression list
    SUPRESSIONLIST = "suppressionlist"


def get_simulator_email_address(
    scenario: SimulatorScenario, label: Optional[str] = None
) -> str:
    """Create a optionally labeled SES simulator email address."""
    local_part = scenario.value
    if label:
        local_part += f"+{label}"
    return f"{local_part}@simulator.amazonses.com"


def send_simulator_email(
    scenario: SimulatorScenario, from_address: str, label: Optional[str] = None
) -> SendRawEmailResponse:
    """Send an email to the SES mailbox simulator."""
    to_address = get_simulator_email_address(scenario, label)
    msg = EmailMessage()
    msg.set_content("Test message")
    msg["Subject"] = f"Test message for {scenario.value}"
    msg["From"] = from_address
    msg["To"] = to_address

    return send_raw_email(from_address, [to_address], str(msg))
