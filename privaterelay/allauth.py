import logging
from urllib.parse import urlencode, urlparse

from django.http import Http404
from django.shortcuts import resolve_url
from django.urls import resolve

from allauth.account.adapter import DefaultAccountAdapter

from .middleware import RelayStaticFilesMiddleware

logger = logging.getLogger("events")


class AccountAdapter(DefaultAccountAdapter):
    def get_login_redirect_url(self, request):
        """
        Redirect to dashboard, preserving utm params from FXA.
        """
        assert request.user.is_authenticated
        url = "/accounts/profile/?"
        utm_params = {k: v for k, v in request.GET.items() if k.startswith("utm")}
        url += urlencode(utm_params)
        return resolve_url(url)

    def is_safe_url(self, url: str | None) -> bool:
        """Check if the redirect URL is a safe URL."""
        # Is the domain valid?
        if not super().is_safe_url(url):
            return False

        # Is this a known Django path?
        path = urlparse(url or "").path
        try:
            resolve(path)  # Is this a known Django path?
            return True
        except Http404:
            pass

        # Is this a known frontend path?
        try:
            middleware = RelayStaticFilesMiddleware()
        except Exception:
            # Staticfiles are not available
            pass
        else:
            found = middleware.find_file(path)
            if found:
                return True

        # The path is invalid
        logger.error("No matching URL for '%s'", url)
        return False
