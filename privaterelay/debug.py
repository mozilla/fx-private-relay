import re

from django.views.debug import SafeExceptionReporterFilter


class RelaySaferExceptionReporterFilter(SafeExceptionReporterFilter):
    """
    Hide all settings EXCEPT ones explicitly allowed by SAFE_PREFIXES or SAFE_NAMES.
    """

    # Allow variable values that start with these prefixes
    SAFE_PREFIXES: list = []

    # Allow variable values named in this list
    SAFE_NAMES = [
        "BUNDLE_PLAN_ID_US",
        "BUNDLE_PROD_ID",
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
