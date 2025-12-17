from logging import getLogger

from django.conf import settings

import requests
from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.socialaccount.adapter import get_adapter as get_social_adapter
from allauth.socialaccount.helpers import complete_social_login
from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed, ErrorDetail, ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from ..authentication_2025 import get_fxa_uid_from_oauth_token

logger = getLogger("events")
info_logger = getLogger("eventsinfo")
FXA_PROFILE_URL = (
    f"{settings.SOCIALACCOUNT_PROVIDERS['fxa']['PROFILE_ENDPOINT']}/profile"
)


def terms_accepted_user(request: Request) -> Response:
    """
    Create a Relay user from an FXA token.

    See [API Auth doc][api-auth-doc] for details.

    [api-auth-doc]: https://github.com/mozilla/fx-private-relay/blob/main/docs/api_auth.md#firefox-oauth-token-authentication-and-accept-terms-of-service
    """  # noqa: E501
    # Setting authentication_classes to empty due to
    # authentication still happening despite permissions being set to allowany
    # https://forum.djangoproject.com/t/solved-allowany-override-does-not-work-on-apiview/9754
    # TODO: Implement an FXA token authentication class
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
        # using the proper config that comes with the authentication_classes. See:
        # https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication
        if isinstance(e.detail, ErrorDetail):
            return Response(data={"detail": e.detail.title()}, status=e.status_code)
        else:
            return Response(data={"detail": e.get_full_details()}, status=e.status_code)
    status_code = 201

    try:
        sa = SocialAccount.objects.get(uid=fxa_uid, provider="fxa")
        status_code = 202
    except SocialAccount.DoesNotExist:
        # User does not exist, create a new Relay user
        fxa_profile_resp = requests.get(
            FXA_PROFILE_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=settings.FXA_REQUESTS_TIMEOUT_SECONDS,
        )
        if not (fxa_profile_resp.ok and fxa_profile_resp.content):
            logger.error(
                "terms_accepted_user: bad account profile response",
                extra={
                    "status_code": fxa_profile_resp.status_code,
                    "content": fxa_profile_resp.content,
                },
            )
            return Response(
                data={"detail": "Did not receive a 200 response for account profile."},
                status=500,
            )

        # This is not exactly the request object that FirefoxAccountsProvider expects,
        # but it has all of the necessary attributes to initialize the Provider
        provider = get_social_adapter().get_provider(request, "fxa")
        # This may not save the new user that was created
        # https://github.com/pennersr/django-allauth/blob/77368a84903d32283f07a260819893ec15df78fb/allauth/socialaccount/providers/base/provider.py#L44
        social_login = provider.sociallogin_from_response(
            request, fxa_profile_resp.json()
        )
        # Complete social login is called by callback, see
        # https://github.com/pennersr/django-allauth/blob/77368a84903d32283f07a260819893ec15df78fb/allauth/socialaccount/providers/oauth/views.py#L118
        # for what we are mimicking to create new SocialAccount, User, and Profile for
        # the new Relay user from Firefox Since this is a Resource Provider/Server flow
        # and are NOT a Relying Party (RP) of FXA No social token information is stored
        # (no Social Token object created).
        complete_social_login(request, social_login)
        # complete_social_login writes ['account_verified_email', 'user_created',
        # '_auth_user_id', '_auth_user_backend', '_auth_user_hash'] on
        # request.session which sets the cookie because complete_social_login does
        # the "login" The user did not actually log in, logout to clear the session
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
    return Response(status=status_code)
