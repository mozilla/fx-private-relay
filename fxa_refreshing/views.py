from allauth.socialaccount.providers.oauth2.views import (
    OAuth2LoginView,
    OAuth2CallbackView,
)
from allauth.socialaccount.providers.fxa.views import (
    FirefoxAccountsOAuth2Adapter,
)

from .provider import RefreshingFXAClient


class RefreshingFXACallbackView(OAuth2CallbackView):
    # Custom View that returns RefreshingFXAClient
    def get_client(self, request, app):
        callback_url = self.adapter.get_callback_url(request, app)
        provider = self.adapter.get_provider()
        scope = provider.get_scope(request)
        client = RefreshingFXAClient(
            self.request, app.client_id, app.secret,
            self.adapter.access_token_method,
            self.adapter.access_token_url,
            callback_url,
            scope,
            scope_delimiter=self.adapter.scope_delimiter,
            headers=self.adapter.headers,
            basic_auth=self.adapter.basic_auth)
        return client


oauth2_login = OAuth2LoginView.adapter_view(FirefoxAccountsOAuth2Adapter)
oauth2_callback = RefreshingFXACallbackView.adapter_view(
    FirefoxAccountsOAuth2Adapter
)
