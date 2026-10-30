"""Tests for Relay middlewares used in API and other server requests."""

import os
from pathlib import Path

from django.http import HttpResponse
from django.test import Client, RequestFactory

import pytest
from markus.testing import MetricsMock
from pytest_django.fixtures import Settings

from privaterelay.middleware import (
    EagerNonceCSPMiddleware,
    _inline_script_hashes_for_file,
)


@pytest.fixture
def response_metrics_settings(settings: Settings) -> Settings:
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
    client: Client, response_metrics_settings: Settings
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
    client: Client, response_metrics_settings: Settings
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
    client: Client, response_metrics_settings: Settings, viewname: str
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
    client: Client, response_metrics_settings: Settings
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
    client: Client, response_metrics_settings: Settings
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
    client: Client, response_metrics_settings: Settings
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
    client: Client, response_metrics_settings: Settings
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
    client: Client, response_metrics_settings: Settings
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


TURBOPACK_BOOTSTRAP = '(globalThis["TURBOPACK"] || []).push({});'
TURBOPACK_BOOTSTRAP_HASH = "'sha256-1fuLOzhmHsqr5BeSiKAiTnC/SnQH0R4IceGfVDD1eZc='"


@pytest.fixture
def frontend_root(settings: Settings, tmp_path: Path) -> Path:
    """Serve exported frontend HTML from a temporary STATIC_ROOT."""
    settings.DEBUG = False
    settings.STATIC_ROOT = str(tmp_path)
    return tmp_path


def _write_page(root: Path, request_path: str, html: str) -> Path:
    page = root / request_path.strip("/") / "index.html"
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text(html, encoding="utf-8")
    return page


def _script_src(rf: RequestFactory, request_path: str) -> str:
    middleware = EagerNonceCSPMiddleware(lambda request: HttpResponse())
    response = middleware(rf.get(request_path))
    assert isinstance(response, HttpResponse)
    for directive in response["Content-Security-Policy"].split(";"):
        if directive.strip().startswith("script-src"):
            return directive.strip()
    raise AssertionError("No script-src in CSP header")


def test_eager_nonce_csp_adds_turbopack_bootstrap_hash(
    frontend_root: Path, rf: RequestFactory
) -> None:
    """Only the Turbopack bootstrap is allowed by hash, alongside the nonce."""
    _write_page(
        frontend_root,
        "/faq/",
        f"<html><script>{TURBOPACK_BOOTSTRAP}</script>"
        "<script>malicious()</script>"
        '<script src="/_next/static/chunks/a.js"></script>'
        '<script id="__NEXT_DATA__" type="application/json">{}</script></html>',
    )

    script_src = _script_src(rf, "/faq/")

    assert TURBOPACK_BOOTSTRAP_HASH in script_src
    assert script_src.count("'sha256-") == 1
    assert "'nonce-" in script_src


def test_eager_nonce_csp_skips_paths_not_in_list(
    frontend_root: Path, rf: RequestFactory
) -> None:
    _write_page(
        frontend_root, "/not-a-page/", f"<script>{TURBOPACK_BOOTSTRAP}</script>"
    )

    script_src = _script_src(rf, "/not-a-page/")
    assert "'sha256-" not in script_src


def test_eager_nonce_csp_caches_hashes_until_page_changes(
    frontend_root: Path, rf: RequestFactory
) -> None:
    _inline_script_hashes_for_file.cache_clear()
    page = _write_page(
        frontend_root, "/faq/", f"<script>{TURBOPACK_BOOTSTRAP}</script>"
    )

    _script_src(rf, "/faq/")
    _script_src(rf, "/faq/")
    cache_info = _inline_script_hashes_for_file.cache_info()
    assert (cache_info.hits, cache_info.misses) == (1, 1)

    # Overwrites the same file with a a slightly different script.
    # Setting the mtime explicitly so the rebuild is detected.
    _write_page(frontend_root, "/faq/", '<script>(globalThis["TURBOPACK"]=1)</script>')
    mtime_ns = page.stat().st_mtime_ns + 1_000_000_000
    os.utime(page, ns=(mtime_ns, mtime_ns))

    script_src = _script_src(rf, "/faq/")
    assert _inline_script_hashes_for_file.cache_info().misses == 2
    assert TURBOPACK_BOOTSTRAP_HASH not in script_src
    assert script_src.count("'sha256-") == 1
