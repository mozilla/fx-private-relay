import time
from datetime import datetime, timezone

from django.conf import settings
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


def _get_metric_view_name(request):
    if request.resolver_match:
        view = request.resolver_match.func
        return f"{view.__module__}.{view.__name__}"
    return "<unknown_view>"


class ResponseMetrics:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        delta = time.time() - start_time

        view_name = _get_metric_view_name(request)

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


class StoreFirstVisit:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        first_visit = request.COOKIES.get("first_visit")
        if first_visit is None and not request.user.is_anonymous:
            response.set_cookie("first_visit", datetime.now(timezone.utc))
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
