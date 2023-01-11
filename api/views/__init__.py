import logging
from typing import Mapping, Optional

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError

from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler
from rest_framework.serializers import ValidationError

from django_filters import rest_framework as filters
from drf_yasg.utils import swagger_auto_schema
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from waffle import get_waffle_flag_model
from waffle.models import Switch, Sample
from rest_framework import (
    decorators,
    permissions,
    response,
    status,
    viewsets,
    exceptions,
)
from emails.utils import incr_if_enabled

from privaterelay.utils import (
    get_countries_info_from_request_and_mapping,
)

from emails.models import (
    CannotMakeAddressException,
    DomainAddress,
    Profile,
    RelayAddress,
)


from ..exceptions import ConflictError, RelayAPIException
from ..permissions import IsOwner, CanManageFlags
from ..serializers import (
    DomainAddressSerializer,
    ProfileSerializer,
    RelayAddressSerializer,
    UserSerializer,
    FlagSerializer,
    WebcompatIssueSerializer,
)

from privaterelay.ftl_bundles import main as ftl_bundle

info_logger = logging.getLogger("eventsinfo")
schema_view = get_schema_view(
    openapi.Info(
        title="Relay API",
        default_version="v1",
        description="API endpints for Relay back-end",
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
            "FXA_ORIGIN": settings.FXA_BASE_ORIGIN,
            "PERIODICAL_PREMIUM_PRODUCT_ID": settings.PERIODICAL_PREMIUM_PROD_ID,
            "GOOGLE_ANALYTICS_ID": settings.GOOGLE_ANALYTICS_ID,
            "BUNDLE_PRODUCT_ID": settings.BUNDLE_PROD_ID,
            "PHONE_PRODUCT_ID": settings.PHONE_PROD_ID,
            "PERIODICAL_PREMIUM_PLANS": get_countries_info_from_request_and_mapping(
                request, settings.PERIODICAL_PREMIUM_PLAN_COUNTRY_LANG_MAPPING
            ),
            "PHONE_PLANS": get_countries_info_from_request_and_mapping(
                request, settings.PHONE_PLAN_COUNTRY_LANG_MAPPING
            ),
            "BUNDLE_PLANS": get_countries_info_from_request_and_mapping(
                request, settings.BUNDLE_PLAN_COUNTRY_LANG_MAPPING
            ),
            "BASKET_ORIGIN": settings.BASKET_ORIGIN,
            "WAFFLE_FLAGS": flag_values,
            "WAFFLE_SWITCHES": switch_values,
            "WAFFLE_SAMPLES": sample_values,
            "MAX_MINUTES_TO_VERIFY_REAL_PHONE": settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE,
        }
    )


class FlagFilter(filters.FilterSet):
    class Meta:
        model = get_waffle_flag_model()
        fields = [
            "name",
            "everyone",
            # "users",
            # read-only
            "id",
        ]


class FlagViewSet(viewsets.ModelViewSet):
    serializer_class = FlagSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageFlags]
    filterset_class = FlagFilter
    http_method_names = ["get", "post", "head", "patch"]

    def get_queryset(self):
        flags = get_waffle_flag_model().objects
        return flags


@swagger_auto_schema(methods=["post"], request_body=WebcompatIssueSerializer)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.IsAuthenticated])
def report_webcompat_issue(request):
    serializer = WebcompatIssueSerializer(data=request.data)
    if serializer.is_valid():
        info_logger.info("webcompat_issue", extra=serializer.data)
        incr_if_enabled("webcompat_issue", 1)
        for k, v in serializer.data.items():
            if v and k != "issue_on_domain":
                incr_if_enabled(f"webcompat_issue_{k}", 1)
        return response.Response(status=status.HTTP_201_CREATED)
    return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def relay_exception_handler(exc: Exception, context: Mapping) -> Optional[Response]:
    """
    Add error information to response data.

    When the error is a RelayAPIException, these additional fields may be present and
    the information will be translated if an Accept-Language header is added to the request:

    error_code - A string identifying the error, for client-side translation
    error_context - Additional data needed for client-side translation
    """

    response = exception_handler(exc, context)

    if response and isinstance(exc, RelayAPIException):
        error_codes = exc.get_codes()
        error_context = exc.error_context()
        if isinstance(error_codes, str):
            response.data["error_code"] = error_codes

            # Build Fluent error ID
            ftl_id_sub = "api-error-"
            ftl_id_error = error_codes.replace("_", "-")
            ftl_id = ftl_id_sub + ftl_id_error

            # Replace default message with Fluent string
            response.data["detail"] = ftl_bundle.format(ftl_id, error_context)

        if error_context:
            response.data["error_context"] = error_context

        response.data["error_code"] = error_codes

    return response
