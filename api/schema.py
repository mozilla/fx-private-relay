"""Schema Extensions for drf-spectacular"""

from collections.abc import Callable

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import alpha_operation_sorter
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


# Organize partial paths by tags
# The partial path is the part after /api/v1/, like /api/v1/{partial_path}/
# The tag is set with the @extend_schema decorator
_TAG_TO_PARTIAL_PATH = {
    "email": {"domainaddresses", "first-forwarded-email", "relayaddresses"},
    "privaterelay": {
        "flags",
        "profiles",
        "report_webcompat_issue",
        "runtime_data",
        "terms-accepted-user",
        "users",
    },
    "phones": {"inboundcontact", "realphone", "relaynumber", "vCard"},
    "phones: Twilio": {"inbound_call", "inbound_sms", "sms_status", "voice_status"},
    "phones: Outbound": {"call", "message", "messages"},
    "phones: Inteliquent": {"inbound_sms_iq"},
}

# Reverse the dictionary to be partial paths to their tag
_PARTIAL_PATH_TO_TAG: dict[str, str] = {}
for _tag, _paths in _TAG_TO_PARTIAL_PATH.items():
    for _path in _paths:
        _PARTIAL_PATH_TO_TAG[_path] = _tag

# The order to display tag groups in the browsable API
_TAG_ORDER = {
    "UNKNOWN": 0,
    "privaterelay": 10,
    "email": 20,
    "phones": 30,
    "phones: Twilio": 31,
    "phones: Inteliquent": 32,
    "phones: Outbound": 33,
}


def sort_by_tag(endpoint: ENDPOINT) -> tuple[int, str, int]:
    """
    Sort paths by their tag, then name, then method.

    The browseable APIs will sort by tag, but in the order returned by this sort key.
    """
    drf_order = alpha_operation_sorter(endpoint)
    partial_path = endpoint[0].split("/")[3]
    tag = _PARTIAL_PATH_TO_TAG.get(partial_path, "UNKNOWN")
    return (_TAG_ORDER[tag], drf_order[0], drf_order[1])
