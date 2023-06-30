"""Types for email functions"""
from typing import Any, Literal
from io import IOBase

# Relay container for email content
MessageBodyContent = dict[Literal["Charset", "Data"], str]
MessageBody = dict[Literal["Text", "Html"], MessageBodyContent]

# Attachment path and data stream
AttachmentPair = tuple[str, IOBase]

# Headers for outgoing emails
OutgoingHeaderName = Literal[
    "From",
    "In-Reply-To",
    "References",
    "Reply-To",
    "Resent-From",
    "Subject",
    "To",
]
OutgoingHeaders = dict[OutgoingHeaderName, str]

# Generic AWS message over SNS - Notification, Bounce, Complaint, ...
AWS_SNSMessageJSON = dict[str, Any]

# AWS "mail" element in Received notification
# See https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
AWS_MailJSON = dict[str, Any]
