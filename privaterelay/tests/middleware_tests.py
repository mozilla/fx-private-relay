"""Tests for privaterelay/middleware.py"""

import pytest

from django.test import Client

from markus.testing import MetricsMock
from pytest_django.fixtures import SettingsWrapper


@pytest.mark.django_db
def test_response_metrics_api_view(settings: SettingsWrapper, client: Client) -> None:
    settings.MIDDLEWARE = ["privaterelay.middleware.ResponseMetrics"]
    settings.DJANGO_STATSD_ENABLED = True

    with MetricsMock() as mm:
        response = client.get("/api/v1/runtime_data/")
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:api.views.runtime_data", "method:GET"],
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_response_metrics_django_view(
    settings: SettingsWrapper, client: Client
) -> None:
    settings.MIDDLEWARE = ["privaterelay.middleware.ResponseMetrics"]
    settings.DJANGO_STATSD_ENABLED = True

    with MetricsMock() as mm:
        response = client.get("/__heartbeat__")
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:privaterelay.views.heartbeat", "method:GET"],
    )
    assert response.status_code == 200
