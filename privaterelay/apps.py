from typing import Any, Dict, List

import requests
import os

from django.apps import AppConfig
from django.conf import settings
from django.utils.functional import cached_property


ROOT_DIR = os.path.abspath(os.curdir)

# Constants
JWKS_ENDPOINT = "jwks"
OAUTH_ENDPOINT = "OAUTH_ENDPOINT"


class PrivateRelayConfig(AppConfig):
    name = "privaterelay"

    def ready(self) -> None:
        # Import signals module to register signals
        import privaterelay.signals

        # Suppress "imported but unused" warnings
        assert privaterelay.signals

        # Clear cached property if it exists
        if hasattr(self, "_fxa_verifying_keys"):
            del self._fxa_verifying_keys

    @cached_property
    def fxa_verifying_keys(self) -> List[Dict[str, Any]]:
        # Check if "fxa" provider exists in the "SOCIALACCOUNT_PROVIDERS" dictionary
        if "fxa" not in settings.SOCIALACCOUNT_PROVIDERS:
            return []

        # Get the OAuth endpoint from the settings
        oauth_endpoint = settings.SOCIALACCOUNT_PROVIDERS["fxa"].get(OAUTH_ENDPOINT)

        # Make a request to the JWKS endpoint
        resp = requests.get(f"{oauth_endpoint}/{JWKS_ENDPOINT}")
        if resp.status_code == 200:
            # Return the keys if the response is successful
            keys: List[Dict[str, Any]] = resp.json()["keys"]
            return keys

        # Return an empty list if the response is not successful
        return []
