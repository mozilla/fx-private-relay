from urllib.parse import urlencode, urlparse
import logging

from django.http import Http404
from django.shortcuts import resolve_url
from django.urls import resolve

from allauth.account.adapter import DefaultAccountAdapter


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
        if not super().is_safe_url(url):
            return False
        url = url or ""
        path = urlparse(url).path
        try:
            resolve(path)
            return True
        except Http404:
            logger.error("No matching URL for '%s'", url)
            return False
