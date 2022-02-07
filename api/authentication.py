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

def get_cache_key(token, field):
    return f'fxa_token_{token}'


class FxaTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        authorization = get_authorization_header(request).decode()
        if not authorization or not authorization.startswith('Bearer '):
            return None

        token = request.headers.get('Authorization').split(' ')[1]
        status_cache_key = get_cache_key(token, 'status')
        fxa_resp_status = cache.get(status_cache_key)
        if not fxa_resp_status:
            introspect_token_url = (
                '%s/introspect' %
                settings.SOCIALACCOUNT_PROVIDERS['fxa']['OAUTH_ENDPOINT']
            )
            fxa_resp = requests.post(
                introspect_token_url, json={'token': token}
            )
            fxa_resp_status = fxa_resp.status_code

        if not fxa_resp_status == 200:
            # cache anything besides 200 for 60s - it might be an error
            # we need to re-try, but we don't want to send un-throttled
            # retries at FXA
            cache.set(status_cache_key, fxa_resp_status, 60)
            return None

        json_cache_key = get_cache_key(token, 'json')
        fxa_resp_json = cache.get(json_cache_key)
        if not fxa_resp_json:
            try:
                fxa_resp_json = fxa_resp.json()
                cache.set(json_cache_key, fxa_resp_json, 60)
            except requests.exceptions.JSONDecodeError:
                logger.error('JSONDecodeError from FXA introspect response.')
                return None

        if not fxa_resp_json.get('active'):
            # cache inactive token responses for 60s - it might be a token that
            # isn't active (yet), but we don't want to send un-throttled
            # retries at FXA
            cache.set(json_cache_key, fxa_resp_json, 60)
            return None

        try:
            fxa_uid = fxa_resp_json.get('sub')
            sa = SocialAccount.objects.get(uid=fxa_uid)

            # cache fxa_resp_json for as long as access_token is valid
            # Note: FXA iat and exp are timestamps in *milliseconds*
            fxa_token_exp_time = int(fxa_resp_json.get('exp')/1000)
            now_time = int(datetime.now().timestamp())
            timeout = fxa_token_exp_time - now_time
            cache.set(json_cache_key, fxa_resp_json, timeout)
            return (sa.user, None)
        except SocialAccount.DoesNotExist:
            # cache non-user token responses for 60s - it might be a user who
            # deleted their Relay account since they first signed up, and we
            # don't want to send un-throttled retries at FXA
            cache.set(json_cache_key, fxa_resp_json, 60)
            return None

        return None
