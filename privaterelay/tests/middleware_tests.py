"""Tests for Relay middlewares used in API and other server requests."""

from django.test import Client

import pytest
from markus.testing import MetricsMock
from pytest_django.fixtures import SettingsWrapper


@pytest.fixture
def response_metrics_settings(settings: SettingsWrapper) -> SettingsWrapper:
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
    """Django views emit the expected metrics."""
    with MetricsMock() as mm:
        response = client.get("/metrics-event")
    assert response.status_code == 405
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:405", "view:privaterelay.views.metrics_event", "method:GET"],
    )


@pytest.mark.django_db
@pytest.mark.parametrize("viewname", ["version", "heartbeat", "lbheartbeat"])
def test_response_metrics_dockerflow_view(
    client: Client, response_metrics_settings: SettingsWrapper, viewname: str
) -> None:
    """Dockerflow views are handled by the DockerflowMiddleware."""
    with MetricsMock() as mm:
        response = client.get(f"/__{viewname}__")
    expected_status_code = 500 if viewname == "heartbeat" else 200
    assert response.status_code == expected_status_code
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=[
            f"status:{expected_status_code}",
            f"view:dockerflow.django.views.{viewname}",
            "method:GET",
        ],
    )


@pytest.mark.django_db
def test_response_metrics_api_view(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    with MetricsMock() as mm:
        response = client.get("/api/v1/runtime_data")
    assert response.status_code == 200
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:api.views.privaterelay.view", "method:GET"],
    )


def test_response_metrics_frontend_path(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    """Frontend views do not return through the ResponseMetrics middleware."""
    with MetricsMock() as mm:
        response = client.get("/faq/")
    assert response.status_code == 200
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:<unknown_view>", "method:GET"],
    )


@pytest.mark.django_db
def test_response_metrics_frontend_file(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    with MetricsMock() as mm:
        response = client.get("/favicon.svg")
    assert response.status_code == 200
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:<unknown_view>", "method:GET"],
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
