from rest_framework import serializers

from emails.models import Profile, DomainAddress, RelayAddress
from django.contrib.auth.models import User


class RelayAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelayAddress
        fields = [
            'enabled', 'description', 'generated_for',
            # read-only
            'id', 'address', 'domain', 'full_address',
            'created_at', 'last_modified_at','last_used_at',
            'num_forwarded', 'num_blocked', 'num_spam'
        ]
        read_only_fields = [
            'id', 'address', 'domain', 'full_address',
            'created_at', 'last_modified_at','last_used_at',
            'num_forwarded', 'num_blocked', 'num_spam'
        ]


class DomainAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = DomainAddress
        fields = [
            'enabled', 'description',
            # read-only
            'id', 'address', 'domain', 'full_address',
            'created_at', 'last_modified_at','last_used_at',
            'num_forwarded', 'num_blocked', 'num_spam'
        ]
        read_only_fields = [
            'id', 'address', 'domain', 'full_address',
            'created_at', 'last_modified_at','last_used_at',
            'num_forwarded', 'num_blocked', 'num_spam'
        ]


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'server_storage', 'subdomain', 'has_premium', 'onboarding_state', 'date_subscribed']
        read_only_fields = ['id', 'subdomain', 'has_premium', 'date_subscribed']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email']
        read_only_fields = ['email']
