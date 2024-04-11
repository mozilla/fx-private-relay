import base64
import json
from pathlib import Path
from typing import Any
import requests
import os

from django.apps import AppConfig
from django.conf import settings
from django.utils.functional import cached_property


ROOT_DIR = os.path.abspath(os.curdir)


def get_profiler_startup_data() -> tuple[str | None, str | None]:
    from .utils import get_version_info

    if settings.RELAY_CHANNEL not in ("dev", "stage", "prod"):
        return (None, None)

    if settings.RELAY_CHANNEL in ("dev", "stage"):
        service = f"fxprivaterelay-{settings.RELAY_CHANNEL}"
    if settings.RELAY_CHANNEL == "prod":
        service = "fxprivaterelay"

    version_info = get_version_info()
    version = version_info.get("version", "unknown")

    return service, version


def write_gcp_key_json_file(gcp_key_json_path: Path) -> None:
    """
    Create the gcp key json file from contents of GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64
    """
    google_app_creds = base64.b64decode(settings.GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64)
    if not google_app_creds == b"":
        with open(gcp_key_json_path, "w+") as gcp_key_file:
            gcp_key_file.write(google_app_creds.decode("utf-8"))


class PrivateRelayConfig(AppConfig):
    name = "privaterelay"

    def ready(self) -> None:
        if (
            settings.GOOGLE_APPLICATION_CREDENTIALS != ""
            and settings.GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64 != ""
        ):
            # Set up Google Cloud Profiler
            service, version = get_profiler_startup_data()
            if service is not None:
                gcp_key_json_path = Path(settings.GOOGLE_APPLICATION_CREDENTIALS)
                if not gcp_key_json_path.exists():
                    write_gcp_key_json_file(gcp_key_json_path)
                try:
                    with gcp_key_json_path.open() as gcp_key_file:
                        try:
                            # Make sure the expect gcp_key.json file is valid json
                            gcp_key_data = json.load(gcp_key_file)
                            import googlecloudprofiler

                            googlecloudprofiler.start(
                                service=service,
                                service_version=version,
                                project_id=gcp_key_data["project_id"],
                            )
                        except json.JSONDecodeError:
                            print(f"error during json.load({gcp_key_json_path})")
                except Exception as exc:
                    print(
                        f"exception {repr(exc)}"
                        " while starting google cloud profiler"
                        f" with key file: {gcp_key_json_path}"
                    )

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
