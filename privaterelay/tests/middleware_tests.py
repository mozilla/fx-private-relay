"""Tests for Relay middlewares used in API and other server requests."""

from django.test import Client

import pytest
from markus.testing import MetricsMock
from pytest_django.fixtures import SettingsWrapper


@pytest.fixture
def response_metrics_settings(settings: SettingsWrapper) -> SettingsWrapper:
    """Setup settings for ResponseMetrics tests."""
    # Use some middleware in the declared order
    use_middleware = {
        "privaterelay.middleware.ResponseMetrics",
        "privaterelay.middleware.RelayStaticFilesMiddleware",
        "dockerflow.django.middleware.DockerflowMiddleware",
    }
    settings.MIDDLEWARE = [mw for mw in settings.MIDDLEWARE if mw in use_middleware]
    settings.STATSD_ENABLED = True
    return settings


def test_response_metrics_django_view(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """Django views emit the expected metric."""
    with MetricsMock() as mm:
        response = client.get("/metrics-event")
    assert response.status_code == 405
    mm.assert_timing_once(
        "response",
        tags=["status:405", "view:privaterelay.views.metrics_event", "method:GET"],
    )


@pytest.mark.django_db
def test_response_metrics_dockerflow_heartbeat(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """The Dockerflow __heartbeat__ endpoint emits the expected metric."""
    with MetricsMock() as mm:
        response = client.get("/__heartbeat__")
    # __heartbeat__ runs some security and connection tests
    # In some environments, a critical error results in a 500
    # In others, a warning or better results in a 200
    assert response.status_code in [200, 500]
    mm.assert_timing_once(
        "response",
        tags=[
            f"status:{response.status_code}",
            "view:dockerflow.django.views.heartbeat",
            "method:GET",
        ],
    )


@pytest.mark.parametrize("viewname", ["version", "lbheartbeat"])
def test_response_metrics_other_dockerflow_view(
    client: Client, response_metrics_settings: SettingsWrapper, viewname: str
) -> None:
    """The other Dockerflow views emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get(f"/__{viewname}__")
    assert response.status_code == 200
    mm.assert_timing_once(
        "response",
        tags=[
            "status:200",
            f"view:dockerflow.django.views.{viewname}",
            "method:GET",
        ],
    )


@pytest.mark.django_db
def test_response_metrics_api_viewset(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """API viewsets emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/api/v1/users/")
    assert response.status_code == 401
    mm.assert_timing_once(
        "response",
        tags=["status:401", "view:api.views.privaterelay.UserViewSet", "method:GET"],
    )


@pytest.mark.django_db
def test_response_metrics_api_view(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """API functions wrapped in @api_view emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/api/v1/runtime_data")
    assert response.status_code == 200
    mm.assert_timing_once(
        "response",
        tags=["status:200", "view:api.views.privaterelay.runtime_data", "method:GET"],
    )


def test_response_metrics_frontend_path(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """Frontend views emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/faq/")
    # The file is found if the frontend build was done, the DEBUG setting,
    #  if files were collected, etc.
    assert response.status_code in [200, 404]
    # Metrics are only emitted if found.
    if response.status_code == 200:
        mm.assert_timing_once(
            "response",
            tags=["status:200", "view:<static_file>", "method:GET"],
        )


@pytest.mark.django_db
def test_response_metrics_frontend_file(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """Frontend files emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/favicon.svg")
    # The file is found if the frontend build was done, the DEBUG setting,
    #  if files were collected, etc.
    assert response.status_code in [200, 404]
    # Metrics are only emitted if found.
    if response.status_code == 200:
        mm.assert_timing_once(
            "response",
            tags=["status:200", "view:<static_file>", "method:GET"],
        )


def test_response_metrics_disabled(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """ResponseMetrics does not emit metrics when metrics are disabled."""
    response_metrics_settings.STATSD_ENABLED = False
    with MetricsMock() as mm:
        response = client.get("/metrics-event")
    assert response.status_code == 405
    assert not mm.get_records()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "header_value,expected_platform",
    [
        ("appservices-ios", "mobile-ios"),
        ("appservices-android", "mobile-android"),
        ("appservices-macos", "desktop-macos"),
        (None, ""),
        ("invalid-value", ""),
    ],
)
def test_platform_middleware_integration(
    client: Client,
    header_value: str | None,
    expected_platform: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Platform middleware parses and includes platform in Glean events."""

    from privaterelay.tests.utils import get_glean_event

    headers = {"HTTP_X_RELAY_CLIENT": header_value} if header_value else {}
    response = client.get("/api/v1/runtime_data", headers=headers)
    assert response.status_code == 200

    # Verify the api.accessed Glean event includes the correct platform
    event = get_glean_event(caplog, category="api", name="accessed")
    if event:
        assert event["extra"]["platform"] == expected_platform
