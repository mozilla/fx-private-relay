from hashlib import sha256
import json
import logging
import os

from jwt import JWT, jwk_from_dict
import requests
import sentry_sdk

from django.apps import apps
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import connections
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt

from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.providers.fxa.views import (
    FirefoxAccountsOAuth2Adapter
)

from emails.models import RelayAddress


FXA_PROFILE_CHANGE_EVENT = (
    'https://schemas.accounts.firefox.com/event/profile-change'
)
FXA_DELETE_EVENT = (
    'https://schemas.accounts.firefox.com/event/delete-user'
)

logger = logging.getLogger('events')
jwt_instance = JWT()


def home(request):
    if (request.user and not request.user.is_anonymous):
        return redirect('/accounts/profile/')
    return render(request, 'home.html')


def profile(request):
    if (not request.user or request.user.is_anonymous):
        return redirect('/')
    relay_addresses = RelayAddress.objects.filter(user=request.user)
    fxa_account = request.user.socialaccount_set.filter(provider='fxa').first()
    avatar = fxa_account.extra_data['avatar'] if fxa_account else None

    return render(request, 'profile.html', {
        'relay_addresses': relay_addresses, 'avatar': avatar
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
def fxa_rp_events(request):
    jwt = _parse_jwt_from_request(request)
    authentic_jwt = _authenticate_fxa_jwt(jwt)
    try:
        social_account = _get_account_from_jwt(authentic_jwt)
    except SocialAccount.DoesNotExist as e:
        # we received an FXA event for an FXA not in our DB;
        # capture the exception in sentry, but don't error, or FXA will retry
        sentry_sdk.capture_exception(e)
        return HttpResponse('202 Accepted', status=202)

    event_keys = _get_event_keys_from_jwt(authentic_jwt)
    for event_key in event_keys:
        _handle_fxa_event(
            event_key, authentic_jwt, social_account, event_key
        )
    return HttpResponse('200 OK', status=200)


def _parse_jwt_from_request(request):
    request_auth = request.headers['Authorization']
    jwt = request_auth.split('Bearer ')[1]
    return jwt


def _authenticate_fxa_jwt(jwt):
    private_relay_config = apps.get_app_config('privaterelay')
    for verifying_key_json in private_relay_config.fxa_verifying_keys:
        verifying_key = jwk_from_dict(verifying_key_json)
        return jwt_instance.decode(jwt, verifying_key)


def _get_account_from_jwt(authentic_jwt):
    # Validate the jwt is for this client
    social_app = SocialApp.objects.get(provider='fxa')
    if authentic_jwt['aud'] != social_app.client_id:
        raise PermissionDenied(
            "JWT client ID does not match this application."
        )
    # Validate the jwt is for a user in this application
    social_account_uid = authentic_jwt['sub']
    return SocialAccount.objects.get(uid=social_account_uid)


def _get_event_keys_from_jwt(authentic_jwt):
    return authentic_jwt['events'].keys()


def _handle_fxa_event(event_key, authentic_jwt, social_account):
    if (event_key == FXA_PROFILE_CHANGE_EVENT):
        _handle_fxa_profile_change(
            authentic_jwt, social_account, event_key
        )
    if (event_key == FXA_DELETE_EVENT):
        _handle_fxa_delete(authentic_jwt, social_account, event_key)


def _handle_fxa_profile_change(authentic_jwt, social_account, event_key):
    token = social_account.socialtoken_set.first()
    headers = {'Authorization': 'Bearer: {0}'.format(token.token)}
    resp = requests.get(
        FirefoxAccountsOAuth2Adapter.profile_url, headers=headers
    )
    if resp.status_code == 401:
        resp_json = resp.json()
        if resp_json['reason'] == 'Invalid token':
            # TODO: use the social_account refresh token to get a new access
            # token and retry
            pass

    extra_data = resp.json()
    new_email = extra_data['email']
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
    # TODO?: loop over the user's relay addresses and create hard bounce
    # receipt rules for them? Note: can't just do this in RelayAddress.delete
    # because cascade deletes like this don't necessarily call delete()
    deleted_objects = social_account.user.delete()
    logger.info('fxa_rp_event', extra={
        'fxa_uid': authentic_jwt['sub'],
        'event_key': event_key,
        'deleted_objects': deleted_objects,
    })
