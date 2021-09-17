from datetime import datetime, timezone
import time

import markus
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error

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
