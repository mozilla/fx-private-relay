from datetime import datetime, timedelta, timezone
from typing import Any

from django.conf import settings

from allauth.socialaccount.models import SocialAccount, SocialToken
from allauth.socialaccount.providers.fxa.views import FirefoxAccountsOAuth2Adapter
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error
from requests_oauthlib import OAuth2Session
import logging
import sentry_sdk

from emails.models import Profile


logger = logging.getLogger("events")


class NoSocialToken(Exception):
    """The SocialAccount has no SocialToken"""

    def __init__(self, uid: str, *args, **kwargs):
        self.uid = uid
        super().__init__(*args, **kwargs)

    def __str__(self) -> str:
        return f'NoSocialToken: The SocialAccount "{self.uid}" has no token.'

    def __repr__(self) -> str:
        return f'{self.__class__.__name__}("{self.uid}")'


def update_social_token(
    existing_social_token: SocialToken, new_oauth2_token: dict[str, Any]
) -> None:
    existing_social_token.token = new_oauth2_token["access_token"]
    existing_social_token.token_secret = new_oauth2_token["refresh_token"]
    existing_social_token.expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=int(new_oauth2_token["expires_in"])
    )
    existing_social_token.save()


# use "raw" requests_oauthlib to automatically refresh the access token
# https://github.com/pennersr/django-allauth/issues/420#issuecomment-301805706
def _get_oauth2_session(social_account: SocialAccount) -> OAuth2Session:
    refresh_token_url = FirefoxAccountsOAuth2Adapter.access_token_url
    social_token = social_account.socialtoken_set.first()
    if social_token is None:
        raise NoSocialToken(uid=social_account.uid)

    def _token_updater(new_token):
        update_social_token(social_token, new_token)

    client_id = social_token.app.client_id
    client_secret = social_token.app.secret

    extra = {
        "client_id": client_id,
        "client_secret": client_secret,
    }

    expires_in = (social_token.expires_at - datetime.now(timezone.utc)).total_seconds()
    token = {
        "access_token": social_token.token,
        "refresh_token": social_token.token_secret,
        "token_type": "Bearer",
        "expires_in": expires_in,
    }

    client = OAuth2Session(
        client_id,
        scope=settings.SOCIALACCOUNT_PROVIDERS["fxa"]["SCOPE"],
        token=token,
        auto_refresh_url=refresh_token_url,
        auto_refresh_kwargs=extra,
        token_updater=_token_updater,
    )
    return client
