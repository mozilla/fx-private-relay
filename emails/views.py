import contextlib
from datetime import datetime
from email.utils import parseaddr
from hashlib import sha256
import json
import logging
import markus

from decouple import config
from socketlabs.injectionapi import SocketLabsClient
from socketlabs.injectionapi.message.basicmessage import BasicMessage
from socketlabs.injectionapi.message.emailaddress import EmailAddress

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import redirect, render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .context_processors import relay_from_domain
from .models import DeletedAddress, Profile, RelayAddress


logger = logging.getLogger('events')
metrics = markus.get_metrics('fx-private-relay')


@csrf_exempt
def index(request):
    if (not request.user.is_authenticated and
        not request.POST.get("api_token", False)
       ):
        raise PermissionDenied
    if request.method == 'POST':
        return _index_POST(request)
    return redirect('profile')


def _get_user_profile(request, api_token):
    if not request.user.is_authenticated:
        return Profile.objects.get(api_token=api_token)
    return request.user.profile_set.first()


def _index_POST(request):
    api_token = request.POST.get('api_token', None)
    if not api_token:
        raise PermissionDenied
    user_profile = _get_user_profile(request, api_token)
    if request.POST.get('method_override', None) == 'PUT':
        return _index_PUT(request, user_profile)
    if request.POST.get('method_override', None) == 'DELETE':
        return _index_DELETE(request, user_profile)

    existing_addresses = RelayAddress.objects.filter(user=user_profile.user)
    if existing_addresses.count() >= settings.MAX_NUM_BETA_ALIASES:
        if 'moz-extension' in request.headers.get('Origin', ''):
            return HttpResponse('Payment Required', status=402)
        messages.error(
            request, "You already have 5 email addresses. Please upgrade."
        )
        return redirect('profile')

    relay_address = RelayAddress.make_relay_address(user_profile.user)
    return_string = '%s@%s' % (
        relay_address.address, relay_from_domain(request)['RELAY_DOMAIN']
    )
    if 'moz-extension' in request.headers.get('Origin', ''):
        return HttpResponse(return_string, status=201)

    return redirect('profile')


def _get_relay_address_from_id(request, user_profile):
    try:
        relay_address = RelayAddress.objects.get(
            id=request.POST['relay_address_id'],
            user=user_profile.user
        )
        return relay_address
    except RelayAddress.DoesNotExist as e:
        print(e)
        return HttpResponse("Address does not exist")


def _index_PUT(request, user_profile):
    relay_address = _get_relay_address_from_id(request, user_profile)
    if request.POST.get('enabled') == 'Disable':
        relay_address.enabled = False
    elif request.POST.get('enabled') == 'Enable':
        relay_address.enabled = True
    relay_address.save(update_fields=['enabled'])
    return redirect('profile')


def _index_DELETE(request, user_profile):
    relay_address = _get_relay_address_from_id(request, user_profile)
    relay_address.delete()
    return redirect('profile')


@csrf_exempt
def inbound(request):
    if _get_secret_key(request) != settings.SOCKETLABS_SECRET_KEY:
        return HttpResponse("Unauthorized", status=401)

    if (request.content_type == 'application/x-www-form-urlencoded' and
        request.POST['Type'] == 'Validation'):
        return HttpResponse(settings.SOCKETLABS_VALIDATION_KEY)

    if request.content_type != 'application/json':
        return HttpResponse("Unsupported Media Type", status=415)

    json_body = json.loads(request.body)
    return _inbound_logic(json_body)


def _get_secret_key(request):
    if request.content_type == 'application/x-www-form-urlencoded':
        return request.POST['SecretKey']
    if request.content_type == 'application/json':
        json_body = json.loads(request.body)
        return json_body['SecretKey']
    return ''


def _inbound_logic(json_body):
    message_data = json_body['Message']
    email_to = parseaddr(message_data['To'][0]['EmailAddress'])[1]
    local_portion = email_to.split('@')[0]
    from_address = parseaddr(message_data['From']['EmailAddress'])[1]
    subject = message_data.get('Subject')
    text = message_data.get('TextBody')
    html = message_data.get('HtmlBody')

    # TODO: do we need this in SocketLabs?
    # 404s make sendgrid retry the email, so respond with 200 even if
    # the address isn't found
    try:
        relay_address = RelayAddress.objects.get(address=local_portion)
        if not relay_address.enabled:
            relay_address.num_blocked += 1
            relay_address.save(update_fields=['num_blocked'])
            return HttpResponse("Address does not exist")
    except RelayAddress.DoesNotExist as e:
        print(e)
        return HttpResponse("Address does not exist")

    logger.info('email_relay', extra={
        'relay_address_id': relay_address.id,
        'relay_address': sha256(local_portion.encode('utf-8')).hexdigest(),
        'real_address': sha256(
            relay_address.user.email.encode('utf-8')
        ).hexdigest(),
    })
    # Forward to real email address
    sl_message = BasicMessage()
    sl_message.subject = subject
    sl_message.html_body = html
    sl_message.plain_text_body = text
    relay_from_address, relay_from_display = _generate_relay_From(from_address)
    sl_message.from_email_address = EmailAddress(
        relay_from_address, relay_from_display
    )
    sl_message.to_email_address.append(EmailAddress(relay_address.user.email))
    sl_client = _get_socketlabs_client()
    response = _socketlabs_send(sl_client, sl_message)
    # if _socketlabs_send returns a django HttpResponse return it immediately
    if type(response) == HttpResponse:
        return response
    if not response.result.name == 'Success':
        logger.error('socketlabs_error', extra=response.to_json())
        return HttpResponse("Internal Server Error", status=500)
    relay_address.num_forwarded += 1
    relay_address.last_used_at = datetime.now()
    relay_address.save(update_fields=['num_forwarded', 'last_used_at'])
    return HttpResponse("Created", status=201)


def _generate_relay_From(original_from_address):
    relay_display_name, relay_from_address = parseaddr(
        settings.RELAY_FROM_ADDRESS
    )
    return relay_from_address, '%s via Firefox Private Relay' % (
        original_from_address
    )


def time_if_enabled(name):
    def timing_decorator(func):
        def func_wrapper(*args, **kwargs):
            ctx_manager = (metrics.timer(name) if settings.STATSD_ENABLED
                           else contextlib.nullcontext())
            with ctx_manager:
                return func(*args, **kwargs)
        return func_wrapper
    return timing_decorator


@time_if_enabled('socketlabs_client')
def _get_socketlabs_client():
    return SocketLabsClient(
        settings.SOCKETLABS_SERVER_ID, settings.SOCKETLABS_API_KEY
    )


@time_if_enabled('socketlabs_client_send')
def _socketlabs_send(sl_client, sl_message):
    try:
        return sl_client.send(sl_message)
    except Exception:
        logger.exception("exception during sl send")
        return HttpResponse("Internal Server Error", status=500)
