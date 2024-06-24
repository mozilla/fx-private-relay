"""Types for the privaterelay app"""

from typing import Literal, TypedDict

RELAY_CHANNEL_NAME = Literal["local", "dev", "stage", "prod"]

# django-csp 4.0: types for CONTENT_SECURITY_POLICY in settings.py

# Note: this will need adjustments to uplift to django-csp
# For example, the django-csp docs say 'sequence' rather than 'list',
# and appear more flexible about sending strings or lists.
_SERIALIZED_SOURCE_LIST = list[str]
CSP_DIRECTIVES_T = TypedDict(
    "CSP_DIRECTIVES_T",
    {
        # CSP Level 3 Working Draft, Directives (section 6)
        # https://www.w3.org/TR/CSP/#csp-directives
        # 6.1 Fetch Directives
        "child-src": _SERIALIZED_SOURCE_LIST,
        "connect-src": _SERIALIZED_SOURCE_LIST,
        "default-src": _SERIALIZED_SOURCE_LIST,
        "font-src": _SERIALIZED_SOURCE_LIST,
        "frame-src": _SERIALIZED_SOURCE_LIST,
        "img-src": _SERIALIZED_SOURCE_LIST,
        "manifest-src": _SERIALIZED_SOURCE_LIST,
        "media-src": _SERIALIZED_SOURCE_LIST,
        "object-src": _SERIALIZED_SOURCE_LIST,
        "script-src": _SERIALIZED_SOURCE_LIST,
        "script-src-elem": _SERIALIZED_SOURCE_LIST,
        "script-src-attr": _SERIALIZED_SOURCE_LIST,
        "style-src": _SERIALIZED_SOURCE_LIST,
        "style-src-elem": _SERIALIZED_SOURCE_LIST,
        "style-src-attr": _SERIALIZED_SOURCE_LIST,
        # 6.2 Other Directives
        "webrtc": Literal["'allow'", "'block'"],
        "worker-src": _SERIALIZED_SOURCE_LIST,
        # 6.3 Document Directives
        "base-uri": _SERIALIZED_SOURCE_LIST,
        "sandbox": str | list[str],  # sequence of tokens in CSP 3
        # 6.4 Navigation Directives
        "form-action": _SERIALIZED_SOURCE_LIST,
        "frame-ancestors": _SERIALIZED_SOURCE_LIST,
        "navigate-to": _SERIALIZED_SOURCE_LIST,
        # 6.5 Reporting Directives
        "report-uri": str | list[str],  # sequence of uri-references in CSP 3
        "report-to": str,
        # "require-sri-for": _SERIALIZED_SOURCE_LIST,
        # 6.6 Directives Defined in Other Documents
        "block-all-mixed-content": bool,  # Deprecated.
        "upgrade-insecure-requests": bool,
        # CSP2 items removed in CSP3
        # https://www.w3.org/TR/CSP2/#directives
        "plugin-types": _SERIALIZED_SOURCE_LIST,
        # Deprecated, from MDN
        "prefetch-src": _SERIALIZED_SOURCE_LIST,
        "referrer": str,
        # Experimental items, from MDN
        "fenced-frame-src": _SERIALIZED_SOURCE_LIST,
        "require-trusted-types-for": str,
        "trusted-types": str,
    },
    total=False,
)


class CONTENT_SECURITY_POLICY_T(TypedDict, total=False):
    EXCLUDE_URL_PREFIXES: list[str]
    DIRECTIVES: CSP_DIRECTIVES_T
    REPORT_PERCENTAGE: int
