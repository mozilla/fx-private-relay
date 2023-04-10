from datetime import datetime, timedelta, timezone
from typing import Any, cast

from django.conf import settings

from allauth.socialaccount.models import SocialAccount, SocialToken
from allauth.socialaccount.providers.fxa.views import FirefoxAccountsOAuth2Adapter
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error, TokenExpiredError
from requests_oauthlib import OAuth2Session
from waffle.models import Flag
import logging
import sentry_sdk


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

    # TODO: find out why the auto_refresh and token_updater is not working
    # and instead we are manually refreshing the token at
    # FxAToRequest and get_subscription_data_from_fxa
    client = OAuth2Session(
        client_id,
        scope=settings.SOCIALACCOUNT_PROVIDERS["fxa"]["SCOPE"],
        token=token,
        auto_refresh_url=refresh_token_url,
        auto_refresh_kwargs=extra,
        token_updater=_token_updater,
    )
    return client


def _refresh_token(client, social_account):
    social_token = SocialToken.objects.get(account=social_account)
    # refresh user token to expand the scope to get accounts subscription data
    new_token = client.refresh_token(FirefoxAccountsOAuth2Adapter.access_token_url)
    update_social_token(social_token, new_token)
    return {"social_token": new_token, "refreshed": True}


def get_subscription_data_from_fxa(social_account: SocialAccount) -> dict[str, Any]:
    accounts_subscription_url = (
        settings.FXA_ACCOUNTS_ENDPOINT
        + "/oauth/mozilla-subscriptions/customer/billing-and-subscriptions"
    )

    try:
        client = _get_oauth2_session(social_account)
    except NoSocialToken as e:
        sentry_sdk.capture_exception(e)
        return {}

    try:
        # get detailed subscription data from FxA
        resp = client.get(accounts_subscription_url)
        json_resp = cast(dict[str, Any], resp.json())

        if "Requested scopes are not allowed" in json_resp.get("message", ""):
            logger.error("accounts_subscription_scope_failed")
            json_resp = _refresh_token(client, social_account)
    except TokenExpiredError as e:
        sentry_sdk.capture_exception(e)
        json_resp = _refresh_token(client, social_account)
    except CustomOAuth2Error as e:
        sentry_sdk.capture_exception(e)
        json_resp = {}
    return json_resp


def get_phone_subscription_dates(social_account):
    subscription_data = get_subscription_data_from_fxa(social_account)
    if "refreshed" in subscription_data.keys():
        # user token refreshed for expanded scope
        social_account.refresh_from_db()
        # retry getting detailed subscription data
        subscription_data = get_subscription_data_from_fxa(social_account)
        if "refreshed" in subscription_data.keys():
            return None, None, None
    if "subscriptions" not in subscription_data.keys():
        # failed to get subscriptions data which may mean user never had subscription
        # and/or there is data mismatch with FxA
        free_phones_flag = Flag.objects.filter(name="free_phones").first()
        has_free_phones = free_phones_flag and (
            free_phones_flag.everyone
            or free_phones_flag.is_active_for_user(social_account.user)
        )
        if not has_free_phones:
            # User who was flagged for having phone subscriptions
            # did not actually have phone subscriptions
            logger.error(
                "accounts_subscription_endpoint_failed",
                extra={"fxa_message": subscription_data.get("message", "")},
            )
        return None, None, None

    date_subscribed_phone = start_date = end_date = None
    product_w_phone_capabilites = [settings.PHONE_PROD_ID, settings.BUNDLE_PROD_ID]
    for sub in subscription_data.get("subscriptions", []):
        # Even if a user upgrade subscription e.g. from monthly to yearly
        # or from phone to VPN bundle use the last subscription subscription dates
        # Later, when the subscription details only show one valid subsription
        # this information can be updated
        subscription_created_timestamp = None
        subscription_start_timestamp = None
        subscription_end_timestamp = None
        if sub.get("product_id") in product_w_phone_capabilites:
            subscription_created_timestamp = sub.get("created")
            subscription_start_timestamp = sub.get("current_period_start")
            subscription_end_timestamp = sub.get("current_period_end")
        else:
            # not a product id for phone subscription, continue
            continue

        subscription_date_none = (
            subscription_created_timestamp
            and subscription_start_timestamp
            and subscription_end_timestamp
        ) is None
        if subscription_date_none:
            # subscription dates are required fields according to FxA documentation:
            # https://mozilla.github.io/ecosystem-platform/api#tag/Subscriptions/operation/getOauthMozillasubscriptionsCustomerBillingandsubscriptions
            logger.error(
                "accounts_subscription_subscription_date_invalid",
                extra={"subscription": sub},
            )
            return None, None, None

        date_subscribed_phone = datetime.fromtimestamp(
            subscription_created_timestamp, tz=timezone.utc
        )
        start_date = datetime.fromtimestamp(
            subscription_start_timestamp, tz=timezone.utc
        )
        end_date = datetime.fromtimestamp(subscription_end_timestamp, tz=timezone.utc)
    return date_subscribed_phone, start_date, end_date
