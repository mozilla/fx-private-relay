import re
import time
from collections.abc import Callable
from datetime import UTC, datetime

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect

import markus
from whitenoise.middleware import WhiteNoiseMiddleware

metrics = markus.get_metrics("fx-private-relay")


class RedirectRootIfLoggedIn:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # To prevent showing a flash of the landing page when a user is logged
        # in, use a server-side redirect to send them to the dashboard,
        # rather than handling that on the client-side:
        if request.path == "/" and settings.SESSION_COOKIE_NAME in request.COOKIES:
            query_string = (
                "?" + request.META["QUERY_STRING"]
                if request.META["QUERY_STRING"]
                else ""
            )
            return redirect("accounts/profile/" + query_string)

        response = self.get_response(request)
        return response


class AddDetectedCountryToRequestAndResponseHeaders:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        region_key = "X-Client-Region"
        region_dict = None
        if region_key in request.headers:
            region_dict = request.headers
        if region_key in request.GET:
            region_dict = request.GET
        if not region_dict:
            return self.get_response(request)

        country = region_dict.get(region_key)
        request.country = country
        response = self.get_response(request)
        response.country = country
        return response


class ResponseMetrics:

    re_dockerflow = re.compile(r"/__(version|heartbeat|lbheartbeat)__/?$")

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        self.middleware = RelayStaticFilesMiddleware()

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not settings.STATSD_ENABLED:
            return self.get_response(request)

        start_time = time.time()
        response = self.get_response(request)
        delta = time.time() - start_time
        view_name = self._get_metric_view_name(request)
        metrics.timing(
            "response",
            value=delta * 1000.0,
            tags=[
                f"status:{response.status_code}",
                f"view:{view_name}",
                f"method:{request.method}",
            ],
        )
        return response

    def _get_metric_view_name(self, request: HttpRequest) -> str:
        if request.resolver_match:
            view = request.resolver_match.func
            if hasattr(view, "view_class"):
                # Wrapped with rest_framework.decorators.api_view
                return f"{view.__module__}.{view.view_class.__name__}"
            return f"{view.__module__}.{view.__name__}"
        if match := self.re_dockerflow.match(request.path_info):
            return f"dockerflow.django.views.{match[1]}"
        if self.middleware.is_staticfile(request.path_info):
            return "<static_file>"
        return "<unknown_view>"


class StoreFirstVisit:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        first_visit = request.COOKIES.get("first_visit")
        if first_visit is None and not request.user.is_anonymous:
            response.set_cookie("first_visit", datetime.now(UTC))
        return response


class RelayStaticFilesMiddleware(WhiteNoiseMiddleware):
    """Customize WhiteNoiseMiddleware for Relay.

    The WhiteNoiseMiddleware serves static files and sets headers. In
    production, the files are read from staticfiles/staticfiles.json,
    and files with hashes in the name are treated as immutable with
    10-year cache timeouts.

    This class also treats Next.js output files (already hashed) as immutable.
    """

    def immutable_file_test(self, path, url):
        """
        Determine whether given URL represents an immutable file (i.e. a
        file with a hash of its contents as part of its name) which can
        therefore be cached forever.

        All files outputed by next.js are hashed and immutable
        """
        if not url.startswith(self.static_prefix):
            return False
        name = url[len(self.static_prefix) :]
        if name.startswith("_next/static/"):
            return True
        else:
            return super().immutable_file_test(path, url)

    def is_staticfile(self, path_info: str) -> bool:
        """
        Returns True if this file is served by the middleware.

        This uses the logic from whitenoise.middleware.WhiteNoiseMiddleware.__call__:
        https://github.com/evansd/whitenoise/blob/220a98894495d407424e80d85d49227a5cf97e1b/src/whitenoise/middleware.py#L117-L124
        """
        if self.autorefresh:
            static_file = self.find_file(path_info)
        else:
            static_file = self.files.get(path_info)
        return static_file is not None
