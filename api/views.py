from django.conf import settings

from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions, viewsets

from emails.models import (
    CannotMakeSubdomainException, DomainAddress, Profile, RelayAddress
)

from .permissions import IsOwner
from .serializers import (
    DomainAddressSerializer, ProfileSerializer, RelayAddressSerializer
)


schema_view = get_schema_view(
    openapi.Info(
        title='Relay API',
        default_version='v1',
        description='API endpints for Relay back-end',
        contact=openapi.Contact(email='lcrouch+relayapi@mozilla.com'),
    ),
    public=settings.DEBUG,
    permission_classes=[permissions.AllowAny],
)


class RelayAddressViewSet(viewsets.ModelViewSet):
    serializer_class = RelayAddressSerializer
    permissions_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return RelayAddress.objects.filter(user=self.request.user)


class DomainAddressViewSet(viewsets.ModelViewSet):
    serializer_class = DomainAddressSerializer
    permissions_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return DomainAddress.objects.filter(user=self.request.user)


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permissions_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

    def update(self, request, pk=None, *args, **kwargs):
        profile = request.user.profile_set.first()
        if not profile.has_unlimited:
            raise CannotMakeSubdomainException('error-premium-check-subdomain')
        subdomain = request.data.get('subdomain', None)
        available = Profile.subdomain_available(subdomain)
        if not available:
            raise CannotMakeSubdomainException('error-subdomain-not-available')
        return super().update(request, pk, *args, **kwargs)
