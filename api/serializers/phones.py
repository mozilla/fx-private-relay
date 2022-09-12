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
        ]
        read_only_fields = [
            "id",
            "verification_sent_date",
            "verified",
            "verified_date",
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
            "enabled",
        ]
        read_only_fields = [
            "id",
            "location",
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
            "num_texts",
            "num_texts_blocked",
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
            "num_texts",
            "num_texts_blocked",
        ]
