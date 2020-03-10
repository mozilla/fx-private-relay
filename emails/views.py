from datetime import datetime
from email.utils import parseaddr
import json

from decouple import config
from socketlabs.injectionapi import SocketLabsClient
from socketlabs.injectionapi.message.basicmessage import BasicMessage
from socketlabs.injectionapi.message.emailaddress import EmailAddress

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import redirect, render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .models import RelayAddress


@csrf_exempt
def index(request):
    if not request.user:
        raise PermissionDenied
    if request.method == 'POST':
        return _index_POST(request)
    return redirect('profile')


def _index_POST(request):
    api_token = request.POST.get('api_token', None)
    if not api_token:
        raise PermissionDenied
    user_profile = request.user.profile_set.first()
    if not str(api_token) == str(user_profile.api_token):
        raise PermissionDenied
    if request.POST.get('method_override', None) == 'DELETE':
        return _index_DELETE(request)

    RelayAddress.objects.create(user=request.user)
    return redirect('profile')


#TODO: add csrf here? or make ids uuid so they can't be guessed?
def _index_DELETE(request):
    try:
        relay_address = RelayAddress.objects.get(
            id=request.POST['relay_address_id']
        )
        relay_address.delete()
        return redirect('profile')
    except RelayAddress.DoesNotExist as e:
        print(e)
        return HttpResponse("Address does not exist")


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
    db_message = _inbound_logic(json_body)

    return HttpResponse("Created", status=201)


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
    socketlabs_client = SocketLabsClient(
        settings.SOCKETLABS_SERVER_ID, settings.SOCKETLABS_API_KEY
    )
    response = socketlabs_client.send(sl_message)
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
