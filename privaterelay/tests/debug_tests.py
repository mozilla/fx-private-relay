from django.conf import settings
from django.http import HttpRequest
from django.test import RequestFactory
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
        "BUNDLE_PLAN_ID_US",
        "BUNDLE_PROD_ID",
        "MEGABUNDLE_PROD_ID",
        "RELAY_CHANNEL",
        "RELAY_FROM_ADDRESS",
        "SUBPLAT3_BUNDLE_PRODUCT_KEY",
        "SUBPLAT3_PHONES_PRODUCT_KEY",
        "SUBPLAT3_PREMIUM_PRODUCT_KEY",
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
        "ACCOUNT_ADAPTER",
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
        "CACHES",
        "DJANGO_ALLOWED_HOSTS",
        "LOGGING_CONFIG",
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


@pytest.fixture
def meta_request(rf: RequestFactory) -> HttpRequest:
    request = rf.get(
        path="/meta-test",
        BUNDLE_PLAN_ID_US="price_1LwoSDJNcmPzuWtR6wPJZeoh",
        BUNDLE_PROD_ID="bundle-relay-vpn-dev",
        CACHES={"default": {"LOCATION": "rediss://user:pass@redis.example.com:10001"}},
        CSRF_COOKIE="cross-site-request-forgery-cookie",
        DATABASE_URL="postgres://user:pass@db.example.com:5432/relay_db",
        DJANGO_ALLOWED_HOST="relay.example.com",
        GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64="eyJwYXNzd29yZCI6ICJzZWNyZXQifQo=",
        MEGABUNDLE_PROD_ID="prod_SFb8iVuZIOPREe",
        REDIS_TEMPORARY_URL="redis://user:pass@redis.example.com:10001",
        REDIS_TLS_URL="rediss://user:pass@redis.example.com:10001",
        REDIS_URL="redis://user:pass@redis.example.com:10001",
        SENTRY_DSN="https://code@ingest.sentry.example.com/long_number",
    )
    return request


@pytest.mark.parametrize(
    "name",
    (
        "BUNDLE_PLAN_ID_US",
        "BUNDLE_PROD_ID",
        "MEGABUNDLE_PROD_ID",
    ),
)
def test_safe_meta(name: str, meta_request: HttpRequest) -> None:
    safe_meta = RelaySaferExceptionReporterFilter().get_safe_request_meta(meta_request)
    assert name in safe_meta
    assert safe_meta[name] == meta_request.META[name]


@pytest.mark.parametrize(
    "name",
    (
        "CACHES",
        "CSRF_COOKIE",
        "DATABASE_URL",
        "DJANGO_ALLOWED_HOST",
        "GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64",
        "REDIS_TEMPORARY_URL",
        "REDIS_TLS_URL",
        "REDIS_URL",
        "SENTRY_DSN",
    ),
)
def test_unsafe_meta(name: str, meta_request: HttpRequest) -> None:
    safe_meta = RelaySaferExceptionReporterFilter().get_safe_request_meta(meta_request)
    assert name in safe_meta
    assert safe_meta[name] != meta_request.META[name]
    assert safe_meta[name] == RelaySaferExceptionReporterFilter.cleansed_substitute
