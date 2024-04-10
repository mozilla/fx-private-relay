"""Schema Extensions for drf-spectacular"""

from typing import Callable

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.openapi import AutoSchema
from rest_framework.response import Response


class FxaTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "api.authentication.FxaTokenAuthentication"
    name = "Mozilla account Token Auth"

    def get_security_definition(self, auto_schema: AutoSchema) -> dict[str, str]:
        return {"type": "http", "scheme": "bearer"}


IGNORED_PATHS = {
    "/api/v1/inbound_call",
    "/api/v1/inbound_sms",
    "/api/v1/realphone/resend_welcome_sms",
    "/api/v1/report_webcompat_issue",
    "/api/v1/runtime_data",
    "/api/v1/sms_status",
    "/api/v1/vCard/{lookup_key}",
    "/api/v1/voice_status",
}

ENDPOINT = tuple[str, str, str, Callable[..., Response]]


def preprocess_ignore_deprecated_paths(endpoints: list[ENDPOINT]) -> list[ENDPOINT]:
    "Remove the deprecated path variants without the trailing slash."

    return [
        (path, path_regex, method, callback)
        for path, path_regex, method, callback in endpoints
        if path not in IGNORED_PATHS
    ]
