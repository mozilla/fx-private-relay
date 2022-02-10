from datetime import datetime
import logging

import requests

from django.conf import settings
from django.core.cache import cache

from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import (
    BaseAuthentication, get_authorization_header
)


logger = logging.getLogger('events')

def get_cache_key(token):
    return f'fxa_token_{token}'


class FxaTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        authorization = get_authorization_header(request).decode()
        if not authorization or not authorization.startswith('Bearer '):
            return None

        token = authorization.split(' ')[1]
        cache_key = get_cache_key(token)
        fxa_resp_data = cache.get(cache_key)
        if not fxa_resp_data:
            introspect_token_url = (
                '%s/introspect' %
                settings.SOCIALACCOUNT_PROVIDERS['fxa']['OAUTH_ENDPOINT']
            )
            fxa_resp = requests.post(
                introspect_token_url, json={'token': token}
            )
            try:
                fxa_resp_json = fxa_resp.json()
            except requests.exceptions.JSONDecodeError:
                logger.error('JSONDecodeError from FXA introspect response.')
                cache.set(cache_key, fxa_resp_data, 60)
                return None
            fxa_resp_data = {
                'status_code': fxa_resp.status_code, 'json': fxa_resp_json
            }

        if not fxa_resp_data.get('status_code') == 200:
            # cache anything besides 200 for 60s - it might be an error
            # we need to re-try, but we don't want to send un-throttled
            # retries at FXA
            cache.set(cache_key, fxa_resp_data, 60)
            return None

        if not fxa_resp_data.get('json').get('active'):
            # cache inactive token responses for 60s - it might be a token that
            # isn't active (yet), but we don't want to send un-throttled
            # retries at FXA
            cache.set(cache_key, fxa_resp_data, 60)
            return None

        try:
            fxa_uid = fxa_resp_data.get('json').get('sub')
            sa = SocialAccount.objects.get(uid=fxa_uid)

            # cache fxa_resp_data for as long as access_token is valid
            # Note: FXA iat and exp are timestamps in *milliseconds*
            fxa_token_exp_time = int(fxa_resp_data.get('json').get('exp')/1000)
            now_time = int(datetime.now().timestamp())
            timeout = fxa_token_exp_time - now_time
            cache.set(cache_key, fxa_resp_data, timeout)
            return (sa.user, None)
        except SocialAccount.DoesNotExist:
            # cache non-user token responses for 60s - it might be a user who
            # deleted their Relay account since they first signed up, and we
            # don't want to send un-throttled retries at FXA
            cache.set(cache_key, fxa_resp_data, 60)
            return None

        return None
