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
        "fx.private.relay.response",
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
        "fx.private.relay.response",
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
        "fx.private.relay.response",
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
        "fx.private.relay.response",
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
        "fx.private.relay.response",
        tags=["status:200", "view:api.views.privaterelay.runtime_data", "method:GET"],
    )


def test_response_metrics_frontend_path(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """Frontend views emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/faq/")
    assert response.status_code == 200
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:<static_file>", "method:GET"],
    )


@pytest.mark.django_db
def test_response_metrics_frontend_file(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """Frontend files emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/favicon.svg")
    assert response.status_code == 200
    mm.assert_timing_once(
        "fx.private.relay.response",
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
