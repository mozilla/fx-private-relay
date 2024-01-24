"""Tests for Relay middlewares used in API and other server requests."""

from django.test import Client
from markus.testing import MetricsMock
from pytest_django.fixtures import SettingsWrapper
import pytest


@pytest.fixture
def response_metrics_settings(settings: SettingsWrapper) -> SettingsWrapper:
    # Use some middleware in the declared order
    settings.MIDDLEWARE = [
        "privaterelay.middleware.ResponseMetrics",
        "privaterelay.middleware.RelayStaticFilesMiddleware",
        "dockerflow.django.middleware.DockerflowMiddleware",
    ]
    settings.STATSD_ENABLED = True
    return settings


def test_response_metrics_django_view(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    with MetricsMock() as mm:
        response = client.get("/metrics-event")
    assert response.status_code == 405
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:405", "view:privaterelay.views.metrics_event", "method:GET"],
    )


def test_response_metrics_dockerflow_view(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
    with MetricsMock() as mm:
        response = client.get("/__lbheartbeat__")
    assert response.status_code == 200
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:<unknown_view>", "method:GET"],
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


@pytest.mark.django_db
def test_response_metrics_frontend_view(
    client: Client, response_metrics_settings: SettingsWrapper
) -> None:
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
