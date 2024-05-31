import logging
from urllib.parse import urlencode, urlparse

from django.http import Http404
from django.shortcuts import redirect, resolve_url
from django.urls import resolve

from allauth.account.adapter import DefaultAccountAdapter

from .middleware import RelayStaticFilesMiddleware

logger = logging.getLogger("events")


class AccountAdapter(DefaultAccountAdapter):
    def get_login_redirect_url(self, request):
        """
        Redirect to dashboard, preserving utm params from FXA.
        """
        if not request.user.is_authenticated:
            raise ValueError(
                "request.user must be authenticated when calling get_login_redirect_url"
            )
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
        except Exception:  # noqa: S110 (exception pass without log)
            # Staticfiles are not available
            pass
        else:
            found = middleware.find_file(path) or middleware.find_file_at_path(
                "staticfiles/" + path, path
            )

            # Is this a frontend URL?
            if found:
                return True

        # The path is invalid
        logger.error("No matching URL for '%s'", url)
        return False

    def respond_user_inactive(self, request, user):
        return redirect("/accounts/account_inactive/")
