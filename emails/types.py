"""Types for email functions"""
from typing import Any, Literal, TypedDict

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


class EmailHeaderExceptionOnReadIssue(TypedDict):
    exception_on_read: str


class EmailHeaderExceptionOnWriteIssue(TypedDict):
    exception_on_write: str


class EmailHeaderDefectIssue(TypedDict):
    defect_count: int
    parsed_value: str
    unstructured_value: str


EmailHeaderIssue = (
    EmailHeaderExceptionOnReadIssue
    | EmailHeaderExceptionOnWriteIssue
    | EmailHeaderDefectIssue
)

EmailHeaderIssues = dict[Literal["incoming", "outgoing"], dict[str, EmailHeaderIssue]]

EmailForwardingIssues = dict[Literal["headers"], EmailHeaderIssues]
