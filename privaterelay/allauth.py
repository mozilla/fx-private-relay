from urllib.parse import urlencode
import logging


from django.shortcuts import redirect, resolve_url
from django.urls import reverse
from django.urls.exceptions import NoReverseMatch

from allauth.account.adapter import DefaultAccountAdapter

from . import urls


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

    def is_safe_url(self, url):
        try:
            reverse(url, urls)
            return True
        except NoReverseMatch:
            logger.error("NoReverseMatch for %s", url)
        redirect("/")
