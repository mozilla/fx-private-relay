from django.contrib.auth.models import User

from rest_framework import serializers, exceptions

from emails.models import Profile, DomainAddress, RelayAddress


class PremiumValidatorsMixin:
    # the user must be premium to set block_list_emails=True
    def validate_block_list_emails(self, value):
        if (
            self.context["request"]
            .user.profile_set.prefetch_related("user__socialaccount_set")
            .first()
            .has_premium
        ):
            return value
        raise exceptions.AuthenticationFailed(
            "Must be premium to set block_list_emails"
        )


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
        ]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email"]
        read_only_fields = ["email"]


class WebcompatIssueSerializer(serializers.Serializer):
    issue_on_domain = serializers.URLField(
        max_length=200, min_length=None, allow_blank=False
    )
    email_mask_not_accepted = serializers.BooleanField(required=False, default=False)
    add_on_visual_issue = serializers.BooleanField(required=False, default=False)
    email_not_received = serializers.BooleanField(required=False, default=False)
    other_issue = serializers.CharField(required=False, default="", allow_blank=True)
