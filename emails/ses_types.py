"""
Type definitions for SES Events and Notifications.

SES generates Notifications for receiving email, bounces, and complaints, and
for delivery of email. SES can also generates Events instead of Notifications
for email, bounces, etc., as well as other async events like clicking or
opening a tracker in a sent email. These Notifications and Events can be
delivered to SNS, which can process them (such as storing the email from a
Delivery Notification in S3), and add the message to a SQS queue or deliver as
a POST to an endpoint. Relay processes these messages to relay email, monitor
bounces, etc.

The boto3-stubs package contains typing stubs generated from the AWS service
specifications, which includes the response to calls like send_raw_email.
However, the AWS spec in botocore does _not_ include a spec for Notification
and Events, so we maintain our own.

References:
* https://youtype.github.io/boto3_stubs_docs/mypy_boto3_ses/
* https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications.html  # noqa: ignore E501
https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
* https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html

This file has these sections:

1. Types of messages
2. SesObject and SesMessage base classes
3. Top-Level Notification objects
4. Top-Level Event objects
5. Map of message types to SesMessage class
6. Second-level and lower sub-objects
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Type, Literal, Optional

from mypy_boto3_ses.literals import InvocationTypeType


#
# 1. Types of messages
#
# These enumerations defined the 4 notification types and 10 event types that
# we expected for the content of SNS messages sent by the SES processes.
#


class SesMessageType(Enum):
    """Base class for SesNotificationType and SesEventTypes"""


class SesNotificationType(SesMessageType):
    """
    What kind of SES Notification?

    For Bounce, Complaint, and Delivery notifications ("generic", same mail object) see:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
    For Received Notifications, see:
    https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
    """

    BOUNCE = "Bounce"
    COMPLAINT = "Complaint"
    DELIVERY = "Delivery"
    RECEIVED = "Received"


class SesEventType(SesMessageType):
    """
    What kind of SES Event?

    From:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    BOUNCE = "Bounce"
    COMPLAINT = "Complaint"
    DELIVERY = "Delivery"
    SEND = "Send"
    REJECT = "Reject"
    OPEN = "Open"
    CLICK = "Click"
    RENDERING_FAILURE = "Rendering Failure"
    DELIVERY_DELAY = "DeliveryDelay"
    SUBSCRIPTION = "Subscription"


#
# 2. SesObject and SesMessage base classes
#
# SesObject is used for any JSON object in an SES message, for typing purposes.
# SesMessage is for the "top-level" messages (4 notifications and 10 events),
#  and includes sub-objects derived from SesObject.
#


class SesObject:
    """Base class for SES objects and sub-objects."""


class SesChannelType(Enum):
    """
    Which channel generated a message?

    https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications.html
    """

    EVENT = "event"  # Via Event Publishing
    NOTIFICATION = "notification"  # Via Notification


class SesMessage(SesObject):
    """Base class for SES notifications and events."""

    channelType: SesChannelType
    messageType: SesMessageType
    notificationType: Optional[SesNotificationType]
    eventType: Optional[SesEventType]


#
# 3. Top-Level Notification objects
#
# These represent the notification objects emitted by SNS
#
# References:
# * For Bounce, Complaint and Delivery:
#   https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
# * For Received:
#   https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
#


class SesNotification(SesMessage):
    """Base class for SES notifications."""

    channelType = SesChannelType.NOTIFICATION
    notificationType: SesNotificationType
    eventType = None


@dataclass
class BounceNotification(SesNotification):
    """
    A Bounce Notification object delivered via SNS.

    See https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
    """

    notificationType = SesNotificationType.BOUNCE
    mail: MailObjectInGenericNotification
    bounce: BounceObjectInNotification


@dataclass
class ComplaintNotification(SesNotification):
    """
    A Complaint Notification object delivered via SNS.

    See https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
    """

    notificationType = SesNotificationType.COMPLAINT
    mail: MailObjectInGenericNotification
    complaint: ComplaintObject


@dataclass
class DeliveryNotification(SesNotification):
    """
    A Delivery Notification object delivered via SNS.

    See https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
    """

    notificationType = SesNotificationType.DELIVERY
    mail: MailObjectInGenericNotification
    delivery: DeliveryObjectInNotification


@dataclass
class ReceivedNotification(SesNotification):
    """
    A Received Notification object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
    """

    notificationType = SesNotificationType.RECEIVED
    receipt: ReceiptObject
    mail: MailObjectInReceivedNotification
    content: Optional[str] = None


#
# 4. Top-Level Event objects
#
# These represent the event objects emitted by SNS
#
# References:
# * For Bounce, Complaint and Delivery:
#   https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
# * For Received:
#   https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
#


class SesEvent(SesMessage):
    """Base class for SES events."""

    channelType = SesChannelType.EVENT
    notificationType = None
    eventType: SesEventType


@dataclass
class BounceEvent(SesEvent):
    """
    A Bounce Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.BOUNCE
    mail: MailObjectInEvent
    bounce: BounceObjectInEvent


@dataclass
class ComplaintEvent(SesEvent):
    """
    A Complaint Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.COMPLAINT
    mail: MailObjectInEvent
    complaint: ComplaintObject


@dataclass
class DeliveryEvent(SesEvent):
    """
    A Delivery Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.DELIVERY
    mail: MailObjectInEvent
    delivery: DeliveryObjectInEvent


@dataclass
class SendEvent(SesEvent):
    """
    A Send Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.SEND
    mail: MailObjectInEvent
    send: SendObject


@dataclass
class RejectEvent(SesEvent):
    """
    A Reject Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.REJECT
    mail: MailObjectInEvent
    reject: RejectObject


@dataclass
class OpenEvent(SesEvent):
    """
    A Open Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.OPEN
    mail: MailObjectInEvent
    # API's "open" is a Python keyword
    open_: OpenObject


@dataclass
class ClickEvent(SesEvent):
    """
    A Click Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.CLICK
    mail: MailObjectInEvent
    click: ClickObject


@dataclass
class RenderingFailureEvent(SesEvent):
    """
    A Rendering Failure Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.RENDERING_FAILURE
    mail: MailObjectInEvent
    failure: FailureObject


@dataclass
class DeliveryDelayEvent(SesEvent):
    """
    A DeliveryDelay Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.DELIVERY_DELAY
    mail: MailObjectInEvent
    deliveryDelay: DeliveryDelayObject


@dataclass
class SubscriptionEvent(SesEvent):
    """
    A Subscription Event object delivered via SNS.

    See:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
    """

    eventType = SesEventType.SUBSCRIPTION
    mail: MailObjectInEvent
    subscription: SubscriptionObject


#
# 5. Map of message types to SesMessage class
#
SES_MESSAGE_TYPE_TO_MESSAGE: dict[SesMessageType, Type[SesMessage]] = {
    SesNotificationType.BOUNCE: BounceNotification,
    SesNotificationType.COMPLAINT: ComplaintNotification,
    SesNotificationType.DELIVERY: DeliveryNotification,
    SesNotificationType.RECEIVED: ReceivedNotification,
    SesEventType.BOUNCE: BounceEvent,
    SesEventType.COMPLAINT: ComplaintEvent,
    SesEventType.DELIVERY: DeliveryEvent,
    SesEventType.SEND: SendEvent,
    SesEventType.REJECT: RejectEvent,
    SesEventType.OPEN: OpenEvent,
    SesEventType.CLICK: ClickEvent,
    SesEventType.RENDERING_FAILURE: RenderingFailureEvent,
    SesEventType.DELIVERY_DELAY: DeliveryDelayEvent,
    SesEventType.SUBSCRIPTION: SubscriptionEvent,
}


#
# 6. Second-level and lower sub-objects
#
# These are object members of notifications and events. Some are used by
# multiple top-level objects.
#


@dataclass
class BounceObjectInNotification(SesObject):
    """bounce object in a BounceNotification."""

    bounceType: BounceTypeType
    bounceSubType: BounceSubTypeType
    bouncedRecipients: list[BouncedRecipientsObject]
    timestamp: str
    feedbackId: str
    reportingMTA: Optional[str] = None
    remoteMtaIp: Optional[str] = None


class BounceTypeType(Enum):
    UNDETERMINED = "Undetermined"
    PERMANENT = "Permanent"
    TRANSIENT = "Transient"


class BounceSubTypeType(Enum):
    UNDETERMINED = "Undetermined"
    GENERAL = "General"
    NO_EMAIL = "NoEmail"
    SUPPRESSED = "Suppressed"
    ON_ACCOUNT_SUPPRESSION_LIST = "OnAccountSuppressionList"
    MAILBOX_FULL = "MailboxFull"
    MESSAGE_TOO_LARGE = "MessageTooLarge"
    CONTENT_REJECTED = "ContentRejected"
    ATTACHMENT_REJECTED = "AttachmentRejected"


ALLOWED_BOUNCE_TYPE_SUBTYPES: set[tuple[BounceTypeType, BounceSubTypeType]] = {
    (BounceTypeType.UNDETERMINED, BounceSubTypeType.UNDETERMINED),
    (BounceTypeType.PERMANENT, BounceSubTypeType.GENERAL),
    (BounceTypeType.PERMANENT, BounceSubTypeType.NO_EMAIL),
    (BounceTypeType.PERMANENT, BounceSubTypeType.SUPPRESSED),
    (BounceTypeType.PERMANENT, BounceSubTypeType.ON_ACCOUNT_SUPPRESSION_LIST),
    (BounceTypeType.TRANSIENT, BounceSubTypeType.GENERAL),
    (BounceTypeType.TRANSIENT, BounceSubTypeType.MAILBOX_FULL),
    (BounceTypeType.TRANSIENT, BounceSubTypeType.MESSAGE_TOO_LARGE),
    (BounceTypeType.TRANSIENT, BounceSubTypeType.CONTENT_REJECTED),
    (BounceTypeType.TRANSIENT, BounceSubTypeType.ATTACHMENT_REJECTED),
}


@dataclass
class BouncedRecipientsObject(SesObject):
    """object in bouncedRecipients list in BounceObject."""

    emailAddress: str
    action: Optional[str] = None
    status: Optional[str] = None
    diagnosticCode: Optional[str] = None


@dataclass
class ComplaintObject(SesObject):
    """
    complaint object in a ComplaintNotification and ComplaintEvent.

    complaintFeedbackType values from AWS docs, sourced from:
    https://www.iana.org/assignments/marf-parameters/marf-parameters.xhtml
    See Also:
    https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html#event-publishing-retrieving-sns-contents-complaint-object  # noqa: ignore E501
    """

    complainedRecipients: list[ComplainedRecipientsObject]
    timestamp: str
    feedbackId: str
    complaintSubType: Optional[Literal["OnAccountSuppressionList"]] = None
    userAgent: Optional[str] = None
    complaintFeedbackType: Optional[ComplaintFeedbackTypeType] = None
    arrivalDate: Optional[str] = None


class ComplaintFeedbackTypeType(Enum):
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


@dataclass
class ComplainedRecipientsObject(SesObject):
    """
    objects in ["complaint"]["complainedRecipients"] list in
    ComplaintNotification and ComplaintEvent.
    """

    emailAddress: str


@dataclass
class DeliveryObjectInNotification(SesObject):
    """delivery object in a DeliveryNotification."""

    timestamp: str
    processingTimeMillis: int
    recipients: list[str]
    smtpResponse: str
    reportingMTA: str
    remoteMtaIp: str


@dataclass
class MailObjectInGenericNotification(SesObject):
    """mail object in Bounce, Complaint, and DeliveryNotifications."""

    timestamp: str
    messageId: str
    source: str
    sourceArn: str
    sourceIp: str
    sendingAccountId: str
    destination: list[str]
    callerIdentity: Optional[str] = None  # Omitted in soft_bounce_sns_body.json
    headersTruncated: Optional[bool] = None
    headers: Optional[list[MailHeaderObject]] = None
    commonHeaders: Optional[CommonHeaders] = None


@dataclass
class MailObjectInReceivedNotification(SesObject):
    """mail object in ReceivedMailObject."""

    destination: list[str]
    messageId: str
    source: str
    # Omits the sourceArn, sourceIp used in other mail objects.
    timestamp: str
    headersTruncated: Optional[bool] = None
    headers: Optional[list[MailHeaderObject]] = None
    commonHeaders: Optional[CommonHeaders] = None


@dataclass
class MailHeaderObject(SesObject):
    """
    object in ["mail"]["headers"] list in Bounce, Complaint, and DeliveryNotification.
    """

    name: str
    value: str


@dataclass
class CommonHeaders(SesObject):
    """object in ["mail"]["commonHeaders"] in all *Notifications."""

    _api_names = {"from": "from_"}

    messageId: Optional[str] = None
    date: Optional[str] = None
    to: Optional[list[str]] = None
    cc: Optional[list[str]] = None
    bcc: Optional[list[str]] = None
    # API's "from" is a reserved Python keyword
    from_: Optional[list[str]] = None
    sender: Optional[str] = None
    returnPath: Optional[str] = None
    replyTo: Optional[list[str]] = None
    subject: Optional[str] = None


class DmarcPolicyType(Enum):
    """values for ["receipt"]["dmarcPolicy"] for ReceivedNotification."""

    QUARANTINE = "quarantine"
    REJECT = "reject"


@dataclass
class ReceiptObject(SesObject):
    """receipt object in ReceivedNotification."""

    action: ActionObject
    dkimVerdict: VerdictObject
    processingTimeMillis: int
    recipients: list[str]
    spamVerdict: VerdictObject
    spfVerdict: VerdictObject
    timestamp: str
    virusVerdict: VerdictObject
    dmarcPolicy: Optional[DmarcPolicyType] = None
    dmarcVerdict: Optional[VerdictObject] = None


@dataclass
class ActionObject(SesObject):
    """object for ["receipt"]["action"] in ReceivedNotification."""

    type_: ActionTypeType  # API's "type" is a reserved Python keyword
    topicArn: str

    # More data by type:

    # Only for type=S3
    bucketName: Optional[str] = None
    objectKey: Optional[str] = None
    # This field is in s3_stored_email_sns_body.json
    objectKeyPrefix: Optional[str] = None

    # Only for type=Bounce
    smtpReplyCode: Optional[str] = None
    statusCode: Optional[str] = None
    message: Optional[str] = None
    sender: Optional[str] = None

    # Only for type=Lambda
    functionArn: Optional[str] = None
    invocationType: Optional[InvocationTypeType] = None

    # Only for type=WorkMail
    organizationArn: Optional[str] = None

    # In type=SNS, single_recipient_list_email_sns_body.json
    encoding: Optional[str] = None


class ActionTypeType(Enum):
    """Values for ["receipt"]["action"]["type"] in ReceivedNotification."""

    S3 = "S3"
    SNS = "SNS"
    BOUNCE = "Bounce"
    LAMBDA = "Lambda"
    STOP = "Stop"
    WORKMAIL = "WorkMail"


@dataclass
class VerdictObject(SesObject):
    """Common object for ["receipt"]["*Verdict"] in ReceivedNotification."""

    status: VerdictStatusType


class VerdictStatusType(Enum):
    """Values for ["receipt"]["*Verdict"]["status"] for ReceivedNotification."""

    PASS = "PASS"
    FAIL = "FAIL"
    GRAY = "GRAY"
    PROCESSING_FAILED = "PROCESSING_FAILED"


@dataclass
class BounceObjectInEvent(SesObject):
    """bounce object in a BounceEvent."""

    bounceType: BounceTypeType
    bounceSubType: BounceSubTypeType
    bouncedRecipients: list[BouncedRecipientsObject]
    timestamp: str
    feedbackId: str
    reportingMTA: Optional[str]


@dataclass
class MailObjectInEvent(SesObject):
    """mail object in *EventType"""

    timestamp: str
    messageId: str
    source: str
    sendingAccountId: str
    destination: list[str]
    tags: dict[str, list[str]]
    headersTruncated: Optional[bool] = None
    headers: Optional[list[MailHeaderObject]] = None
    commonHeaders: Optional[CommonHeaders] = None
    sourceArn: Optional[str] = None


@dataclass
class DeliveryObjectInEvent(SesObject):
    """delivery object in a DeliveryEvent."""

    timestamp: str
    processingTimeMillis: int
    recipients: list[str]
    smtpResponse: str
    reportingMTA: str


@dataclass
class SendObject(SesObject):
    """send object in SendEvent (always empty)."""


@dataclass
class RejectObject(SesObject):
    """reject object in RejectEvent."""

    reason: Literal["Bad content"]  # Virus detected


@dataclass
class OpenObject(SesObject):
    """open object in OpenEvent."""

    ipAddress: str
    timestamp: str
    userAgent: str


@dataclass
class ClickObject(SesObject):
    """click object in ClickEvent."""

    ipAddress: str
    timestamp: str
    userAgent: str
    link: str
    linkTags: dict[str, list[str]]


@dataclass
class FailureObject(SesObject):
    """failure object in RenderingFailureEvent."""

    templateName: str
    errorMessage: str


@dataclass
class DeliveryDelayObject(SesObject):
    """deliveryDelay object in DeliveryDelayEvent."""

    delayType: DelayTypeType
    delayedRecipients: list[DelayedRecipientsObject]
    expirationTime: str
    timestamp: str
    reportingMTA: Optional[str] = None


class DelayTypeType(Enum):
    """Values for ["deliveryDelay"]["delayType"] in DeliveryDelayObject."""

    INTERNAL_FAILURE = "InternalFailure"
    GENERAL = "General"
    MAILBOX_FULL = "MailboxFull"
    SPAM_DETECTED = "SpamDetected"
    RECIPIENT_SERVER_ERROR = "RecipientServerError"
    IP_FAILURE = "IPFailure"
    TRANSIENT_COMMUNICATION_FAILURE = "TransientCommunicationFailure"
    BYOIP_HOSTNAME_LOOKUP_UNAVAILABLE = "BYOIPHostNameLookupUnavailable"
    UNDETERMINED = "Undetermined"


@dataclass
class DelayedRecipientsObject(SesObject):
    """
    object in ["deliveryDelay"]["delayedRecipients"] list in DeliveryDelayObject.
    """

    emailAddress: str
    status: str
    diagnosticCode: str


@dataclass
class SubscriptionObject(SesObject):
    """subscription object in SubscriptionEvent."""

    contactList: str
    timestamp: str
    source: str
    newTopicPreferences: TopicPreferencesObject
    oldTopicPreferences: TopicPreferencesObject


@dataclass
class TopicPreferencesObject(SesObject):
    """
    common object in ["subscription"]["*TopicPreferences"] in SubscriptionEvent
    """

    unsubscribeAll: bool
    topicSubscriptionStatus: list[TopicSubscriptionStatusObject]


@dataclass
class TopicSubscriptionStatusObject(SesObject):
    """
    object in ["subscription"]["*TopicPreferences"]["topicSubscriptionStatus"]
    in SubscriptionEvent
    """

    topicName: str
    subscriptionStatus: SubscriptionStatusType


class SubscriptionStatusType(Enum):
    """
    values for ["subscription"]["*TopicPreferences"]["topicSubscriptionStatus"]
    ["subscriptionStatus"] in SubscriptionEventTypeDef
    """

    OPT_OUT = "OptOut"
    OPT_IN = "OptIn"
