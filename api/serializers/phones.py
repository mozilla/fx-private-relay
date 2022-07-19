from rest_framework import serializers

from phones.models import RealPhone, RelayNumber


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
            "number",
            "location",
        ]
        read_only_fields = [
            "location",
        ]
