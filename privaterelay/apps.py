import requests

from django.apps import AppConfig
from django.conf import settings


class PrivateRelayConfig(AppConfig):
    name = 'privaterelay'

    settings.GULP_DEVELOP_COMMAND = "node_modules/.bin/gulp"

    def __init__(self, app_name, app_module):
        super(PrivateRelayConfig, self).__init__(app_name, app_module)
        self.fxa_verifying_keys = []

    def ready(self):
        resp = requests.get(
            '%s/jwks' %
            settings.SOCIALACCOUNT_PROVIDERS['fxa']['OAUTH_ENDPOINT']
        )
        if resp.status_code == 200:
            resp_json = resp.json()
            self.fxa_verifying_keys = resp_json['keys']
