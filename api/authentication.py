import json
import requests

from django.conf import settings

from allauth.socialaccount.models import SocialAccount
from rest_framework.authentication import BaseAuthentication


class FxaTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        if 'Authorization' not in request.headers:
            return None

        authorization = request.headers.get('Authorization')
        if not authorization.startswith('Bearer '):
            return None

        token = request.headers.get('Authorization').split(' ')[1]
        verify_token_url = (
            '%s/verify' %
            settings.SOCIALACCOUNT_PROVIDERS['fxa']['OAUTH_ENDPOINT']
        )
        resp = requests.post(verify_token_url,json={'token': token})
        if resp.status_code == 200:
            resp_json = json.loads(resp.content)
            sa = SocialAccount.objects.get(uid=resp_json.get('user'))
            # TODO: cache sa.user for as long as access_token is valid
            return (sa.user, None)

        return None
