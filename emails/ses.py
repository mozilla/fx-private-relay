"""Interface to AWS Simple Email Service (SES)"""
from __future__ import annotations

from dataclasses import dataclass
from email.message import EmailMessage
from enum import Enum
from typing import TYPE_CHECKING, Any, Literal, Optional, Union
from uuid import UUID

from django.apps import apps
from django.conf import settings

from botocore.client import BaseClient

from .apps import EmailsConfig


@dataclass
class ComplaintNotification:
    """
    A Complaint Notification delivered via SNS.

    See https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
    """

    notificationType: Literal["Complaint"]
    complaint: ComplaintBody
    mail: MailBody

    @classmethod
    def from_dict(cls, raw_complaint: dict[str, Any]) -> ComplaintNotification:
        assert raw_complaint["notificationType"] == "Complaint"
        return cls(
            notificationType=raw_complaint["notificationType"],
            complaint=ComplaintBody.from_dict(raw_complaint["complaint"]),
            mail=MailBody.from_dict(raw_complaint["mail"]),
        )


@dataclass
class DeliveryNotification:
    """
    A Delivery Notification delivered via SNS.

    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
    """

    notificationType: Literal["Delivery"]
    delivery: DeliveryBody
    mail: MailBody

    @classmethod
    def from_dict(cls, raw_delivery: dict[str, Any]) -> DeliveryNotification:
        assert raw_delivery["notificationType"] == "Delivery"
        return cls(
            notificationType=raw_delivery["notificationType"],
            delivery=DeliveryBody.from_dict(raw_delivery["delivery"]),
            mail=MailBody.from_dict(raw_delivery["mail"]),
        )


@dataclass
class ComplaintBody:
    """
    The "complaint" element of a Complaint Notification.

    See https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object
    """

    feedbackId: str
    complaintSubType: Optional[ComplaintSubType]
    complainedRecipients: list[ComplainedRecipients]
    timestamp: str
    userAgent: Optional[str]
    complaintFeedbackType: Optional[ComplaintFeedbackType]
    arrivalDate: Optional[str]

    @classmethod
    def from_dict(cls, raw_body: dict[str, Any]) -> ComplaintBody:
        assert isinstance(raw_body["feedbackId"], str)

        raw_subtype = raw_body.get("complaintSubType")
        assert raw_subtype in {None, "OnAccountSuppressionList"}
        complaintSubType = ComplaintSubType(raw_subtype) if raw_subtype else None

        assert isinstance(raw_body["complainedRecipients"], list)
        recipients = []
        for item in raw_body["complainedRecipients"]:
            recipients.append(ComplainedRecipients.from_dict(item))

        assert isinstance(raw_body["timestamp"], str)

        if "userAgent" in raw_body:
            userAgent = raw_body["userAgent"]
            assert isinstance(userAgent, str)
        else:
            userAgent = None

        if "complaintFeedbackType" in raw_body:
            feedbackType = ComplaintFeedbackType(raw_body["complaintFeedbackType"])
        else:
            feedbackType = None

        if "arrivalDate" in raw_body:
            arrivalDate = raw_body["arrivalDate"]
            assert isinstance(arrivalDate, str)
        else:
            arrivalDate = None

        return cls(
            feedbackId=raw_body["feedbackId"],
            complaintSubType=complaintSubType,
            complainedRecipients=recipients,
            timestamp=raw_body["timestamp"],
            userAgent=userAgent,
            complaintFeedbackType=feedbackType,
            arrivalDate=arrivalDate,
        )


class ComplaintFeedbackType(Enum):
    """
    Valid complaint values

    From AWS docs, sourced from
    https://www.iana.org/assignments/marf-parameters/marf-parameters.xhtml
    """

    # abuse - Indicates unsolicited email or some other kind of email abuse
    ABUSE = "abuse"
    # auth-failure — Email authentication failure report.
    AUTH_FAILURE = "auth-failure"
    # fraud — Indicates some kind of fraud or phishing activity.
    FRAUD = "fraud"
    # not-spam - Indicates that the entity providing the report does not
    # consider the message to be spam. This may be used to correct a message
    # that was incorrectly tagged or categorized as spam.
    NOT_SPAM = "not-spam"
    # other — Indicates any other feedback that does not fit into other
    # registered types.
    OTHER = "other"
    # virus — Reports that a virus is found in the originating message.
    VIRUS = "virus"


class ComplaintSubType(Enum):
    """
    Complaint sub-type

    Either null or "OnAccountSuppressionList" because the email was on the
    account-level suppression list.
    """

    SUPPRESSED = "OnAccountSuppressionList"


@dataclass
class ComplainedRecipients:
    """
    The details of the complaining recipients.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complained-recipients
    """

    emailAddress: str

    @classmethod
    def from_dict(cls, raw_body: dict[str, Any]) -> ComplainedRecipients:
        assert isinstance(raw_body["emailAddress"], str)
        return ComplainedRecipients(emailAddress=raw_body["emailAddress"])


@dataclass
class DeliveryBody:
    """
    The "delivery" element of a Delivery Notification.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#delivery-object
    """

    timestamp: str
    processingTimeMillis: int
    recipients: list[str]
    smtpResponse: str
    reportingMTA: str
    remoteMtaIp: str

    @classmethod
    def from_dict(cls, raw_body: dict[str, Any]) -> DeliveryBody:
        assert isinstance(raw_body["timestamp"], str)
        assert isinstance(raw_body["processingTimeMillis"], int)
        assert isinstance(raw_body["recipients"], list)
        assert all(isinstance(item, str) for item in raw_body["recipients"])
        assert isinstance(raw_body["smtpResponse"], str)
        assert isinstance(raw_body["reportingMTA"], str)
        assert isinstance(raw_body["remoteMtaIp"], str)
        return cls(
            timestamp=raw_body["timestamp"],
            processingTimeMillis=raw_body["processingTimeMillis"],
            recipients=raw_body["recipients"],
            smtpResponse=raw_body["smtpResponse"],
            reportingMTA=raw_body["reportingMTA"],
            remoteMtaIp=raw_body["remoteMtaIp"],
        )


@dataclass
class MailBody:
    """
    The details of the original email in bounce, compaint, and delivery notifications.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#mail-object
    """

    timestamp: str
    source: str
    sourceArn: str
    sourceIp: str
    callerIdentity: str
    sendingAccountId: str
    messageId: str
    destination: list[str]
    headersTruncated: Optional[bool]
    headers: Optional[list[MailHeader]]
    commonHeaders: Optional[CommonHeaders]

    @classmethod
    def from_dict(cls, raw_body: dict[str, Any]) -> MailBody:
        assert isinstance(raw_body["timestamp"], str)
        assert isinstance(raw_body["source"], str)
        assert isinstance(raw_body["sourceArn"], str)
        assert isinstance(raw_body["sourceIp"], str)
        assert isinstance(raw_body["callerIdentity"], str)
        assert isinstance(raw_body["messageId"], str)
        assert isinstance(raw_body["destination"], list)
        for item in raw_body["destination"]:
            assert isinstance(item, str)

        if "headersTruncated" in raw_body:
            assert isinstance(raw_body["headersTruncated"], bool)
            assert isinstance(raw_body["headers"], list)
            assert isinstance(raw_body["commonHeaders"], dict)

            headersTruncated = raw_body["headersTruncated"]
            headers = [MailHeader.from_dict(item) for item in raw_body["headers"]]
            commonHeaders = CommonHeaders.from_dict(raw_body["commonHeaders"])
        else:
            headersTruncated = None
            headers = None
            commonHeaders = None

        return MailBody(
            timestamp=raw_body["timestamp"],
            source=raw_body["source"],
            sourceArn=raw_body["sourceArn"],
            sourceIp=raw_body["sourceIp"],
            callerIdentity=raw_body["callerIdentity"],
            sendingAccountId=raw_body["sendingAccountId"],
            messageId=raw_body["messageId"],
            destination=raw_body["destination"],
            headersTruncated=headersTruncated,
            headers=headers,
            commonHeaders=commonHeaders,
        )


@dataclass
class MailHeader:
    """A name / value pair for a email's original header"""

    name: str
    value: str

    @classmethod
    def from_dict(cls, raw_body: dict[str, Any]) -> MailHeader:
        assert isinstance(raw_body["name"], str)
        assert isinstance(raw_body["value"], str)
        return cls(name=raw_body["name"], value=raw_body["value"])


@dataclass
class CommonHeaders:
    """
    Headers provided in the incoming / original email.

    Docs at:
    https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html#receiving-email-notifications-contents-mail-object-commonHeaders
    """

    messageId: Optional[str]
    date: Optional[str]
    to: Optional[list[str]]
    cc: Optional[list[str]]
    bcc: Optional[list[str]]
    from_: Optional[list[str]]  # API's "from" is a reserved Python keyword
    sender: Optional[str]
    returnPath: Optional[str]
    replyTo: Optional[list[str]]
    subject: Optional[str]

    @classmethod
    def from_dict(cls, raw_body: dict[str, Any]) -> CommonHeaders:
        messageId = raw_body.get("messageId")
        date = raw_body.get("date")
        to = raw_body.get("to")
        cc = raw_body.get("cc")
        bcc = raw_body.get("bcc")
        from_ = raw_body.get("from")
        sender = raw_body.get("sender")
        returnPath = raw_body.get("returnPath")
        replyTo = raw_body.get("replyTo")
        subject = raw_body.get("subject")

        assert messageId is None or isinstance(messageId, str)
        assert date is None or isinstance(date, str)
        assert to is None or (
            isinstance(to, list) and all(isinstance(item, str) for item in to)
        )
        assert cc is None or (
            isinstance(cc, list) and all(isinstance(item, str) for item in cc)
        )
        assert bcc is None or (
            isinstance(bcc, list) and all(isinstance(item, str) for item in bcc)
        )
        assert from_ is None or (
            isinstance(from_, list) and all(isinstance(item, str) for item in from_)
        )
        assert sender is None or isinstance(sender, str)
        assert returnPath is None or isinstance(returnPath, str)
        assert replyTo is None or (
            isinstance(replyTo, list) and all(isinstance(item, str) for item in replyTo)
        )
        assert subject is None or isinstance(subject, str)

        return cls(
            messageId=messageId,
            date=date,
            to=to,
            cc=cc,
            bcc=bcc,
            from_=from_,
            sender=sender,
            returnPath=returnPath,
            replyTo=replyTo,
            subject=subject,
        )


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
