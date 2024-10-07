import re

from django.views.debug import SafeExceptionReporterFilter


class RelaySaferExceptionReporterFilter(SafeExceptionReporterFilter):
    """
    Add more settings values that should be hidden in debug and exception reports.

    This is also used by the Django Debug Toolbar settings panel.
    """

    # Hide any variable value that starts with these prefixes
    UNSAFE_PREFIXES = ["AWS_", "IQ_", "TWILIO_", "REDIS_"]

    # Hide any variable value named in this list
    UNSAFE_NAMES = [
        # Settings
        "ALLOWED_ACCOUNTS",
        "ALLOWED_HOSTS",
        "DJANGO_ALLOWED_HOSTS",
        "INTERNAL_IPS",
        # Environment Variables / META
        "CSRF_COOKIE",
        "DATABASE_URL",
        "DJANGO_ALLOWED_HOST",
        "DJANGO_ALLOWED_SUBNET",
        "DJANGO_INTERNAL_IPS",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64",
        "SENTRY_DSN",
    ]

    hidden_settings = re.compile(
        "API|TOKEN|KEY|SECRET|PASS|SIGNATURE|HTTP_COOKIE|"
        + "|".join(f"^{prefix}" for prefix in UNSAFE_PREFIXES)
        + "|"
        + "|".join(f"^{name}$" for name in UNSAFE_NAMES),
        re.IGNORECASE,
    )
