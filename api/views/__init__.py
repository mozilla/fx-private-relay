"""
API views for emails and accounts

TODO: Move these functions to mirror the Django apps

Email stuff should be in api/views/emails.py
Runtime data should be in api/views/privaterelay.py
Profile stuff is strange - model is in emails, but probably should be in privaterelay.
"""

import logging
from django.core.exceptions import ObjectDoesNotExist
from django.core.cache import cache
from django.template.loader import render_to_string
from django.urls.exceptions import NoReverseMatch
import requests
from typing import Any, Optional

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError

import django_ftl
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import (
    AuthenticationFailed,
    ParseError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.helpers import complete_social_login
from allauth.socialaccount.providers.fxa.provider import FirefoxAccountsProvider
from django_filters import rest_framework as filters
from waffle import flag_is_active, get_waffle_flag_model
from waffle.models import Switch, Sample
from rest_framework import (
    decorators,
    permissions,
    response,
    status,
    throttling,
    viewsets,
)
from emails.apps import EmailsConfig
from emails.utils import generate_from_header, incr_if_enabled, ses_message_props
from emails.views import wrap_html_email, _get_address

from privaterelay.plans import (
    get_bundle_country_language_mapping,
    get_premium_country_language_mapping,
    get_phone_country_language_mapping,
)
from privaterelay.utils import get_countries_info_from_request_and_mapping

from emails.models import (
    DomainAddress,
    Profile,
    RelayAddress,
)

from ..authentication import get_fxa_uid_from_oauth_token
from ..exceptions import ConflictError, RelayAPIException
from ..permissions import IsOwner, CanManageFlags
from ..serializers import (
    DomainAddressSerializer,
    FirstForwardedEmailSerializer,
    ProfileSerializer,
    RelayAddressSerializer,
    UserSerializer,
    FlagSerializer,
    WebcompatIssueSerializer,
)

from privaterelay.ftl_bundles import main as ftl_bundle

logger = logging.getLogger("events")
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


@extend_schema(
    responses={
        201: OpenApiResponse(description="Created; returned when user is created."),
        202: OpenApiResponse(
            description="Accepted; returned when user already exists."
        ),
        400: OpenApiResponse(
            description="Bad request; returned when request is missing Authorization: Bearer header or token value."
        ),
        401: OpenApiResponse(
            description="Unauthorized; returned when the FXA token is invalid or expired."
        ),
    },
)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.authentication_classes([])
def terms_accepted_user(request):
    """
    Create a Relay user from an FXA token.

    See [API Auth doc][api-auth-doc] for details.

    [api-auth-doc]: https://github.com/mozilla/fx-private-relay/blob/main/docs/api_auth.md#firefox-oauth-token-authentication-and-accept-terms-of-service
    """
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
        # Read more: https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication
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
        if not (fxa_profile_resp.ok and fxa_profile_resp.content):
            logger.error(
                "terms_accepted_user: bad account profile response",
                extra={
                    "status_code": fxa_profile_resp.status_code,
                    "content": fxa_profile_resp.content,
                },
            )
            return response.Response(
                data={"detail": "Did not receive a 200 response for account profile."},
                status=500,
            )

        # this is not exactly the request object that FirefoxAccountsProvider expects, but
        # it has all of the necssary attributes to initiatlize the Provider
        provider = FirefoxAccountsProvider(request)
        # This may not save the new user that was created
        # https://github.com/pennersr/django-allauth/blob/77368a84903d32283f07a260819893ec15df78fb/allauth/socialaccount/providers/base/provider.py#L44
        social_login = provider.sociallogin_from_response(
            request, fxa_profile_resp.json()
        )
        # Complete social login is called by callback
        # (see https://github.com/pennersr/django-allauth/blob/77368a84903d32283f07a260819893ec15df78fb/allauth/socialaccount/providers/oauth/views.py#L118)
        # which is what we are mimicking to
        # create new SocialAccount, User, and Profile for the new Relay user from Firefox
        # Since this is a Resource Provider/Server flow and are NOT a Relying Party (RP) of FXA
        # No social token information is stored (no Social Token object created).
        try:
            complete_social_login(request, social_login)
            # complete_social_login writes ['account_verified_email', 'user_created', '_auth_user_id', '_auth_user_backend', '_auth_user_hash']
            # on request.session which sets the cookie because complete_social_login does the "login"
            # The user did not actually log in, logout to clear the session
            if request.user.is_authenticated:
                get_account_adapter(request).logout(request)
        except NoReverseMatch as e:
            # TODO: use this logging to fix the underlying issue
            # https://mozilla-hub.atlassian.net/browse/MPP-3473
            if "socialaccount_signup" in e.args[0]:
                logger.error(
                    "socialaccount_signup_error",
                    extra={
                        "exception": str(e),
                        "fxa_uid": fxa_uid,
                        "social_login_state": social_login.state,
                    },
                )
                return response.Response(status=500)
            raise e
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


class FirstForwardedEmailRateThrottle(throttling.UserRateThrottle):
    rate = settings.FIRST_EMAIL_RATE_LIMIT


@decorators.permission_classes([permissions.IsAuthenticated])
@extend_schema(methods=["POST"], request=FirstForwardedEmailSerializer)
@decorators.api_view(["POST"])
@decorators.throttle_classes([FirstForwardedEmailRateThrottle])
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
        return response.Response(
            {"detail": "Requires free_user_onboarding waffle flag."}, status=403
        )

    serializer = FirstForwardedEmailSerializer(data=request.data)
    if not serializer.is_valid():
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    mask = serializer.data.get("mask")
    user = request.user
    try:
        address = _get_address(mask)
        RelayAddress.objects.get(user=user, address=address)
    except ObjectDoesNotExist:
        return response.Response(
            f"{mask} does not exist for user.", status=status.HTTP_404_NOT_FOUND
        )
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
    return response.Response(status=status.HTTP_201_CREATED)


def relay_exception_handler(
    exc: Exception, context: dict[str, Any]
) -> Optional[Response]:
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


@decorators.permission_classes([permissions.IsAuthenticated])
@decorators.api_view(["GET"])
def potential_otp_code_detected(request):
    otp_data = cache.get(f"{request.user.id}_otp_code")  # Expires after 120 seconds

    if otp_data:
        potential_code = otp_data["otp_code"]
        mask = otp_data["mask"]
        cache.delete(
            f"{request.user.id}_otp_code"
        )  # Deleting to avoid duplicate notifications when polling
        return response.Response(
            data={"potential_otp_code": potential_code, "mask": mask},
            status=status.HTTP_200_OK,
        )

    return response.Response(
        data={"detail": "No data was found"}, status=status.HTTP_404_NOT_FOUND
    )
