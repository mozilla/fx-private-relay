from allauth.socialaccount.providers.oauth2.urls import default_urlpatterns

from .provider import RefreshingFXAProvider


urlpatterns = default_urlpatterns(RefreshingFXAProvider)
