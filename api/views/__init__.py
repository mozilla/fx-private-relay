from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError

from django_filters import rest_framework as filters
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from waffle import get_waffle_flag_model
from waffle.models import Switch, Sample
from rest_framework import (
    decorators,
    permissions,
    response,
    viewsets,
    exceptions,
)

from privaterelay.settings import (
    BASKET_ORIGIN,
    FXA_BASE_ORIGIN,
    GOOGLE_ANALYTICS_ID,
    PREMIUM_PROD_ID,
    PHONE_PROD_ID,
)
from privaterelay.utils import get_premium_countries_info_from_request

from emails.models import (
    CannotMakeAddressException,
    DomainAddress,
    Profile,
    RelayAddress,
)


from ..exceptions import ConflictError
from ..permissions import IsOwner
from ..serializers import (
    DomainAddressSerializer,
    ProfileSerializer,
    RelayAddressSerializer,
    UserSerializer,
)


schema_view = get_schema_view(
    openapi.Info(
        title="Relay API",
        default_version="v1",
        description="API endpoints for Relay back-end",
        contact=openapi.Contact(email="lcrouch+relayapi@mozilla.com"),
    ),
    public=settings.DEBUG,
    permission_classes=[permissions.AllowAny],
)


class SaveToRequestUser:
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RelayAddressFilter(filters.FilterSet):
    used_on = filters.CharFilter(field_name="used_on", lookup_expr="icontains")

    class Meta:
        model = RelayAddress
        fields = [
            "enabled",
            "description",
            "generated_for",
            "block_list_emails",
            "used_on",
            # read-only
            "id",
            "address",
            "domain",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_spam",
        ]


class RelayAddressViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    serializer_class = RelayAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filterset_class = RelayAddressFilter

    def get_queryset(self):
        return RelayAddress.objects.filter(user=self.request.user)


class DomainAddressFilter(filters.FilterSet):
    used_on = filters.CharFilter(field_name="used_on", lookup_expr="icontains")

    class Meta:
        model = DomainAddress
        fields = [
            "enabled",
            "description",
            "block_list_emails",
            "used_on",
            # read-only
            "id",
            "address",
            "domain",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_spam",
        ]


class DomainAddressViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    serializer_class = DomainAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filterset_class = DomainAddressFilter

    def get_queryset(self):
        return DomainAddress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        try:
            serializer.save(user=self.request.user)
        except CannotMakeAddressException as e:
            raise exceptions.PermissionDenied(e.message)
        except IntegrityError as e:
            domain_address = DomainAddress.objects.filter(
                user=self.request.user, address=serializer.validated_data.get("address")
            ).first()
            raise ConflictError(
                {"id": domain_address.id, "full_address": domain_address.full_address}
            )


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    http_method_names = ["get", "post", "head", "put", "patch"]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    http_method_names = ["get", "head"]

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


# Deprecated; prefer runtime_data instead.
# (This method isn't deleted yet, because the add-on still calls it.)
@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
def premium_countries(request):
    return response.Response(get_premium_countries_info_from_request(request))


@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
def runtime_data(request):
    flags = get_waffle_flag_model().get_all()
    flag_values = [(f.name, f.is_active(request)) for f in flags]
    switches = Switch.get_all()
    switch_values = [(s.name, s.is_active()) for s in switches]
    samples = Sample.get_all()
    sample_values = [(s.name, s.is_active()) for s in samples]
    return response.Response(
        {
            "FXA_ORIGIN": FXA_BASE_ORIGIN,
            "GOOGLE_ANALYTICS_ID": GOOGLE_ANALYTICS_ID,
            "PREMIUM_PRODUCT_ID": PREMIUM_PROD_ID,
            "PHONE_PRODUCT_ID": PHONE_PROD_ID,
            "PREMIUM_PLANS": get_premium_countries_info_from_request(request),
            "BASKET_ORIGIN": BASKET_ORIGIN,
            "WAFFLE_FLAGS": flag_values,
            "WAFFLE_SWITCHES": switch_values,
            "WAFFLE_SAMPLES": sample_values,
        }
    )
