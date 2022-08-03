"""
Serializers built on Django REST Framework for loading SES data.

This file has these sections:

1. Custom validators and fields
2. SesSerializer base class
3. Serializers for Second-level and lower sub-objects
4. Serializers for Top-level objects
5. Map of message types to top-level serializers

This is a different order than ses_types because DRF Serializers
require classes to be declared before used.

"""

from dataclasses import replace
from enum import Enum
from typing import Any, Mapping, Optional, Type, TypeVar
import json
import logging
import shlex

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .ses_types import (
    ALLOWED_BOUNCE_TYPE_SUBTYPES,
    ActionObject,
    ActionTypeType,
    BounceEvent,
    BounceNotification,
    BounceObjectInEvent,
    BounceObjectInNotification,
    BounceSubTypeType,
    BounceTypeType,
    BouncedRecipientsObject,
    ClickEvent,
    ClickObject,
    CommonHeaders,
    ComplainedRecipientsObject,
    ComplaintEvent,
    ComplaintFeedbackTypeType,
    ComplaintNotification,
    ComplaintObject,
    DelayTypeType,
    DelayedRecipientsObject,
    DeliveryDelayEvent,
    DeliveryDelayObject,
    DeliveryEvent,
    DeliveryNotification,
    DeliveryObjectInEvent,
    DeliveryObjectInNotification,
    DmarcPolicyType,
    FailureObject,
    MailHeaderObject,
    MailObjectInEvent,
    MailObjectInGenericNotification,
    MailObjectInReceivedNotification,
    OpenEvent,
    OpenObject,
    ReceiptObject,
    ReceivedNotification,
    RejectEvent,
    RejectObject,
    RenderingFailureEvent,
    SendEvent,
    SendObject,
    SesEvent,
    SesEventType,
    SesMessageType,
    SesNotification,
    SesNotificationType,
    SesObject,
    SubscriptionEvent,
    SubscriptionObject,
    SubscriptionStatusType,
    TopicPreferencesObject,
    TopicSubscriptionStatusObject,
    VerdictObject,
    VerdictStatusType,
)

logger = logging.getLogger("eventsinfo")


#
# 1. Custom validators and fields
#
# These could potentially live in another file, like api/fields.py, if they are
# useful for other DRF serializers.
#
_Enum = TypeVar("_Enum", bound=Enum)


class ExpectedEnumValueValidator:
    """Validate that enumeration-only field has a specific enumeration value."""

    message = 'Expected "{expected}", got "{value}".'
    code = "invalid"

    def __init__(self, expected: Enum):
        self.expected = expected

    def __call__(self, value: Enum) -> None:
        if value != self.expected:
            msg = self.message.format(expected=self.expected, value=value)
            raise ValidationError(msg, code=self.code)


class EnumField(serializers.Field):
    """A field that takes only values of an enumeration."""

    def __init__(self, enum: Type[_Enum], expected: Optional[_Enum] = None, **kwargs):
        self.enum = enum
        self.expected = expected
        read_only = kwargs.pop("read_only", False) or (self.expected is not None)
        super().__init__(read_only=read_only, **kwargs)
        if self.expected:
            self.validators.append(ExpectedEnumValueValidator(self.expected))

    def to_internal_value(self, data: str) -> _Enum:
        """Convert from string to Enum instance."""
        try:
            return self.enum(data)
        except ValueError as exception:
            raise ValidationError(str(exception))

    def to_representation(self, value: _Enum) -> str:
        """Convert from Enum instance to string."""
        return str(value.value)


class StringListField(serializers.ListField):
    """Serialize a list of strings."""

    child = serializers.CharField()


#
# 2. SesSerializer base class
#
# This class extends DRF's Serializer to reduce the code needed to deserialize
# SES messages.
#


class SesSerializer(serializers.Serializer):
    """Base class for SES serializers"""

    class Meta:
        """Metadata to customize serialization."""

        # The class that recieves data when create() / save() is called
        dataclass: Type[SesObject]

        # AWS name to serializer name. This is useful when the AWS name is a
        # reserved keyword like 'type' or 'open', or when it is a Serializer
        # reserved member like 'source'.
        source_to_serializer_names: dict[str, str]

        # Serializer name to SesObject name. This is useful when the AWS name
        # is a Serializer reserved member like 'source', but it is OK as a name
        # on a SesObject
        serializer_to_object_names: dict[str, str]

    def create(self, validated_data: dict[str, Any]) -> SesObject:
        """
        Initialize a SesObject from the validated data.

        This is called by save() when creating a new instance.

        It uses:
        * Meta.dataclass to determine the SesObject-derived class
        * Meta.source_to_serializer_names to determine if fields were renamed
        * Meta.serializer_to_object_names to (re-)rename fields if needed
        """
        object_class = self.Meta.dataclass
        assert issubclass(object_class, SesObject)

        # Transform validated data to SesMessage initial data
        fields = self.get_fields()
        init_data: dict[str, Any] = {}
        serial_to_obj = getattr(self.Meta, "serializer_to_object_names", {})
        for key, value in validated_data.items():
            field = fields[key]
            obj_key = serial_to_obj.get(key, key)
            init_data[obj_key] = self._prep_field_value(field, value)
        obj = object_class(**init_data)
        assert isinstance(obj, SesObject)
        return obj

    def _prep_field_value(self, field: serializers.Field, value: Any) -> Any:
        """Prepare a field to be written to an SesObject."""
        if isinstance(field, serializers.ListField):
            # For list objects, prepare each sub-item
            return [self._prep_field_value(field.child, item) for item in value]
        elif isinstance(field, SesSerializer):
            # For serialized objects, recursively create SesObjects
            sub_serializer = field.__class__(data=value)
            assert sub_serializer.is_valid()
            return sub_serializer.save()
        else:
            # For simple data, the value is the value
            return value

    def to_internal_value(self, data: Mapping[str, Any]) -> Any:
        """
        When de-serializing AWS SES messages, rename fields, log unexpected fields.

        This uses:
        * Meta.dataclass to look for top-level SesMessage objects
        * Meta.source_to_serializer_names to re-key incoming data with expected names.
        """
        # Rename incoming fields to match serializer fields
        source_to_serial = getattr(self.Meta, "source_to_serializer_names", {})
        renamed = {source_to_serial.get(key, key): val for key, val in data.items()}
        ret = super().to_internal_value(renamed)

        # Log but discard unprocessed incoming fields
        dataclass = self.Meta.dataclass
        known_keys: set[str] = set()
        if issubclass(dataclass, SesNotification):
            known_keys = set(("notificationType",))
        elif issubclass(dataclass, SesEvent):
            known_keys = set(("eventType",))
        unprocessed_keys = set(renamed) - set(ret) - known_keys
        if unprocessed_keys:
            logger.warning(
                "unprocessed_ses_data",
                extra={
                    "dataclass": dataclass.__name__,
                    "unprocessed_data": {
                        shlex.quote(key): json.dumps(data[key])
                        for key in unprocessed_keys
                    },
                },
            )

        return ret

    def to_representation(self, instance: SesObject) -> Any:
        """
        When serializing an SesObject, inject renamed fields and omit Nones.

        This uses:
        * Meta.serializer_to_object_names to augment SesObjects with expected names.
        * Meta.source_to_serializer_names to re-key to expected AWS SES names.
        """

        # Inject attributes expected by serializers.Serializer.to_representation
        serial_to_obj = getattr(self.Meta, "serializer_to_object_names", {})
        renamed_instance = replace(instance)  # copy by calling without replacements
        for serial_key, obj_key in serial_to_obj.items():
            value = getattr(instance, obj_key)
            assert not hasattr(renamed_instance, serial_key)
            setattr(renamed_instance, serial_key, value)

        raw = super().to_representation(renamed_instance)

        # Rename serializer keys and discard None values
        source_to_serial = getattr(self.Meta, "source_to_serializer_names", {})
        serial_to_source = {val: key for key, val in source_to_serial.items()}
        rep: dict[str, Any] = {}
        for key, val in raw.items():
            if val is None:
                continue
            source_key = serial_to_source.get(key, key)
            rep[source_key] = val
        return rep


#
# 3. Serializers for Second-level and lower sub-objects
#
# Serializers require all used fields to be defined, so we have to
# declare serializers bottom-up, instead of top-down like ses_types.
#


class TopicSubscriptionStatusObjectSerializer(SesSerializer):
    """Serializer for TopicSubscriptionStatusObject."""

    class Meta(SesSerializer.Meta):
        dataclass = TopicSubscriptionStatusObject

    topicName = serializers.CharField()
    subscriptionStatus = EnumField(SubscriptionStatusType)


class TopicPreferencesObjectSerializer(SesSerializer):
    """Serializer for TopicPreferencesObject."""

    class Meta(SesSerializer.Meta):
        dataclass = TopicPreferencesObject

    unsubscribeAll = serializers.BooleanField()
    topicSubscriptionStatus = serializers.ListField(
        child=TopicSubscriptionStatusObjectSerializer()
    )


class SubscriptionObjectSerializer(SesSerializer):
    """Serializer for SubscriptionObject."""

    class Meta(SesSerializer.Meta):
        dataclass = SubscriptionObject
        source_to_serializer_names = {"source": "source_"}
        serializer_to_object_names = {"source_": "source"}

    contactList = serializers.CharField()
    timestamp = serializers.CharField()
    source_ = serializers.CharField()
    newTopicPreferences = TopicPreferencesObjectSerializer()
    oldTopicPreferences = TopicPreferencesObjectSerializer()


class DelayedRecipientsObjectSerializer(SesSerializer):
    """Serializer for DelayedRecipientsObject."""

    class Meta(SesSerializer.Meta):
        dataclass = DelayedRecipientsObject

    emailAddress = serializers.CharField()
    status = serializers.CharField()
    diagnosticCode = serializers.CharField()


class DeliveryDelayObjectSerializer(SesSerializer):
    """Serializer for DeliveryDelayObject."""

    class Meta(SesSerializer.Meta):
        dataclass = DeliveryDelayObject

    delayType = EnumField(DelayTypeType)
    delayedRecipients = serializers.ListField(child=DelayedRecipientsObjectSerializer())
    expirationTime = serializers.CharField()
    timestamp = serializers.CharField()
    reportingMTA = serializers.CharField(required=False)


class FailureObjectSerializer(SesSerializer):
    """Serializer for FailureObject."""

    class Meta(SesSerializer.Meta):
        dataclass = FailureObject

    templateName = serializers.CharField()
    errorMessage = serializers.CharField()


class ClickObjectSerializer(SesSerializer):
    """Serializer for ClickObject."""

    class Meta(SesSerializer.Meta):
        dataclass = ClickObject

    ipAddress = serializers.CharField()
    timestamp = serializers.CharField()
    userAgent = serializers.CharField()
    link = serializers.CharField()
    linkTags = serializers.DictField(child=StringListField())


class OpenObjectSerializer(SesSerializer):
    """Serializer for OpenObject."""

    class Meta(SesSerializer.Meta):
        dataclass = OpenObject

    ipAddress = serializers.CharField()
    timestamp = serializers.CharField()
    userAgent = serializers.CharField()


class RejectObjectSerializer(SesSerializer):
    """Serializer for RejectObject."""

    class Meta(SesSerializer.Meta):
        dataclass = RejectObject

    reason = serializers.CharField()


class SendObjectSerializer(SesSerializer):
    """Serializer for SendObject."""

    class Meta(SesSerializer.Meta):
        dataclass = SendObject

    # The send object is empty, so there are no fields declared either.


class VerdictObjectSerializer(SesSerializer):
    """Serializer for VerdictObject."""

    class Meta(SesSerializer.Meta):
        dataclass = VerdictObject

    status = EnumField(VerdictStatusType)


class ActionObjectSerializer(SesSerializer):
    """Serializer for ActionObject."""

    class Meta(SesSerializer.Meta):
        dataclass = ActionObject
        source_to_serializer_names = {"type": "type_"}

    type_ = EnumField(ActionTypeType)  # AWS API's 'type' is Python keyword
    topicArn = serializers.CharField()

    # Only for type=S3
    bucketName = serializers.CharField(required=False)
    objectKey = serializers.CharField(required=False)
    # In s3_stored_email_sns_body.json, not in docs
    objectKeyPrefix = serializers.CharField(required=False)

    # Only for type=Bounce
    smtpReplyCode = serializers.CharField(required=False)
    statusCode = serializers.CharField(required=False)
    message = serializers.CharField(required=False)
    sender = serializers.CharField(required=False)

    # Only for type=Lambda
    functionArn = serializers.CharField(required=False)
    invocationType = serializers.CharField(required=False)

    # Only for type=WorkMail
    organizationArn = serializers.CharField(required=False)

    # In single_recipient_list_email_sns_body.json, not in docs
    encoding = serializers.CharField(required=False)


class ReceiptObjectSerializer(SesSerializer):
    """Serializer for ReceiptObject."""

    class Meta(SesSerializer.Meta):
        dataclass = ReceiptObject

    action = ActionObjectSerializer()
    dkimVerdict = VerdictObjectSerializer()
    processingTimeMillis = serializers.IntegerField()
    recipients = StringListField()
    spamVerdict = VerdictObjectSerializer()
    spfVerdict = VerdictObjectSerializer()
    timestamp = serializers.CharField()
    virusVerdict = VerdictObjectSerializer()
    dmarcPolicy = EnumField(DmarcPolicyType, required=False)
    dmarcVerdict = VerdictObjectSerializer(required=False)


class MailHeaderObjectSerializer(SesSerializer):
    """Serializer for MailHeaderObject."""

    class Meta(SesSerializer.Meta):
        dataclass = MailHeaderObject

    name = serializers.CharField()
    value = serializers.CharField()


class CommonHeadersSerializer(SesSerializer):
    """Serializer for CommonHeaders."""

    class Meta(SesSerializer.Meta):
        dataclass = CommonHeaders
        source_to_serializer_names = {"from": "from_"}

    messageId = serializers.CharField(required=False)
    date = serializers.CharField(required=False)
    to = StringListField(required=False)
    cc = StringListField(required=False)
    bcc = StringListField(required=False)
    # API's "from" is a reserved Python keyword
    from_ = StringListField(required=False)
    sender = StringListField(required=False)
    returnPath = serializers.CharField(required=False)
    replyTo = StringListField(required=False)
    subject = serializers.CharField(required=False)


class MailObjectInReceivedNotificationSerializer(SesSerializer):
    """Serializer for MailObjectInReceivedNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = MailObjectInReceivedNotification
        source_to_serializer_names = {"source": "source_"}
        serializer_to_object_names = {"source_": "source"}

    destination = StringListField()
    messageId = serializers.CharField()
    source_ = serializers.CharField()
    timestamp = serializers.CharField()
    headersTruncated = serializers.BooleanField(required=False)
    headers = serializers.ListField(child=MailHeaderObjectSerializer(), required=False)
    commonHeaders = CommonHeadersSerializer(required=False)


class MailObjectInGenericNotificationSerializer(SesSerializer):
    """Serializer for MailObjectInGenericNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = MailObjectInGenericNotification
        source_to_serializer_names = {"source": "source_"}
        serializer_to_object_names = {"source_": "source"}

    timestamp = serializers.CharField()
    messageId = serializers.CharField()
    source_ = serializers.CharField()
    sourceArn = serializers.CharField()
    sourceIp = serializers.CharField()
    sendingAccountId = serializers.CharField()
    callerIdentity = serializers.CharField(required=False)
    destination = StringListField()
    headersTruncated = serializers.BooleanField(required=False)
    headers = serializers.ListField(child=MailHeaderObjectSerializer(), required=False)
    commonHeaders = CommonHeadersSerializer(required=False)


class MailObjectInEventSerializer(SesSerializer):
    """Serializer for MailObjectInEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = MailObjectInEvent
        source_to_serializer_names = {"source": "source_"}
        serializer_to_object_names = {"source_": "source"}

    timestamp = serializers.CharField()
    messageId = serializers.CharField()
    source_ = serializers.CharField()
    sendingAccountId = serializers.CharField()
    destination = StringListField()
    tags = serializers.DictField(child=StringListField())
    headersTruncated = serializers.BooleanField(required=False)
    headers = serializers.ListField(child=MailHeaderObjectSerializer(), required=False)
    commonHeaders = CommonHeadersSerializer(required=False)
    sourceArn = serializers.CharField(required=False)


class DeliveryObjectInNotificationSerializer(SesSerializer):
    """Serializer for DeliveryObjectInNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = DeliveryObjectInNotification

    timestamp = serializers.CharField()
    processingTimeMillis = serializers.IntegerField()
    recipients = StringListField()
    smtpResponse = serializers.CharField()
    reportingMTA = serializers.CharField()
    remoteMtaIp = serializers.CharField()


class DeliveryObjectInEventSerializer(SesSerializer):
    """Serializer for DeliveryObjectInEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = DeliveryObjectInEvent

    timestamp = serializers.CharField()
    processingTimeMillis = serializers.IntegerField()
    recipients = StringListField()
    smtpResponse = serializers.CharField()
    reportingMTA = serializers.CharField()


class ComplainedRecipientsObjectSerializer(SesSerializer):
    """Serializer for ComplainedRecipientsObject."""

    class Meta(SesSerializer.Meta):
        dataclass = ComplainedRecipientsObject

    emailAddress = serializers.CharField()


class ComplaintObjectSerializer(SesSerializer):
    """Serializer for ComplaintObject."""

    class Meta(SesSerializer.Meta):
        dataclass = ComplaintObject

    complainedRecipients = serializers.ListField(
        child=ComplainedRecipientsObjectSerializer()
    )
    timestamp = serializers.CharField()
    feedbackId = serializers.CharField()
    complaintSubType = serializers.CharField(required=False, allow_null=True)
    userAgent = serializers.CharField(required=False)
    complaintFeedbackType = EnumField(ComplaintFeedbackTypeType, required=False)
    arrivalDate = serializers.CharField(required=False)

    def to_representation(self, instance: SesObject) -> Any:
        """Handle complaintSubType=None in serialization to SES data."""
        assert isinstance(instance, ComplaintObject)
        ret = super().to_representation(instance)
        if "complaintSubType" not in ret:
            ret["complaintSubType"] = None
        return ret

    def validate_complaintSubType(self, value: Optional[str]) -> Optional[str]:
        if value is not None and value != "OnAccountSuppressionList":
            raise ValidationError('Expected null or "OnAccountSuppressionList".')
        return value


class BouncedRecipientsObjectSerializer(SesSerializer):
    """Serializer for BouncedRecipientsObject."""

    class Meta(SesSerializer.Meta):
        dataclass = BouncedRecipientsObject

    emailAddress = serializers.CharField()
    action = serializers.CharField(required=False)
    status = serializers.CharField(required=False)
    diagnosticCode = serializers.CharField(required=False)


class _BounceObjectSerializer(SesSerializer):
    """Base class for BounceObjectInEvent/NotificationSerializers."""

    def validate(self, data: dict[str, Any]):
        """Validate the Bounce Type / SubType combo."""
        bounceType = BounceTypeType(data["bounceType"])
        bounceSubType = BounceSubTypeType(data["bounceSubType"])
        if (bounceType, bounceSubType) not in ALLOWED_BOUNCE_TYPE_SUBTYPES:
            raise serializers.ValidationError(
                f'bounceType "{data["bounceType"].value}" and'
                f' bounceSubType "{data["bounceSubType"].value}"'
                " is not a valid combination."
            )
        return data


class BounceObjectInEventSerializer(_BounceObjectSerializer):
    """Serializer for BounceObjectInEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = BounceObjectInEvent

    bounceType = EnumField(BounceTypeType)
    bounceSubType = EnumField(BounceSubTypeType)
    bouncedRecipients = serializers.ListField(child=BouncedRecipientsObjectSerializer())
    timestamp = serializers.CharField()
    feedbackId = serializers.CharField()
    reportingMTA = serializers.CharField(required=False)


class BounceObjectInNotificationSerializer(_BounceObjectSerializer):
    """Serializer for BouceObjectInNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = BounceObjectInNotification

    bounceType = EnumField(BounceTypeType)
    bounceSubType = EnumField(BounceSubTypeType)
    bouncedRecipients = serializers.ListField(child=BouncedRecipientsObjectSerializer())
    timestamp = serializers.CharField()
    feedbackId = serializers.CharField()
    reportingMTA = serializers.CharField(required=False)
    remoteMtaIp = serializers.CharField(required=False)


#
# 4. Serializers for Top-level objects
#
# These are the serializers for the 4 notifications and 10 events expected as
# the content of SNS messages placed in the email queue. They use the sub-serializers
# defined in the previous section.
#


class BounceNotificationSerializer(SesSerializer):
    """Serializer for a BounceNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = BounceNotification

    notificationType = EnumField(
        SesNotificationType, expected=SesNotificationType.BOUNCE
    )
    mail = MailObjectInGenericNotificationSerializer()
    bounce = BounceObjectInNotificationSerializer()


class ComplaintNotificationSerializer(SesSerializer):
    """Serializer for a ComplaintNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = ComplaintNotification

    notificationType = EnumField(
        SesNotificationType, expected=SesNotificationType.COMPLAINT
    )
    mail = MailObjectInGenericNotificationSerializer()
    complaint = ComplaintObjectSerializer()


class DeliveryNotificationSerializer(SesSerializer):
    """Serializer for a DeliveryNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = DeliveryNotification

    notificationType = EnumField(
        SesNotificationType, expected=SesNotificationType.DELIVERY
    )
    mail = MailObjectInGenericNotificationSerializer()
    delivery = DeliveryObjectInNotificationSerializer()


class ReceivedNotificationSerializer(SesSerializer):
    """Serializer for a ReceivedNotification."""

    class Meta(SesSerializer.Meta):
        dataclass = ReceivedNotification

    notificationType = EnumField(
        SesNotificationType, expected=SesNotificationType.RECEIVED
    )
    receipt = ReceiptObjectSerializer()
    mail = MailObjectInReceivedNotificationSerializer()
    content = serializers.CharField(required=False, trim_whitespace=False)


class BounceEventSerializer(SesSerializer):
    """Serializer for a BounceEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = BounceEvent

    eventType = EnumField(SesEventType, expected=SesEventType.BOUNCE)
    mail = MailObjectInEventSerializer()
    bounce = BounceObjectInEventSerializer()


class ComplaintEventSerializer(SesSerializer):
    """Serializer for a ComplaintEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = ComplaintEvent

    eventType = EnumField(SesEventType, expected=SesEventType.COMPLAINT)
    mail = MailObjectInEventSerializer()
    complaint = ComplaintObjectSerializer()


class DeliveryEventSerializer(SesSerializer):
    """Serializer for a DeliveryEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = DeliveryEvent

    eventType = EnumField(SesEventType, expected=SesEventType.DELIVERY)
    mail = MailObjectInEventSerializer()
    delivery = DeliveryObjectInEventSerializer()


class SendEventSerializer(SesSerializer):
    """Serializer for a SendEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = SendEvent

    eventType = EnumField(SesEventType, expected=SesEventType.SEND)
    mail = MailObjectInEventSerializer()
    send = SendObjectSerializer()


class RejectEventSerializer(SesSerializer):
    """Serializer for a RejectEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = RejectEvent

    eventType = EnumField(SesEventType, expected=SesEventType.REJECT)
    mail = MailObjectInEventSerializer()
    reject = RejectObjectSerializer()


class OpenEventSerializer(SesSerializer):
    """Serializer for an OpenEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = OpenEvent
        source_to_serializer_names = {"open": "open_"}

    eventType = EnumField(SesEventType, expected=SesEventType.OPEN)
    mail = MailObjectInEventSerializer()
    open_ = OpenObjectSerializer()  # API's "open" is a Python keyword


class ClickEventSerializer(SesSerializer):
    """Serializer for a ClickEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = ClickEvent

    eventType = EnumField(SesEventType, expected=SesEventType.CLICK)
    mail = MailObjectInEventSerializer()
    click = ClickObjectSerializer()


class RenderingFailureEventSerializer(SesSerializer):
    """Serializer for a RenderingFailureEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = RenderingFailureEvent

    eventType = EnumField(SesEventType, expected=SesEventType.RENDERING_FAILURE)
    mail = MailObjectInEventSerializer()
    failure = FailureObjectSerializer()


class DeliveryDelayEventSerializer(SesSerializer):
    """Serializer for a DeliveryDelayEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = DeliveryDelayEvent

    eventType = EnumField(SesEventType, expected=SesEventType.DELIVERY_DELAY)
    mail = MailObjectInEventSerializer()
    deliveryDelay = DeliveryDelayObjectSerializer()


class SubscriptionEventSerializer(SesSerializer):
    """Serializer for a SubscriptionEvent."""

    class Meta(SesSerializer.Meta):
        dataclass = SubscriptionEvent

    eventType = EnumField(SesEventType, expected=SesEventType.SUBSCRIPTION)
    mail = MailObjectInEventSerializer()
    subscription = SubscriptionObjectSerializer()


#
# 5. Map of message types to top-level serializers
#
SES_MESSAGE_TYPE_TO_SERIALIZER: dict[SesMessageType, Type[SesSerializer]] = {
    SesNotificationType.BOUNCE: BounceNotificationSerializer,
    SesNotificationType.COMPLAINT: ComplaintNotificationSerializer,
    SesNotificationType.DELIVERY: DeliveryNotificationSerializer,
    SesNotificationType.RECEIVED: ReceivedNotificationSerializer,
    SesEventType.BOUNCE: BounceEventSerializer,
    SesEventType.COMPLAINT: ComplaintEventSerializer,
    SesEventType.DELIVERY: DeliveryEventSerializer,
    SesEventType.SEND: SendEventSerializer,
    SesEventType.REJECT: RejectEventSerializer,
    SesEventType.OPEN: OpenEventSerializer,
    SesEventType.CLICK: ClickEventSerializer,
    SesEventType.RENDERING_FAILURE: RenderingFailureEventSerializer,
    SesEventType.DELIVERY_DELAY: DeliveryDelayEventSerializer,
    SesEventType.SUBSCRIPTION: SubscriptionEventSerializer,
}
