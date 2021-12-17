from django.conf import settings
from django.contrib.auth.models import User

from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import decorators, permissions, response, viewsets

from emails.models import DomainAddress, Profile, RelayAddress
from privaterelay.utils import get_premium_countries_info_from_request

from .permissions import IsOwner
from .serializers import (
    DomainAddressSerializer, ProfileSerializer, RelayAddressSerializer, UserSerializer
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


class SaveToRequestUser:
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RelayAddressViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    serializer_class = RelayAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return RelayAddress.objects.filter(user=self.request.user)


class DomainAddressViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    serializer_class = DomainAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return DomainAddress.objects.filter(user=self.request.user)


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    http_method_names = ['get', 'post', 'head', 'put', 'patch']

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)

@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
def premium_countries(request):
    return response.Response(
        get_premium_countries_info_from_request(request)
    )
