from typing import Any
import requests
import os

from django.apps import AppConfig
from django.conf import settings
from django.utils.functional import cached_property


ROOT_DIR = os.path.abspath(os.curdir)


class PrivateRelayConfig(AppConfig):
    name = "privaterelay"

    def ready(self) -> None:
        import privaterelay.signals

        assert privaterelay.signals  # Suppress "imported but unused" warnings

        try:
            del self.fxa_verifying_keys  # Clear cache
        except AttributeError:
            pass

    @cached_property
    def fxa_verifying_keys(self) -> list[dict[str, Any]]:
        resp = requests.get(
            "%s/jwks" % settings.SOCIALACCOUNT_PROVIDERS["fxa"]["OAUTH_ENDPOINT"]
        )
        if resp.status_code == 200:
            keys: list[dict[str, Any]] = resp.json()["keys"]
            return keys
        return []
