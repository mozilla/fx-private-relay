"""Types for the privaterelay app"""

from typing import Literal, TypedDict

RELAY_CHANNEL_NAME = Literal["local", "dev", "stage", "prod"]

# django-csp 4.0: types for CONTENT_SECURITY_POLICY in settings.py

# See https://github.com/mozilla/django-csp/blob/main/csp/utils.py
CSP_DIRECTIVES_T = TypedDict(
    "CSP_DIRECTIVES_T",
    {
        # Fetch Directives
        "child-src": list[str],
        "connect-src": list[str],
        "default-src": list[str],
        "script-src": list[str],
        "script-src-attr": list[str],
        "script-src-elem": list[str],
        "object-src": list[str],
        "style-src": list[str],
        "style-src-attr": list[str],
        "style-src-elem": list[str],
        "font-src": list[str],
        "frame-src": list[str],
        "img-src": list[str],
        "manifest-src": list[str],
        "media-src": list[str],
        "prefetch-src": list[str],  # Deprecated.
        # Document Directives
        "base-uri": list[str],
        "plugin-types": list[str],  # Deprecated.
        "sandbox": list[str],
        # Navigation Directives
        "form-action": list[str],
        "frame-ancestors": list[str],
        "navigate-to": list[str],
        # Reporting Directives
        "report-uri": str,
        "report-to": list[str],
        "require-sri-for": list[str],
        # Trusted Types Directives
        "require-trusted-types-for": list[str],
        "trusted-types": list[str],
        # Other Directives
        "webrtc": list[str],
        "worker-src": list[str],
        # Directives Defined in Other Documents
        "upgrade-insecure-requests": bool,
        "block-all-mixed-content": bool,  # Deprecated.
    },
    total=False,
)


class CONTENT_SECURITY_POLICY_T(TypedDict, total=False):
    EXCLUDE_URL_PREFIXES: list[str]
    DIRECTIVES: CSP_DIRECTIVES_T
    REPORT_PERCENTAGE: int
