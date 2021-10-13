import requests
import os

from django.apps import AppConfig
from django.conf import settings


ROOT_DIR = os.path.abspath(os.curdir)

class PrivateRelayConfig(AppConfig):
    name = 'privaterelay'

    settings.GULP_DEVELOP_COMMAND = ROOT_DIR + "/node_modules/.bin/gulp"

    def __init__(self, app_name, app_module):
        super(PrivateRelayConfig, self).__init__(app_name, app_module)
        self.fxa_verifying_keys = []

    def ready(self):
        import privaterelay.signals

        resp = requests.get(
            '%s/jwks' %
            settings.SOCIALACCOUNT_PROVIDERS['fxa']['OAUTH_ENDPOINT']
        )
        if resp.status_code == 200:
            resp_json = resp.json()
            self.fxa_verifying_keys = resp_json['keys']
