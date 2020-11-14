import requests
import json

from django.apps import apps
from django.core.exceptions import PermissionDenied, ValidationError

credit_cards_config = apps.get_app_config('credit_cards')
PRIVACY_ENDPOINT = 'https://sandbox.privacy.com/v1'

def get_authorization_header():
    return {'Authorization': 'api-key ' + credit_cards_config.PRIVACY_TOKEN}

def validate_params(name, accepted, provided, required=False):
    if required and provided not in accepted:
        raise ValidationError(
            message=f'Invalid {name} provided: {provided}'
        )
    elif provided and provided not in accepted:
        raise ValidationError(
            message=f'Invalid optional {name} provided: {provided}'
        )
    return True

def make_privacy_request(method_type, path, data=None):
    req = None
    if method_type == 'GET':
        req = requests.get
    elif method_type == 'POST':
        req = requests.post
    elif method_type == 'PUT':
        req = requests.put

    if method_type == 'GET':
        resp = req(
            PRIVACY_ENDPOINT + path,
            headers=get_authorization_header(),
            params=data
        )
    else:
        resp = req(
            PRIVACY_ENDPOINT + path,
            headers=get_authorization_header(),
            json=data
        )

    if not bool(resp):
        raise ValidationError(message=resp.json())
    return resp.json()

def get_account(account_token):
    data = {'account_token': account_token}
    return make_privacy_request('GET', '/account', data)

def post_account(
        api_token,
        first_name,
        last_name,
        dob,
        street1,
        zipcode,
        ssn_last_four,
        street2=None,
        phone_number=None,
        email=None
):
    data = {
        'first_name': first_name,
        'last_name': last_name,
        'dob': dob,
        'street1': street1,
        'zipcode': zipcode,
        'ssn_last_four': ssn_last_four,
        'street2': street2,
        'phone_number': phone_number,
        'email': email
    }
    return make_privacy_request('POST', '/enroll/consumer', data)

def post_account_limit(
        account_token,
        daily_spend_limit=None,
        monthly_spend_limit=None,
        lifetime_spend_limit=None
):
    data = {
        'account_token': account_token,
        'daily_spend_limit': daily_spend_limit,
        'monthly_spend_limit': monthly_spend_limit,
        'lifetime_spend_limit': lifetime_spend_limit
    }
    return make_privacy_request('POST', '/account/limit', data)

def get_funding_source():
    return make_privacy_request('GET', '/fundingsource')

def post_funding_source(
        routing_number,  # needs to be a string
        account_number,  # needs to be a string
        account_name=None
):
    data = {
        'routing_number': routing_number,
        'account_number': account_number,
        'account_name': account_name,
    }
    return make_privacy_request('POST', '/fundingsource/bank', data)

def get_credit_card():
    return make_privacy_request('GET', '/card')

def post_credit_card(
        card_type,
        funding_token=None,
        memo=None,
        spend_limit=10,
        spend_limit_duration=None,
        state=None
):
    accepted_card_type = ['SINGLE_USE', 'MERCHANT_LOCKED', 'UNLOCKED']
    accepted_duration = ['TRANSACTION', 'MONTHLY', 'ANNUALLY', 'FOREVER']
    accepted_state = ['OPEN', 'PAUSED']
    validate_params(
        name='card_type',
        accepted=accepted_card_type,
        provided=card_type,
        required=True
    )
    validate_params(
        name='spend_limit_duration',
        accepted=accepted_duration,
        provided=spend_limit_duration
    )
    validate_params(name='state', accepted=accepted_state, provided=state)
    data = {
        'type': card_type,
        'memo': memo,
        'funding_token': funding_token,
        'spend_limit': spend_limit,
        # 'spend_limit_duration': spend_limit_duration,
        # 'state': state
    }
    return make_privacy_request('POST', '/card', data)
