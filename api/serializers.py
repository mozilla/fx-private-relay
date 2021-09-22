from rest_framework import serializers

from emails.models import Profile, DomainAddress, RelayAddress


class RelayAddressSerializer(
    serializers.HyperlinkedModelSerializer
):
    class Meta:
        model = RelayAddress
        fields = ['id', 'address', 'domain', 'enabled', 'description',
                  'created_at', 'last_modified_at', 'last_used_at',
                  'num_forwarded', 'num_blocked', 'num_spam',
                  'generated_for']


class DomainAddressSerializer(
    serializers.HyperlinkedModelSerializer
):
    class Meta:
        model = DomainAddress
        fields = ['id', 'address', 'enabled', 'description',
                  'created_at', 'last_modified_at', 'last_used_at',
                  'num_forwarded', 'num_blocked', 'num_spam']


class ProfileSerializer(
    serializers.HyperlinkedModelSerializer
):
    class Meta:
        model = Profile
        fields = ['id', 'subdomain', 'server_storage']
