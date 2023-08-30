from urllib.parse import urlencode
from django.shortcuts import resolve_url

from allauth.account.adapter import DefaultAccountAdapter


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
