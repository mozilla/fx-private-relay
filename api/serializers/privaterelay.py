"""API serializers for api/views/privaterelay.py"""

from django.contrib.auth.models import User

from rest_framework import serializers
from waffle import get_waffle_flag_model

from emails.models import Profile

from . import StrictReadOnlyFieldsMixin


class ProfileSerializer(StrictReadOnlyFieldsMixin, serializers.ModelSerializer):
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
            "onboarding_free_state",
            "date_phone_registered",
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
            "metrics_enabled",
        ]
        read_only_fields = [
            "id",
            "subdomain",
            "has_premium",
            "has_phone",
            "has_vpn",
            "date_phone_registered",
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
            "metrics_enabled",
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

    def validate_everyone(self, value):
        """
        Turn False into None. This disables the flag for most, but allows users
        and groups to still have the flag. Setting the flag to False would also
        disable the flag for those users.
        """
        if value:
            return True
        return None

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
