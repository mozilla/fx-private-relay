from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import logging
import os

from google_measurement_protocol import event, report
import jwt
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error
from requests_oauthlib import OAuth2Session
import sentry_sdk

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied
from django.db import connections
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.providers.fxa.views import (
    FirefoxAccountsOAuth2Adapter
)

from credit_cards.models import FundingSource
from credit_cards.forms import FundingSourceForm, RelayCardForm
from emails.models import RelayAddress
from emails.utils import get_post_data_from_request


FXA_PROFILE_CHANGE_EVENT = (
    'https://schemas.accounts.firefox.com/event/profile-change'
)
FXA_DELETE_EVENT = (
    'https://schemas.accounts.firefox.com/event/delete-user'
)

logger = logging.getLogger('events')


def home(request):
    if (request.user and not request.user.is_anonymous):
        return redirect(reverse('profile'))
    return render(request, 'home.html')


def faq(request):
  if (not request.user or request.user.is_anonymous):
    return render(request, 'faq.html')
  fxa_account = request.user.socialaccount_set.filter(provider='fxa').first()
  avatar = fxa_account.extra_data['avatar'] if fxa_account else None
  return render(request, 'faq.html', {
    'avatar': avatar
  })


def profile(request):
    if (not request.user or request.user.is_anonymous):
        return redirect(reverse('fxa_login'))
    relay_addresses = RelayAddress.objects.filter(user=request.user).order_by(
        '-created_at'
    )
    funding_sources = FundingSource.objects.filter(user=request.user).order_by(
        '-created_at'
    )
    relay_cards = []
    for fs in funding_sources:
        relay_cards += FundingSource.fetch_credit_card(str(fs.token_uuid))
    fxa_account = request.user.socialaccount_set.filter(provider='fxa').first()
    avatar = fxa_account.extra_data['avatar'] if fxa_account else None
    relay_card_form = RelayCardForm(
        choices=funding_sources.values_list(
            'token_uuid', 'account_name'
        ).order_by('account_name')
    )
    return render(request, 'profile.html', {
        'relay_addresses': relay_addresses,
        'funding_sources': funding_sources,
        'funding_source_form': FundingSourceForm(),
        'relay_cards': relay_cards,
        'relay_card_form': relay_card_form,
        'avatar': avatar
    })


def version(request):
    # If version.json is available (from Circle job), serve that
    VERSION_JSON_PATH = os.path.join(settings.BASE_DIR, 'version.json')
    if os.path.isfile(VERSION_JSON_PATH):
        with open(VERSION_JSON_PATH) as version_file:
            return JsonResponse(json.load(version_file))

    # Generate version.json contents
    git_dir = os.path.join(settings.BASE_DIR, '.git')
    with open(os.path.join(git_dir, 'HEAD')) as head_file:
        ref = head_file.readline().split(' ')[-1].strip()

    with open(os.path.join(git_dir, ref)) as git_hash_file:
        git_hash = git_hash_file.readline().strip()

    version_data = {
        'source': 'https://github.com/groovecoder/private-relay',
        'version': git_hash,
        'commit': git_hash,
        'build': 'uri to CI build job',
    }
    return JsonResponse(version_data)


def heartbeat(request):
    db_conn = connections['default']
    c = db_conn.cursor()
    return HttpResponse('200 OK', status=200)


def lbheartbeat(request):
    return HttpResponse('200 OK', status=200)


@csrf_exempt
def metrics_event(request):
    request_data = json.loads(request.body)
    if 'ga_uuid' not in request_data:
        return JsonResponse({'msg': 'No GA uuid found'}, status=404)
    event_data = event(
        request_data.get('category', None),
        request_data.get('action', None),
        request_data.get('label', None),
        request_data.get('value', None),
    )
    report(
        settings.GOOGLE_ANALYTICS_ID, request_data.get('ga_uuid'), event_data
    )
    return JsonResponse({'msg': 'OK'}, status=200)


@csrf_exempt
def fxa_rp_events(request):
    req_jwt = _parse_jwt_from_request(request)
    authentic_jwt = _authenticate_fxa_jwt(req_jwt)
    event_keys = _get_event_keys_from_jwt(authentic_jwt)
    try:
        social_account = _get_account_from_jwt(authentic_jwt)
    except SocialAccount.DoesNotExist as e:
        # capture an exception in sentry, but don't error, or FXA will retry
        sentry_sdk.capture_exception(e)
        return HttpResponse('202 Accepted', status=202)

    for event_key in event_keys:
        if (event_key == FXA_PROFILE_CHANGE_EVENT):
            if settings.DEBUG:
                logger.info('fxa_profile_update', extra={
                    'jwt': authentic_jwt,
                    'event_key': event_key,
                })
            _handle_fxa_profile_change(
                authentic_jwt, social_account, event_key
            )
        if (event_key == FXA_DELETE_EVENT):
            _handle_fxa_delete(authentic_jwt, social_account, event_key)
    return HttpResponse('200 OK', status=200)


def _parse_jwt_from_request(request):
    request_auth = request.headers['Authorization']
    return request_auth.split('Bearer ')[1]


def _authenticate_fxa_jwt(req_jwt):
    private_relay_config = apps.get_app_config('privaterelay')
    authentic_jwt = _verify_jwt_with_fxa_key(req_jwt, private_relay_config)

    if not authentic_jwt:
        # FXA key may be old? re-fetch FXA keys and try again
        private_relay_config.ready()
        authentic_jwt = _verify_jwt_with_fxa_key(req_jwt, private_relay_config)
        if not authentic_jwt:
            raise Exception("Could not authenticate JWT with FXA key.")

    return authentic_jwt


def _verify_jwt_with_fxa_key(req_jwt, private_relay_config):
    if not private_relay_config.fxa_verifying_keys:
        raise Exception("FXA verifying keys are not available.")
    social_app = SocialApp.objects.get(provider='fxa')
    for verifying_key in private_relay_config.fxa_verifying_keys:
        if verifying_key['alg'] == 'RS256':
            verifying_key = jwt.algorithms.RSAAlgorithm.from_jwk(
                json.dumps(verifying_key)
            )
            return jwt.decode(
                req_jwt,
                verifying_key,
                audience=social_app.client_id,
                algorithms=['RS256']
            )


def _get_account_from_jwt(authentic_jwt):
    social_account_uid = authentic_jwt['sub']
    return SocialAccount.objects.get(uid=social_account_uid)


def _get_event_keys_from_jwt(authentic_jwt):
    return authentic_jwt['events'].keys()


def _handle_fxa_profile_change(authentic_jwt, social_account, event_key):
    client = _get_oauth2_session(social_account)
    # TODO: more graceful handling of profile fetch failures
    try:
        resp = client.get(FirefoxAccountsOAuth2Adapter.profile_url)
    except CustomOAuth2Error as e:
        sentry_sdk.capture_exception(e)
        return HttpResponse('202 Accepted', status=202)

    extra_data = resp.json()

    try:
        new_email = extra_data['email']
    except KeyError as e:
        sentry_sdk.capture_exception(e)
        return HttpResponse('202 Accepted', status=202)

    logger.info('fxa_rp_event', extra={
        'fxa_uid': authentic_jwt['sub'],
        'event_key': event_key,
        'real_address': sha256(new_email.encode('utf-8')).hexdigest(),
    })

    social_account.extra_data = extra_data
    social_account.save()
    social_account.user.email = new_email
    social_account.user.save()
    email_address_record = social_account.user.emailaddress_set.first()
    email_address_record.email = new_email
    email_address_record.save()


def _handle_fxa_delete(authentic_jwt, social_account, event_key):
    # TODO: Loop over the user's relay addresses and manually call delete()
    # to create hard bounce receipt rules in SES,
    # because cascade deletes like this don't necessarily call delete()
    deleted_user_objects = social_account.user.delete()
    logger.info('fxa_rp_event', extra={
        'fxa_uid': authentic_jwt['sub'],
        'event_key': event_key,
        'deleted_user_objects': deleted_user_objects,
    })


# use "raw" requests_oauthlib to automatically refresh the access token
# https://github.com/pennersr/django-allauth/issues/420#issuecomment-301805706
def _get_oauth2_session(social_account):
    refresh_token_url = FirefoxAccountsOAuth2Adapter.access_token_url
    social_token = social_account.socialtoken_set.first()

    def _token_updater(new_token):
        social_token.token = new_token['access_token']
        social_token.token_secret = new_token['refresh_token']
        social_token.expires_at = (
            datetime.now(timezone.utc) +
            timedelta(seconds=int(new_token['expires_in']))
        )
        social_token.save()

    client_id = social_token.app.client_id
    client_secret = social_token.app.secret

    extra = {
        'client_id': client_id,
        'client_secret': client_secret,
    }

    expires_in = (
        social_token.expires_at - datetime.now(timezone.utc)
    ).total_seconds()
    token = {
        'access_token': social_token.token,
        'refresh_token': social_token.token_secret,
        'token_type': 'Bearer',
        'expires_in': expires_in
    }

    client = OAuth2Session(
        client_id, token=token, auto_refresh_url=refresh_token_url,
        auto_refresh_kwargs=extra, token_updater=_token_updater
    )
    return client
