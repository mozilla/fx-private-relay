from rest_framework import serializers

from phones.models import InboundContact, RealPhone, RelayNumber


class RealPhoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = RealPhone
        fields = [
            "id",
            "number",
            "verification_code",
            "verification_sent_date",
            "verified",
            "verified_date",
            "country_code",
        ]
        read_only_fields = [
            "id",
            "verification_sent_date",
            "verified",
            "verified_date",
            "country_code",
        ]
        extra_kwargs = {
            "verification_code": {"write_only": True},
        }


class RelayNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelayNumber
        fields = [
            "id",
            "number",
            "location",
            "country_code",
            "enabled",
            "remaining_minutes",
            "remaining_texts",
            "calls_forwarded",
            "calls_blocked",
            "texts_forwarded",
            "texts_blocked",
            "calls_and_texts_forwarded",
            "calls_and_texts_blocked",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "location",
            "country_code",
            "remaining_minutes",
            "remaining_texts",
            "calls_forwarded",
            "calls_blocked",
            "texts_forwarded",
            "texts_blocked",
            "calls_and_texts_forwarded",
            "calls_and_texts_blocked",
            "created_at",
        ]


class InboundContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = InboundContact
        fields = [
            "id",
            "relay_number",
            "inbound_number",
            "last_inbound_date",
            "last_inbound_type",
            "num_calls",
            "num_calls_blocked",
            "last_call_date",
            "num_texts",
            "num_texts_blocked",
            "last_text_date",
            "blocked",
        ]
        read_only_fields = [
            "id",
            "relay_number",
            "inbound_number",
            "last_inbound_date",
            "last_inbound_type",
            "num_calls",
            "num_calls_blocked",
            "last_call_date",
            "num_texts",
            "num_texts_blocked",
            "last_text_date",
        ]


class InboundSmsSerializer(serializers.Serializer):
    text = serializers.CharField()
    from_ = serializers.CharField()
    to = serializers.CharField()

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        # Change to reserved keyword "from"
        self.fields["from"] = self.fields.pop("from_")


class InboundCallSerializer(serializers.Serializer):
    Caller = serializers.CharField()
    Called = serializers.CharField()


class TwilioMessagesSerializer(serializers.Serializer):
    from_ = serializers.CharField()
    to = serializers.CharField()
    date_sent = serializers.CharField()
    body = serializers.CharField()

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        # Change to reserved keyword "from"
        self.fields["from"] = self.fields.pop("from_")


class TwilioSmsStatusSerializer(serializers.Serializer):
    SmsStatus = serializers.CharField()
    MessageSid = serializers.CharField()


class OutboundSmsSerializer(serializers.Serializer):
    body = serializers.CharField()
    destination = serializers.CharField()


class OutboundCallSerializer(serializers.Serializer):
    to = serializers.CharField()
