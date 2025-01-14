from logging import getLogger
from typing import Any, Literal

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db.models.query import QuerySet
from django.urls.exceptions import NoReverseMatch

import requests
from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.socialaccount.adapter import get_adapter as get_social_adapter
from allauth.socialaccount.helpers import complete_social_login
from allauth.socialaccount.models import SocialAccount
from codetiming import Timer
from django_filters.rest_framework import FilterSet
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiRequest,
    OpenApiResponse,
    extend_schema,
)
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.viewsets import ModelViewSet
from waffle import get_waffle_flag_model
from waffle.models import Sample, Switch

from emails.utils import incr_if_enabled
from privaterelay.models import Profile
from privaterelay.plans import (
    get_bundle_country_language_mapping,
    get_phone_country_language_mapping,
    get_premium_country_language_mapping,
)
from privaterelay.utils import get_countries_info_from_request_and_mapping

from ..authentication import FxaTokenAuthentication, IntrospectionResponse
from ..permissions import CanManageFlags, HasValidFxaToken, IsActive, IsNewUser, IsOwner
from ..serializers.privaterelay import (
    FlagSerializer,
    ProfileSerializer,
    UserSerializer,
    WebcompatIssueSerializer,
)

logger = getLogger("events")
info_logger = getLogger("eventsinfo")
FXA_PROFILE_URL = (
    f"{settings.SOCIALACCOUNT_PROVIDERS['fxa']['PROFILE_ENDPOINT']}/profile"
)


class FlagFilter(FilterSet):
    class Meta:
        model = get_waffle_flag_model()
        fields = [
            "name",
            "everyone",
            # "users",
            # read-only
            "id",
        ]


@extend_schema(tags=["privaterelay"])
class FlagViewSet(ModelViewSet):
    """Feature flags."""

    serializer_class = FlagSerializer
    permission_classes = [IsAuthenticated, CanManageFlags]
    filterset_class = FlagFilter
    http_method_names = ["get", "post", "head", "patch"]

    def get_queryset(self):
        flags = get_waffle_flag_model().objects
        return flags


@extend_schema(tags=["privaterelay"])
class ProfileViewSet(ModelViewSet):
    """Relay user extended profile data."""

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    http_method_names = ["get", "post", "head", "put", "patch"]

    def get_queryset(self) -> QuerySet[Profile]:
        if isinstance(self.request.user, User):
            return Profile.objects.filter(user=self.request.user)
        return Profile.objects.none()


@extend_schema(tags=["privaterelay"])
class UserViewSet(ModelViewSet):
    """Relay user data stored in Django user model."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    http_method_names = ["get", "head"]

    def get_queryset(self) -> QuerySet[User]:
        if isinstance(self.request.user, User):
            return User.objects.filter(id=self.request.user.id)
        return User.objects.none()


@permission_classes([IsAuthenticated])
@extend_schema(
    tags=["privaterelay"],
    request=WebcompatIssueSerializer,
    examples=[
        OpenApiExample(
            "mask not accepted",
            {
                "issue_on_domain": "https://accounts.firefox.com",
                "user_agent": "Firefox",
                "email_mask_not_accepted": True,
                "add_on_visual_issue": False,
                "email_not_received": False,
                "other_issue": "",
            },
        )
    ],
    responses={
        "201": OpenApiResponse(description="Report was submitted"),
        "400": OpenApiResponse(description="Report was rejected due to errors."),
        "401": OpenApiResponse(description="Authentication required."),
    },
)
@api_view(["POST"])
def report_webcompat_issue(request):
    """Report a Relay issue from an extension or integration."""

    serializer = WebcompatIssueSerializer(data=request.data)
    if serializer.is_valid():
        info_logger.info("webcompat_issue", extra=serializer.data)
        incr_if_enabled("webcompat_issue", 1)
        for k, v in serializer.data.items():
            if v and k != "issue_on_domain":
                incr_if_enabled(f"webcompat_issue_{k}", 1)
        return Response(status=HTTP_201_CREATED)
    return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


def _get_example_plan(plan: Literal["premium", "phones", "bundle"]) -> dict[str, Any]:
    prices = {
        "premium": {"monthly": 1.99, "yearly": 0.99},
        "phones": {"monthly": 4.99, "yearly": 4.99},
        "bundle": {"monthly": 6.99, "yearly": 6.99},
    }
    monthly_price = {
        "id": f"price_{plan.title()}Monthlyxxxx",
        "currency": "usd",
        "price": prices[plan]["monthly"],
    }
    yearly_price = {
        "id": f"price_{plan.title()}Yearlyxxxx",
        "currency": "usd",
        "price": prices[plan]["yearly"],
    }
    return {
        "country_code": "US",
        "countries": ["CA", "US"],
        "available_in_country": True,
        "plan_country_lang_mapping": {
            "CA": {
                "*": {
                    "monthly": monthly_price,
                    "yearly": yearly_price,
                }
            },
            "US": {
                "*": {
                    "monthly": monthly_price,
                    "yearly": yearly_price,
                }
            },
        },
    }


@extend_schema(
    tags=["privaterelay"],
    responses={
        "200": OpenApiResponse(
            {"type": "object"},
            description="Site parameters",
            examples=[
                OpenApiExample(
                    "relay.firefox.com (partial)",
                    {
                        "FXA_ORIGIN": "https://accounts.firefox.com",
                        "PERIODICAL_PREMIUM_PRODUCT_ID": "prod_XXXXXXXXXXXXXX",
                        "GOOGLE_ANALYTICS_ID": "UA-########-##",
                        "GA4_MEASUREMENT_ID": "G-XXXXXXXXX",
                        "BUNDLE_PRODUCT_ID": "prod_XXXXXXXXXXXXXX",
                        "PHONE_PRODUCT_ID": "prod_XXXXXXXXXXXXXX",
                        "PERIODICAL_PREMIUM_PLANS": _get_example_plan("premium"),
                        "PHONE_PLANS": _get_example_plan("phones"),
                        "BUNDLE_PLANS": _get_example_plan("bundle"),
                        "BASKET_ORIGIN": "https://basket.mozilla.org",
                        "WAFFLE_FLAGS": [
                            ["foxfood", False],
                            ["phones", True],
                            ["bundle", True],
                        ],
                        "WAFFLE_SWITCHES": [],
                        "WAFFLE_SAMPLES": [],
                        "MAX_MINUTES_TO_VERIFY_REAL_PHONE": 5,
                    },
                )
            ],
        )
    },
)
@api_view()
@permission_classes([AllowAny])
def runtime_data(request):
    """Get data needed to present the Relay dashboard to a vistor or user."""
    flags = get_waffle_flag_model().get_all()
    flag_values = [(f.name, f.is_active(request)) for f in flags]
    switches = Switch.get_all()
    switch_values = [(s.name, s.is_active()) for s in switches]
    samples = Sample.get_all()
    sample_values = [(s.name, s.is_active()) for s in samples]
    return Response(
        {
            "FXA_ORIGIN": settings.FXA_BASE_ORIGIN,
            "PERIODICAL_PREMIUM_PRODUCT_ID": settings.PERIODICAL_PREMIUM_PROD_ID,
            "GOOGLE_ANALYTICS_ID": settings.GOOGLE_ANALYTICS_ID,
            "GA4_MEASUREMENT_ID": settings.GA4_MEASUREMENT_ID,
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


@extend_schema(
    tags=["privaterelay"],
    parameters=[
        OpenApiParameter(
            name="Authorization",
            required=True,
            location="header",
            examples=[OpenApiExample("bearer", "Bearer XXXX-ZZZZ")],
            description="FXA Bearer Token. Can not be set in browsable API.",
        )
    ],
    request=OpenApiRequest(),
    responses={
        201: OpenApiResponse(description="Created; returned when user is created."),
        202: OpenApiResponse(
            description="Accepted; returned when user already exists."
        ),
        400: OpenApiResponse(
            description=(
                "Bad request; returned when request is missing Authorization: Bearer"
                " header or token value."
            )
        ),
        401: OpenApiResponse(
            description=(
                "Unauthorized; returned when the FXA token is invalid or expired."
            )
        ),
        404: OpenApiResponse(description="FXA did not return a user."),
        500: OpenApiResponse(description="No response from FXA server."),
    },
)
@api_view(["POST"])
@permission_classes([HasValidFxaToken, IsNewUser | IsActive])
@authentication_classes([FxaTokenAuthentication])
def terms_accepted_user(request: Request) -> Response:
    """
    Create a Relay user from an FXA token.

    See [API Auth doc][api-auth-doc] for details.

    [api-auth-doc]: https://github.com/mozilla/fx-private-relay/blob/main/docs/api_auth.md#firefox-oauth-token-authentication-and-accept-terms-of-service
    """  # noqa: E501

    user = request.user
    introspect_response = request.auth
    if not isinstance(introspect_response, IntrospectionResponse):
        raise ValueError(
            "Expected request.auth to be IntrospectionResponse,"
            f" got {type(introspect_response)}"
        )
    fxa_uid = introspect_response.fxa_id
    token = introspect_response.token

    existing_sa = False
    action: str | None = None
    profile_time_s: float | None = None
    if isinstance(user, User):
        socialaccount = SocialAccount.objects.get(user=user, provider="fxa")
        existing_sa = True
        action = "found_existing"

    if not existing_sa:
        # Get the user's profile
        fxa_profile, response, profile_time_s = _get_fxa_profile_from_bearer_token(
            token
        )
        if response:
            return response

        # Since this takes time, see if another request created the SocialAccount
        try:
            socialaccount = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")
            existing_sa = True
            action = "created_during_profile_fetch"
        except SocialAccount.DoesNotExist:
            pass

    if not existing_sa:
        # mypy type narrowing, but should always be true
        if not isinstance(fxa_profile, dict):  # pragma: no cover
            raise ValueError(f"fxa_profile is {type(fxa_profile)}, not dict")

        # Still no SocialAccount, attempt to create it
        socialaccount, response = _create_socialaccount_from_bearer_token(
            request, token, fxa_uid, fxa_profile
        )
        if response:
            return response
        action = "created"

    status_code = 202 if existing_sa else 201
    info_logger.info(
        "terms_accepted_user",
        extra={
            "social_account": socialaccount.uid,
            "status_code": status_code,
            "action": action,
            "introspection_from_cache": introspect_response.from_cache,
            "introspection_time_s": introspect_response.request_s,
            "profile_time_s": profile_time_s,
        },
    )
    return Response(status=status_code)


def _create_socialaccount_from_bearer_token(
    request: Request, token: str, fxa_uid: str, fxa_profile: dict[str, Any]
) -> tuple[SocialAccount, None] | tuple[None, Response]:
    """Create a new Relay user with a SocialAccount from an FXA Bearer Token."""

    # request is not exactly the request object that FirefoxAccountsProvider expects,
    # but it has all of the necessary attributes to initialize the Provider
    provider = get_social_adapter().get_provider(request, "fxa")

    # sociallogin_from_response does not save the new user that was created
    # https://github.com/pennersr/django-allauth/blob/65.3.0/allauth/socialaccount/providers/base/provider.py#L84
    social_login = provider.sociallogin_from_response(request, fxa_profile)

    # Complete social login is called by callback, see
    # https://github.com/pennersr/django-allauth/blob/65.3.0/allauth/socialaccount/providers/oauth/views.py#L116
    # for what we are mimicking to create new SocialAccount, User, and Profile for
    # the new Relay user from Firefox Since this is a Resource Provider/Server flow
    # and are NOT a Relying Party (RP) of FXA No social token information is stored
    # (no Social Token object created).
    try:
        complete_social_login(request, social_login)
    except (IntegrityError, NoReverseMatch) as e:
        # TODO: use this logging to fix the underlying issue
        # MPP-3473: NoReverseMatch socialaccount_signup
        #  Another user has the same email?
        log_extra = {"exception": str(e), "social_login_state": social_login.state}
        if fxa_profile.get("metricsEnabled", False):
            log_extra["fxa_uid"] = fxa_uid
        logger.error("socialaccount_signup_error", extra=log_extra)
        return None, Response(status=500)

    # complete_social_login writes ['account_verified_email', 'user_created',
    # '_auth_user_id', '_auth_user_backend', '_auth_user_hash'] on
    # request.session which sets the cookie because complete_social_login does
    # the "login" The user did not actually log in, logout to clear the session
    get_account_adapter(request).logout(request)

    sa: SocialAccount = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")

    # Indicate profile was created from the resource flow
    profile = sa.user.profile
    profile.created_by = "firefox_resource"
    profile.save()
    return sa, None


def _get_fxa_profile_from_bearer_token(
    token: str,
) -> tuple[dict[str, Any], None, float] | tuple[None, Response, None]:
    """Use a bearer token to get the Mozilla Account user's profile data"""
    # Use the bearer token
    try:
        with Timer(logger=None) as profile_timer:
            fxa_profile_resp = requests.get(
                FXA_PROFILE_URL,
                headers={"Authorization": f"Bearer {token}"},
                timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
            )
    except requests.Timeout:
        logger.error(
            "terms_accepted_user: timeout",
            extra={
                "profile_time_s": round(profile_timer.last, 3),
            },
        )
        return (
            None,
            Response(
                "Account profile request timeout, try again later.",
                status=503,
            ),
            None,
        )

    profile_time_s = round(profile_timer.last, 3)
    if not (fxa_profile_resp.ok and fxa_profile_resp.content):
        logger.error(
            "terms_accepted_user: bad account profile response",
            extra={
                "status_code": fxa_profile_resp.status_code,
                "content": fxa_profile_resp.content,
                "profile_time_s": profile_time_s,
            },
        )
        return (
            None,
            Response(
                data={"detail": "Did not receive a 200 response for account profile."},
                status=500,
            ),
            None,
        )
    return fxa_profile_resp.json(), None, profile_time_s
