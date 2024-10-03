import re

from django.views.debug import SafeExceptionReporterFilter


class RelaySaferExceptionReporterFilter(SafeExceptionReporterFilter):
    """
    Add more settings values that should be hidden in debug and exception reports.

    This is also used by the Django Debug Toolbar settings panel.
    """

    # Hide any variable value that starts with these prefixes
    UNSAFE_PREFIXES = ["AWS_", "IQ_", "TWILIO_"]

    # Hide any variable value named in this list
    UNSAFE_NAMES = ["ALLOWED_ACCOUNTS", "ALLOWED_HOSTS", "DJANGO_ALLOWED_HOSTS"]

    hidden_settings = re.compile(
        "API|TOKEN|KEY|SECRET|PASS|SIGNATURE|HTTP_COOKIE|"
        + "|".join(f"^{prefix}" for prefix in UNSAFE_PREFIXES)
        + "|"
        + "|".join(f"^{name}$" for name in UNSAFE_NAMES),
        re.IGNORECASE,
    )
