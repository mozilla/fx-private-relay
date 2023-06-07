from django.contrib.auth.models import User
from django.db.models import prefetch_related_objects

from rest_framework import serializers, exceptions
from waffle import get_waffle_flag_model

from emails.models import DomainAddress, Profile, RelayAddress


class PremiumValidatorsMixin:
    # the user must be premium to set block_list_emails=True
    def validate_block_list_emails(self, value):
        if not value:
            return value
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


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "id",
            "server_storage",
            "store_phone_log",
            "subdomain",
            "has_premium",
            "has_phone",
            "has_vpn",
            "onboarding_state",
            "date_subscribed",
            "avatar",
            "next_email_try",
            "bounce_status",
            "api_token",
            "emails_blocked",
            "emails_forwarded",
            "emails_replied",
            "level_one_trackers_blocked",
            "remove_level_one_email_trackers",
            "total_masks",
            "at_mask_limit",
        ]
        read_only_fields = [
            "id",
            "has_premium",
            "has_phone",
            "has_vpn",
            "date_subscribed",
            "avatar",
            "next_email_try",
            "bounce_status",
            "api_token",
            "emails_blocked",
            "emails_forwarded",
            "emails_replied",
            "level_one_trackers_blocked",
            "total_masks",
            "at_mask_limit",
        ]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email"]
        read_only_fields = ["email"]


class FlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_waffle_flag_model()
        fields = [
            "id",
            "name",
            "everyone",
            "note",
        ]
        read_only_fields = [
            "id",
        ]

    def validate(self, data):
        if (data.get("name", "").lower() == "manage_flags") or (
            hasattr(self, "instance")
            and getattr(self.instance, "name", "").lower() == "manage_flags"
        ):
            raise serializers.ValidationError(
                "Changing the `manage_flags` flag is not allowed."
            )
        return super().validate(data)


class WebcompatIssueSerializer(serializers.Serializer):
    issue_on_domain = serializers.URLField(
        max_length=200, min_length=None, allow_blank=False
    )
    user_agent = serializers.CharField(required=False, default="", allow_blank=True)
    email_mask_not_accepted = serializers.BooleanField(required=False, default=False)
    add_on_visual_issue = serializers.BooleanField(required=False, default=False)
    email_not_received = serializers.BooleanField(required=False, default=False)
    other_issue = serializers.CharField(required=False, default="", allow_blank=True)
