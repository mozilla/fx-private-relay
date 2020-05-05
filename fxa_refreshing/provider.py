import requests

from allauth.compat import parse_qsl
from allauth.socialaccount.providers.oauth2.client import (
    OAuth2Client, OAuth2Error
)
from allauth.socialaccount.providers.fxa.provider import FirefoxAccountsProvider


class RefreshingFXAClient(OAuth2Client):
    # Custom client to include access_type=offline and store refresh token
    def get_access_token(self, code):
        data = {
            'access_type': 'offline',
            'redirect_uri': self.callback_url,
            'grant_type': 'authorization_code',
            'code': code}
        if self.basic_auth:
            auth = requests.auth.HTTPBasicAuth(
                self.consumer_key,
                self.consumer_secret)
        else:
            auth = None
            data.update({
                'client_id': self.consumer_key,
                'client_secret': self.consumer_secret
            })
        params = None
        self._strip_empty_keys(data)
        url = self.access_token_url
        if self.access_token_method == 'GET':
            params = data
            data = None
        # TODO: Proper exception handling
        resp = requests.request(
            self.access_token_method,
            url,
            params=params,
            data=data,
            headers=self.headers,
            auth=auth)

        access_token = None
        if resp.status_code in [200, 201]:
            # Weibo sends json via 'text/plain;charset=UTF-8'
            if (resp.headers['content-type'].split(
                    ';')[0] == 'application/json' or resp.text[:2] == '{"'):
                access_token = resp.json()
            else:
                access_token = dict(parse_qsl(resp.text))
        if not access_token or 'access_token' not in access_token:
            raise OAuth2Error('Error retrieving access token: %s'
                              % resp.content)
        return access_token


class RefreshingFXAProvider(FirefoxAccountsProvider):
    id = 'fxa'


provider_classes = [RefreshingFXAProvider]
