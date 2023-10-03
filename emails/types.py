"""Types for email functions"""
from typing import Any, Literal

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
