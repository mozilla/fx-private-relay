import json
import logging
from typing import Mapping, Optional

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError

import requests
from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.socialaccount.helpers import complete_social_login
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.fxa.provider import FirefoxAccountsProvider
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework import (
    decorators,
    permissions,
    response,
    status,
    viewsets,
)
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import (
    AuthenticationFailed,
    ParseError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler
from waffle import get_waffle_flag_model
from waffle.models import Sample, Switch

from emails.models import (
    DomainAddress,
    Profile,
    RelayAddress,
)
from emails.utils import incr_if_enabled
from privaterelay.ftl_bundles import main as ftl_bundle
from privaterelay.plans import (
    get_bundle_country_language_mapping,
    get_phone_country_language_mapping,
    get_premium_country_language_mapping,
)
from privaterelay.utils import get_countries_info_from_request_and_mapping

from ..authentication import get_fxa_uid_from_oauth_token
from ..exceptions import ConflictError, RelayAPIException
from ..permissions import CanManageFlags, IsOwner
from ..serializers import (
    DomainAddressSerializer,
    FlagSerializer,
    ProfileSerializer,
    RelayAddressSerializer,
    UserSerializer,
    WebcompatIssueSerializer,
)

info_logger = logging.getLogger("eventsinfo")
FXA_PROFILE_URL = (
    f"{settings.SOCIALACCOUNT_PROVIDERS['fxa']['PROFILE_ENDPOINT']}/profile"
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
        except IntegrityError:
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


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.authentication_classes([])
def terms_accepted_user(request):
    # Setting authentication_classes to empty due to
    # authentication still happening despite permissions being set to allowany
    # https://forum.djangoproject.com/t/solved-allowany-override-does-not-work-on-apiview/9754
    authorization = get_authorization_header(request).decode()
    if not authorization or not authorization.startswith("Bearer "):
        raise ParseError("Missing Bearer header.")

    token = authorization.split(" ")[1]
    if token == "":
        raise ParseError("Missing FXA Token after 'Bearer'.")

    try:
        fxa_uid = get_fxa_uid_from_oauth_token(token, use_cache=False)
    except AuthenticationFailed as e:
        # AuthenticationFailed exception returns 403 instead of 401 because we are not
        # using the proper config that comes with the authentication_classes
        # Read more:
        # https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication
        return response.Response(
            data={"detail": e.detail.title()}, status=e.status_code
        )
    status_code = 201

    try:
        sa = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")
        status_code = 202
    except SocialAccount.DoesNotExist:
        # User does not exist, create a new Relay user
        fxa_profile_resp = requests.get(
            FXA_PROFILE_URL, headers={"Authorization": f"Bearer {token}"}
        )

        # This is not exactly the request object that FirefoxAccountsProvider
        #  expects, but it has all of the necessary attributes to initialize
        #  the Provider
        provider = FirefoxAccountsProvider(request)
        # This may not save the new user that was created
        # https://github.com/pennersr/django-allauth/blob/77368a84903d32283f07a260819893ec15df78fb/allauth/socialaccount/providers/base/provider.py#L44
        social_login = provider.sociallogin_from_response(
            request, json.loads(fxa_profile_resp.content)
        )
        # Complete social login is called by callback
        # https://github.com/pennersr/django-allauth/blob/77368a84903d32283f07a260819893ec15df78fb/allauth/socialaccount/providers/oauth/views.py#L118
        #  which is what we are mimicking to create new SocialAccount, User, and
        #  Profile for the new Relay user from Firefox
        # Since this is a Resource Provider/Server flow and are NOT a Relying
        #  Party (RP) of FXA ro social token information is stored (no Social
        #  Token object created).
        complete_social_login(request, social_login)
        # complete_social_login writes ['account_verified_email',
        #  'user_created', '_auth_user_id', '_auth_user_backend',
        #  '_auth_user_hash'] on request.session which sets the cookie because
        #  complete_social_login does the "login".
        # The user did not actually log in, logout to clear the session
        if request.user.is_authenticated:
            get_account_adapter(request).logout(request)
        sa = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")
        # Indicate profile was created from the resource flow
        profile = sa.user.profile
        profile.created_by = "firefox_resource"
        profile.save()
    info_logger.info(
        "terms_accepted_user",
        extra={"social_account": sa.uid, "status_code": status_code},
    )
    return response.Response(status=status_code)


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
                request, get_premium_country_language_mapping()
            ),
            "PHONE_PLANS": get_countries_info_from_request_and_mapping(
                request, get_phone_country_language_mapping()
            ),
            "BUNDLE_PLANS": get_countries_info_from_request_and_mapping(
                request, get_bundle_country_language_mapping()
            ),
            "BASKET_ORIGIN": settings.BASKET_ORIGIN,
            "WAFFLE_FLAGS": flag_values,
            "WAFFLE_SWITCHES": switch_values,
            "WAFFLE_SAMPLES": sample_values,
            "MAX_MINUTES_TO_VERIFY_REAL_PHONE": (
                settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE
            ),
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


@decorators.permission_classes([permissions.IsAuthenticated])
@extend_schema(methods=["POST"], request=WebcompatIssueSerializer)
@decorators.api_view(["POST"])
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

    When the error is a RelayAPIException, these additional fields may be
    present and the information will be translated if an Accept-Language header
    is added to the request:

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
