"""API views for emails"""

from logging import getLogger
from typing import Generic, TypeVar

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db.models.query import QuerySet
from django.template.loader import render_to_string

import django_ftl
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.status import (
    HTTP_201_CREATED,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
)
from rest_framework.throttling import UserRateThrottle
from rest_framework.viewsets import ModelViewSet
from waffle import flag_is_active

from emails.apps import EmailsConfig
from emails.models import DomainAddress, RelayAddress
from emails.utils import generate_from_header, ses_message_props
from emails.views import _get_address, wrap_html_email
from privaterelay.ftl_bundles import main as ftl_bundle
from privaterelay.utils import glean_logger

from ..permissions import IsOwner
from ..serializers import (
    DomainAddressSerializer,
    FirstForwardedEmailSerializer,
    RelayAddressSerializer,
)
from . import SaveToRequestUser

logger = getLogger("events")


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


_Address = TypeVar("_Address", RelayAddress, DomainAddress)


class AddressViewSet(Generic[_Address], SaveToRequestUser, ModelViewSet):
    def perform_create(self, serializer: BaseSerializer[_Address]) -> None:
        super().perform_create(serializer)
        assert serializer.instance
        glean_logger().log_email_mask_created(
            request=self.request,
            mask=serializer.instance,
            created_by_api=True,
        )

    def perform_update(self, serializer: BaseSerializer[_Address]) -> None:
        assert serializer.instance is not None
        old_description = serializer.instance.description
        super().perform_update(serializer)
        new_description = serializer.instance.description
        if old_description != new_description:
            glean_logger().log_email_mask_label_updated(
                request=self.request, mask=serializer.instance
            )

    def perform_destroy(self, instance: _Address) -> None:
        user = instance.user
        is_random_mask = isinstance(instance, RelayAddress)
        super().perform_destroy(instance)
        glean_logger().log_email_mask_deleted(
            request=self.request,
            user=user,
            is_random_mask=is_random_mask,
        )


class RelayAddressViewSet(AddressViewSet[RelayAddress]):
    serializer_class = RelayAddressSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_class = RelayAddressFilter

    def get_queryset(self) -> QuerySet[RelayAddress]:
        if isinstance(self.request.user, User):
            return RelayAddress.objects.filter(user=self.request.user)
        return RelayAddress.objects.none()


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


class DomainAddressViewSet(AddressViewSet[DomainAddress]):
    serializer_class = DomainAddressSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_class = DomainAddressFilter

    def get_queryset(self) -> QuerySet[DomainAddress]:
        if isinstance(self.request.user, User):
            return DomainAddress.objects.filter(user=self.request.user)
        return DomainAddress.objects.none()


class FirstForwardedEmailRateThrottle(UserRateThrottle):
    rate = settings.FIRST_EMAIL_RATE_LIMIT


@permission_classes([IsAuthenticated])
@extend_schema(methods=["POST"], request=FirstForwardedEmailSerializer)
@api_view(["POST"])
@throttle_classes([FirstForwardedEmailRateThrottle])
def first_forwarded_email(request):
    """
    Requires `free_user_onboarding` flag to be active for the user.

    Send the `first_forwarded_email.html` email to the user via a mask.
    See [/emails/first_forwarded_email](/emails/first_forwarded_email).

    Note: `mask` value must be a `RelayAddress` that belongs to the authenticated user.
    A `DomainAddress` will not work.
    """
    if not flag_is_active(request, "free_user_onboarding"):
        # Return Permission Denied error
        return Response(
            {"detail": "Requires free_user_onboarding waffle flag."}, status=403
        )

    serializer = FirstForwardedEmailSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    mask = str(serializer.data.get("mask"))
    user = request.user
    try:
        address = _get_address(mask)
        RelayAddress.objects.get(user=user, address=address)
    except ObjectDoesNotExist:
        return Response(f"{mask} does not exist for user.", status=HTTP_404_NOT_FOUND)
    profile = user.profile
    app_config = apps.get_app_config("emails")
    assert isinstance(app_config, EmailsConfig)
    ses_client = app_config.ses_client
    assert ses_client
    assert settings.RELAY_FROM_ADDRESS
    with django_ftl.override(profile.language):
        translated_subject = ftl_bundle.format("forwarded-email-hero-header")
    first_forwarded_email_html = render_to_string(
        "emails/first_forwarded_email.html",
        {
            "SITE_ORIGIN": settings.SITE_ORIGIN,
        },
    )
    from_address = generate_from_header(settings.RELAY_FROM_ADDRESS, mask)
    wrapped_email = wrap_html_email(
        first_forwarded_email_html,
        profile.language,
        profile.has_premium,
        from_address,
        0,
    )
    ses_client.send_email(
        Destination={
            "ToAddresses": [user.email],
        },
        Source=from_address,
        Message={
            "Subject": ses_message_props(translated_subject),
            "Body": {
                "Html": ses_message_props(wrapped_email),
            },
        },
    )
    logger.info(f"Sent first_forwarded_email to user ID: {user.id}")
    return Response(status=HTTP_201_CREATED)
