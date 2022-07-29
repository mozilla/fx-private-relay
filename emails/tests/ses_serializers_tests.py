"""Confirm that ses_serializers can load AWS messages."""
import json
from pathlib import Path

from rest_framework.exceptions import ErrorDetail, ValidationError

import pytest

from emails.ses_serializers import (
    BounceNotificationSerializer,
    BounceObjectInEventSerializer,
    BounceObjectInNotificationSerializer,
    ComplaintObjectSerializer,
    ExpectedEnumValueValidator,
    ReceivedNotificationSerializer,
    SES_MESSAGE_TYPE_TO_SERIALIZER,
    VerdictObjectSerializer,
)
from emails.ses_types import (
    ActionObject,
    BounceNotification,
    BounceObjectInNotification,
    BouncedRecipientsObject,
    CommonHeaders,
    MailHeaderObject,
    MailObjectInGenericNotification,
    MailObjectInReceivedNotification,
    ReceiptObject,
    ReceivedNotification,
    SES_MESSAGE_TYPE_TO_MESSAGE,
    SesNotificationType,
    VerdictObject,
)
from emails.ses import get_ses_message, get_ses_message_type

from .views_tests import EMAIL_SNS_BODIES, BOUNCE_SNS_BODIES


# Load the SES json fixtures from files
my_path = Path(__file__)
fixtures_path = my_path.parent / "fixtures"
SES_BODIES = {}
suffix = "_ses_body.json"
for fixture_file in fixtures_path.glob(f"*{suffix}"):
    key = fixture_file.name[: -len(suffix)]
    SES_BODIES[key] = json.loads(fixture_file.read_text())


@pytest.mark.parametrize("key", list(SES_BODIES.keys()))
def test_ses_serializer_round_trip(key) -> None:
    """SesSerializers can deserialize to SesMessages, and serialize back to SES data."""
    incoming_data = SES_BODIES[key]
    message_type = get_ses_message_type(incoming_data)
    message = get_ses_message(incoming_data)
    assert isinstance(message, SES_MESSAGE_TYPE_TO_MESSAGE[message_type])

    serializer = SES_MESSAGE_TYPE_TO_SERIALIZER[message_type](message)
    outgoing_data = serializer.data
    assert incoming_data == outgoing_data


@pytest.mark.parametrize("key", list(EMAIL_SNS_BODIES.keys()))
def test_ses_serializer_round_trip_email_sns(key) -> None:
    """SesSerializers can handle the payload of SES email fixtures."""
    incoming_sns = EMAIL_SNS_BODIES[key]
    incoming_data = json.loads(incoming_sns["Message"])
    message_type = get_ses_message_type(incoming_data)
    message = get_ses_message(incoming_data)
    assert isinstance(message, SES_MESSAGE_TYPE_TO_MESSAGE[message_type])

    serializer = SES_MESSAGE_TYPE_TO_SERIALIZER[message_type](message)
    outgoing_data = serializer.data
    assert incoming_data == outgoing_data


@pytest.mark.parametrize("key", list(BOUNCE_SNS_BODIES.keys()))
def test_ses_serializer_round_trip_bounce_sns(key) -> None:
    """SesSerializers can handle the payload of SES bounce fixtures."""
    incoming_sns = BOUNCE_SNS_BODIES[key]
    incoming_data = json.loads(incoming_sns["Message"])
    message_type = get_ses_message_type(incoming_data)
    message = get_ses_message(incoming_data)
    assert isinstance(message, SES_MESSAGE_TYPE_TO_MESSAGE[message_type])

    serializer = SES_MESSAGE_TYPE_TO_SERIALIZER[message_type](message)
    outgoing_data = serializer.data
    assert incoming_data == outgoing_data


def test_bounce_notification_serializer_with_dsn():
    """A Bounce notification can be deserialized / serialized."""
    incoming_data = SES_BODIES["bounce_notification_with_dsn_example"]
    deserializer = BounceNotificationSerializer(data=incoming_data)
    assert deserializer.is_valid()
    message = deserializer.save()

    # Check that subobjects are the expected types
    assert isinstance(message, BounceNotification)
    assert message.notificationType == SesNotificationType.BOUNCE

    assert isinstance(message.mail, MailObjectInGenericNotification)
    assert message.mail.source == "john@example.com"
    assert len(message.mail.headers) == 7
    for item in message.mail.headers:
        assert isinstance(item, MailHeaderObject)
    assert isinstance(message.mail.commonHeaders, CommonHeaders)
    assert message.mail.commonHeaders.from_ == ["John Doe <john@example.com>"]
    assert len(message.mail.destination) == 3
    for item in message.mail.destination:
        assert isinstance(item, str)

    assert isinstance(message.bounce, BounceObjectInNotification)
    assert len(message.bounce.bouncedRecipients) == 1
    assert isinstance(message.bounce.bouncedRecipients[0], BouncedRecipientsObject)

    # Serialization works
    serializer = BounceNotificationSerializer(message)
    outgoing_data = serializer.data
    assert incoming_data == outgoing_data


def test_received_notification_alert_serializer():
    """A Recieved notification with S3 storage can be deserialized / serialized."""
    incoming_data = SES_BODIES["received_notification_alert_example"]
    deserializer = ReceivedNotificationSerializer(data=incoming_data)
    assert deserializer.is_valid()
    message = deserializer.save()

    # Check that subobjects are the expected types
    assert isinstance(message, ReceivedNotification)
    assert message.notificationType == SesNotificationType.RECEIVED

    assert isinstance(message.receipt, ReceiptObject)
    assert isinstance(message.receipt.spamVerdict, VerdictObject)
    assert isinstance(message.receipt.virusVerdict, VerdictObject)
    assert isinstance(message.receipt.spfVerdict, VerdictObject)
    assert isinstance(message.receipt.dkimVerdict, VerdictObject)
    assert isinstance(message.receipt.action, ActionObject)
    assert message.receipt.action.objectKey == "\\email"

    assert isinstance(message.mail, MailObjectInReceivedNotification)
    assert (
        message.mail.source
        == "0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com"
    )
    assert len(message.mail.headers) == 13
    assert isinstance(message.mail.commonHeaders, CommonHeaders)
    assert message.mail.commonHeaders.from_ == ["sender@example.com"]

    # Serialization works
    serializer = ReceivedNotificationSerializer(message)
    outgoing_data = serializer.data
    assert incoming_data == outgoing_data


def test_expected_enum_value_validator():
    """ExpectedEnumValueValidator raises an exception on an unexpected value."""
    validator = ExpectedEnumValueValidator(SesNotificationType.BOUNCE)
    validator(SesNotificationType.BOUNCE)  # No exception raised
    with pytest.raises(ValidationError) as exc_info:
        validator(SesNotificationType.COMPLAINT)
    assert exc_info.value.detail == [
        ErrorDetail(
            string=(
                'Expected "SesNotificationType.BOUNCE",'
                ' got "SesNotificationType.COMPLAINT".'
            ),
            code="invalid",
        )
    ]


def test_enum_field_in_verdict_object_serializer():
    """EnumField fails validation on a value not in the enum."""
    data = {"status": "OTHER"}
    verdict_serializer = VerdictObjectSerializer(data=data)
    assert not verdict_serializer.is_valid()
    assert verdict_serializer.errors == {
        "status": [
            ErrorDetail(
                string="'OTHER' is not a valid VerdictStatusType", code="invalid"
            )
        ]
    }


@pytest.mark.parametrize("subtype", (None, "OnAccountSuppressionList"))
def test_complaint_object_serializer(subtype):
    """ComplaintObjectSerializer.complaintSubType takes valid values."""
    data = {
        "userAgent": "AnyCompany Feedback Loop (V0.01)",
        "complainedRecipients": [{"emailAddress": "richard@example.com"}],
        "complaintFeedbackType": "abuse",
        "complaintSubType": subtype,
        "arrivalDate": "2016-01-27T14:59:38.237Z",
        "timestamp": "2016-01-27T14:59:38.237Z",
        "feedbackId": "000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000",
    }
    in_serializer = ComplaintObjectSerializer(data=data)
    assert in_serializer.is_valid()
    obj = in_serializer.save()
    assert obj.complaintSubType == subtype
    out_serializer = ComplaintObjectSerializer(obj)
    assert out_serializer.data == data


def test_complaint_object_serializer_bad_subtype():
    """ComplaintObjectSerializer.complaintSubType rejects invalid values."""
    data = {
        "userAgent": "AnyCompany Feedback Loop (V0.01)",
        "complainedRecipients": [{"emailAddress": "richard@example.com"}],
        "complaintFeedbackType": "abuse",
        "complaintSubType": "bad",
        "arrivalDate": "2016-01-27T14:59:38.237Z",
        "timestamp": "2016-01-27T14:59:38.237Z",
        "feedbackId": "000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000",
    }
    in_serializer = ComplaintObjectSerializer(data=data)
    assert not in_serializer.is_valid()
    assert in_serializer.errors == {
        "complaintSubType": [
            ErrorDetail(
                string='Expected null or "OnAccountSuppressionList".', code="invalid"
            )
        ]
    }


@pytest.mark.parametrize(
    "serializerClass",
    [BounceObjectInNotificationSerializer, BounceObjectInEventSerializer],
)
def test_bounce_object_in_serializer_type_combo(serializerClass):
    """BounceObjectIn*Serializer checks for a valid Type / SubType combo."""
    data = {
        "feedbackId": "0100018264c6525d-e8967b05-82f8-4575-9413-34faff769528-000000",
        "bounceType": "Permanent",
        "bounceSubType": "MailboxFull",
        "bouncedRecipients": [
            {
                "emailAddress": "bounce@simulator.amazonses.com",
                "action": "failed",
                "status": "5.1.1",
                "diagnosticCode": "smtp; 550 5.1.1 user unknown",
            }
        ],
        "timestamp": "2022-08-03T17:34:55.000Z",
        "remoteMtaIp": "3.225.75.158",
        "reportingMTA": "dns; a8-43.smtp-out.amazonses.com",
    }
    in_serializer = serializerClass(data=data)
    assert not in_serializer.is_valid()
    assert in_serializer.errors == {
        "non_field_errors": [
            ErrorDetail(
                string=(
                    'bounceType "Permanent" and bounceSubType "MailboxFull"'
                    " is not a valid combination."
                ),
                code="invalid",
            )
        ]
    }
