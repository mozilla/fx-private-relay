from django.conf import settings
from django.views.debug import get_default_exception_reporter_filter

import pytest

from privaterelay.debug import RelaySaferExceptionReporterFilter


def test_default_filter() -> None:
    assert isinstance(
        get_default_exception_reporter_filter(), RelaySaferExceptionReporterFilter
    )


@pytest.mark.parametrize(
    "name",
    (
        "ACCOUNT_ADAPTER",
        "LOGGING_CONFIG",
    ),
)
def test_safe_settings(name: str) -> None:
    assert hasattr(settings, name)
    safe_settings = RelaySaferExceptionReporterFilter().get_safe_settings()
    assert name in safe_settings
    assert safe_settings[name] == getattr(settings, name)


@pytest.mark.parametrize(
    "name",
    (
        "ALLOWED_ACCOUNTS",
        "ALLOWED_HOSTS",
        "AUTH_PASSWORD_VALIDATORS",
        "AWS_ACCESS_KEY_ID",
        "AWS_REGION",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SES_CONFIGSET",
        "AWS_SNS_KEY_CACHE",
        "AWS_SNS_TOPIC",
        "AWS_SQS_EMAIL_DLQ_URL",
        "AWS_SQS_EMAIL_QUEUE_URL",
        "AWS_SQS_QUEUE_URL",
        "DJANGO_ALLOWED_HOSTS",
        "IQ_ENABLED",
        "IQ_FOR_NEW_NUMBERS",
        "IQ_FOR_VERIFICATION",
        "IQ_INBOUND_API_KEY",
        "IQ_MAIN_NUMBER",
        "IQ_MESSAGE_API_ORIGIN",
        "IQ_MESSAGE_PATH",
        "IQ_OUTBOUND_API_KEY",
        "IQ_PUBLISH_MESSAGE_URL",
        "PASSWORD_HASHERS",
        "PASSWORD_RESET_TIMEOUT",
        "SECRET_KEY",
        "SECRET_KEY_FALLBACKS",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_ALLOWED_COUNTRY_CODES",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_MAIN_NUMBER",
        "TWILIO_MESSAGING_SERVICE_SID",
        "TWILIO_NEEDS_10DLC_CAMPAIGN",
        "TWILIO_SMS_APPLICATION_SID",
        "TWILIO_TEST_ACCOUNT_SID",
        "TWILIO_TEST_AUTH_TOKEN",
    ),
)
def test_unsafe_settings(name: str) -> None:
    assert hasattr(settings, name)
    safe_settings = RelaySaferExceptionReporterFilter().get_safe_settings()
    assert name in safe_settings
    assert safe_settings[name] != getattr(settings, name)
    assert safe_settings[name] == RelaySaferExceptionReporterFilter.cleansed_substitute
