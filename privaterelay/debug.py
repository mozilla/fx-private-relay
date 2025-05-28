import re

from django.http.request import HttpRequest
from django.views.debug import SafeExceptionReporterFilter


class RelaySaferExceptionReporterFilter(SafeExceptionReporterFilter):
    """
    Hide all settings EXCEPT ones explicitly allowed by SAFE_PREFIXES or SAFE_NAMES.
    """

    # By default, Django disables the filter if DEBUG=True.
    # Django correctly assumes "If DEBUG is True then your site is not safe anyway."
    # (https://github.com/django/django/blob/1520d18/django/views/debug.py#L175)
    # But, we sometimes temporarily set DEBUG=True in our dev environment to help debug.
    # And even in that case, we want as much additional safety as we can get.
    def is_active(self, request: HttpRequest | None) -> bool:
        return True

    # Allow variable values that start with these prefixes
    SAFE_PREFIXES: list = []

    # Allow variable values named in this list
    SAFE_NAMES = [
        "BUNDLE_PLAN_ID_US",
        "BUNDLE_PROD_ID",
        "MEGABUNDLE_PROD_ID",
        "RELAY_CHANNEL",
        "RELAY_CHANNEL_NAME",
        "RELAY_FROM_ADDRESS",
        "SUBPLAT3_BUNDLE_PRODUCT_KEY",
        "SUBPLAT3_PHONES_PRODUCT_KEY",
        "SUBPLAT3_PREMIUM_PRODUCT_KEY",
    ]

    # Match everything EXCEPT safe names and safe prefixes
    hidden_settings = re.compile(
        r"^(?!("
        + "|".join(f"{re.escape(name)}" for name in SAFE_NAMES)
        + "|"
        + "|".join(f"{re.escape(prefix)}.*" for prefix in SAFE_PREFIXES)
        + r")$).+",
        re.IGNORECASE,
    )
