"""Tests for privaterelay/middleware.py"""

import pytest

from django.test import Client

from _pytest.logging import LogCaptureFixture
from markus.testing import MetricsMock
from pytest_django.fixtures import SettingsWrapper


@pytest.mark.django_db
def test_response_metrics(
    settings: SettingsWrapper, client: Client, caplog: LogCaptureFixture
) -> None:
    settings.MIDDLEWARE = ["privaterelay.middleware.ResponseMetrics"]
    settings.DJANGO_STATSD_ENABLED = True

    with MetricsMock() as mm:
        response = client.get("/api/v1/runtime_data")
    mm.assert_timing_once(
        "fx.private.relay.response",
        tags=["status:200", "view:api.views.runtime_data", "method:GET"],
    )
    assert response.status_code == 200
    record = caplog.records[-1]
    assert getattr(record, "status_code") == 200
    assert getattr(record, "view_name") == "api.views.runtime_data"
    assert getattr(record, "method") == "GET"
    assert 0.0 <= getattr(record, "time_s") <= 1.0
