"""API serializers for api/views/emails.py"""

from django.db.models import prefetch_related_objects

from rest_framework import exceptions, serializers

from emails.models import DomainAddress, RelayAddress


class PremiumValidatorsMixin:
    # the user must be premium to set block_list_emails=True
    def validate_block_list_emails(self, value):
        if not value:
            return value
        assert hasattr(self, "context")
        user = self.context["request"].user
        prefetch_related_objects([user], "socialaccount_set", "profile")
        if not user.profile.has_premium:
            raise exceptions.AuthenticationFailed(
                "Must be premium to set block_list_emails."
            )
        return value


class RelayAddressSerializer(PremiumValidatorsMixin, serializers.ModelSerializer):
    mask_type = serializers.CharField(default="random", read_only=True, required=False)

    class Meta:
        model = RelayAddress
        fields = [
            "mask_type",
            "enabled",
            "description",
            "generated_for",
            "block_list_emails",
            "used_on",
            # read-only
            "id",
            "address",
            "domain",
            "full_address",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_level_one_trackers_blocked",
            "num_replied",
            "num_spam",
        ]
        read_only_fields = [
            "id",
            "mask_type",
            "address",
            "domain",
            "full_address",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_level_one_trackers_blocked",
            "num_replied",
            "num_spam",
        ]


class DomainAddressSerializer(PremiumValidatorsMixin, serializers.ModelSerializer):
    mask_type = serializers.CharField(default="custom", read_only=True, required=False)

    class Meta:
        model = DomainAddress
        fields = [
            "mask_type",
            "enabled",
            "description",
            "block_list_emails",
            "used_on",
            # read-only
            "id",
            "address",
            "domain",
            "full_address",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_level_one_trackers_blocked",
            "num_replied",
            "num_spam",
        ]
        read_only_fields = [
            "id",
            "mask_type",
            "domain",
            "full_address",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_level_one_trackers_blocked",
            "num_replied",
            "num_spam",
        ]


class FirstForwardedEmailSerializer(serializers.Serializer):
    mask = serializers.EmailField(required=True)
