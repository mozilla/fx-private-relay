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

from .models import RelayAddress, Message


@csrf_exempt
def index(request):
    if not request.user:
        raise PermissionDenied
    user_profile = request.user.profile_set.first()
    if not request.POST['api_token']:
        raise PermissionDenied
    if not str(request.POST['api_token']) == str(user_profile.api_token):
        raise PermissionDenied
    RelayAddress.objects.create(user=request.user)
    return redirect('profile')


def messages(request):
    if not request.user:
        raise PermissionDenied
    relay_address_id = request.GET.get('relay_address_id', False)
    if not relay_address_id:
        raise Http404("Relay address not found")
    relay_address = RelayAddress.objects.get(id=relay_address_id)
    if relay_address.user != request.user:
        raise PermissionDenied
    messages = Message.objects.filter(relay_address=relay_address)
    return render(request, 'emails/messages.html',{
        'messages': messages,
        'relay_address': relay_address
    })


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
    print("email_to: %s" % email_to)
    print("from_address: %s" % from_address)

    # 404s make sendgrid retry the email, so respond with 200 even if
    # the address isn't found
    try:
        relay_address = RelayAddress.objects.get(address=local_portion)
    except RelayAddress.DoesNotExist as e:
        print(e)
        return HttpResponse("Address does not exist")

    # Store in local DB
    db_message = Message.objects.create(
        relay_address=relay_address,
        from_address=from_address,
        subject=subject,
        message=text
    )

    # Forward to real email address
    sl_message = BasicMessage()
    sl_message.subject = subject
    sl_message.html_body = html
    sl_message.plain_text_body = text
    sl_message.from_email_address = EmailAddress(
        '%s via %s' % (from_address, settings.RELAY_FROM_ADDRESS)
    )
    sl_message.to_email_address.append(EmailAddress(relay_address.user.email))
    socketlabs_client = SocketLabsClient(
        settings.SOCKETLABS_SERVER_ID, settings.SOCKETLABS_API_KEY
    )
    response = socketlabs_client.send(sl_message)
    print(response)
