from datetime import datetime, timezone
import time

import markus
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error

from django.conf import settings
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.urls import reverse

from allauth.socialaccount.models import SocialToken
from allauth.socialaccount.providers.fxa.views import (
    FirefoxAccountsOAuth2Adapter
)

from .views import _get_oauth2_session, update_social_token

metrics = markus.get_metrics('fx-private-relay')


class FxAToRequest:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            return self.get_response(request)

        fxa_account = (
            request.user.socialaccount_set.filter(provider='fxa').first()
        )

        if not fxa_account:
            return self.get_response(request)

        social_token = SocialToken.objects.get(account=fxa_account)
        # if the user's FXA access token has expired; try to get a new one
        if social_token.expires_at < datetime.now(timezone.utc):
            try:
                client = _get_oauth2_session(fxa_account)
                new_token = client.refresh_token(
                    FirefoxAccountsOAuth2Adapter.access_token_url
                )
                update_social_token(social_token, new_token)
            except CustomOAuth2Error:
                logout(request)
                return redirect(reverse('home'))

        request.fxa_account = fxa_account
        return self.get_response(request)


class RedirectRootIfLoggedIn:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # To prevent showing a flash of the landing page when a user is logged
        # in, use a server-side redirect to send them to the dashboard,
        # rather than handling that on the client-side:
        if (request.path == '/' and
            settings.SESSION_COOKIE_NAME in request.COOKIES
           ):
            return redirect('accounts/profile/')

        response = self.get_response(request)
        return response


class AddDetectedCountryToResponseHeaders:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if 'X-Client-Region' in request.headers:
            response['X-Detected-Client-Region'] = (
                request.headers['X-Client-Region']
            )
        return response


def _get_metric_view_name(request):
    if request.resolver_match:
        view = request.resolver_match.func
        return f'{view.__module__}.{view.__name__}'
    return '<unknown_view>'


class ResponseMetrics:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        delta = time.time() - start_time

        view_name = _get_metric_view_name(request)

        metrics.timing('response', value=delta * 1000.0, tags=[
            f'status:{response.status_code}',
            f'view:{view_name}',
            f'method:{request.method}',
        ])

        return response

class StoreFirstVisit:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        first_visit = request.COOKIES.get("first_visit")
        if (first_visit is None and not request.user.is_anonymous):
            response.set_cookie("first_visit", datetime.now(timezone.utc))
        return response
