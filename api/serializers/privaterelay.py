"""API serializers for api/views/privaterelay.py"""

from django.contrib.auth.models import User

from rest_framework import serializers

from privaterelay.models import Profile

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
            "has_megabundle",
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
            "has_megabundle",
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


class WebcompatIssueSerializer(serializers.Serializer):
    issue_on_domain = serializers.URLField(
        max_length=200, min_length=None, allow_blank=False
    )
    user_agent = serializers.CharField(required=False, default="", allow_blank=True)
    email_mask_not_accepted = serializers.BooleanField(required=False, default=False)
    add_on_visual_issue = serializers.BooleanField(required=False, default=False)
    email_not_received = serializers.BooleanField(required=False, default=False)
    other_issue = serializers.CharField(required=False, default="", allow_blank=True)
