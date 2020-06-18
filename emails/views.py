from datetime import datetime
from email import message_from_string, policy
from email.utils import parseaddr
from email.headerregistry import Address
from hashlib import sha256
import json
import logging
import markus
import re

import boto3
from botocore.exceptions import ClientError
from decouple import config
from socketlabs.injectionapi.message.basicmessage import BasicMessage
from socketlabs.injectionapi.message.emailaddress import EmailAddress

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render, get_object_or_404
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt

from .context_processors import relay_from_domain
from .models import DeletedAddress, Profile, RelayAddress
from .utils import get_socketlabs_client, socketlabs_send
from .sns import verify_from_sns, SUPPORTED_SNS_TYPES


logger = logging.getLogger('events')
metrics = markus.get_metrics('fx-private-relay')


def _get_data_from_request(request):
    if request.content_type == 'application/json':
        return json.loads(request.body)
    return request.POST


@csrf_exempt
def index(request):
    request_data = _get_data_from_request(request)
    if (not request.user.is_authenticated and
        not request_data.get("api_token", False)
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
    request_data = _get_data_from_request(request)
    api_token = request_data.get('api_token', None)
    if not api_token:
        raise PermissionDenied
    user_profile = _get_user_profile(request, api_token)
    if request_data.get('method_override', None) == 'PUT':
        return _index_PUT(request_data, user_profile)
    if request_data.get('method_override', None) == 'DELETE':
        return _index_DELETE(request_data, user_profile)

    existing_addresses = RelayAddress.objects.filter(user=user_profile.user)
    if existing_addresses.count() >= settings.MAX_NUM_BETA_ALIASES:
        if 'moz-extension' in request.headers.get('Origin', ''):
            return HttpResponse('Payment Required', status=402)
        messages.error(
            request, "You already have 5 email addresses. Please upgrade."
        )
        return redirect('profile')

    relay_address = RelayAddress.make_relay_address(user_profile.user)
    if 'moz-extension' in request.headers.get('Origin', ''):
        address_string = '%s@%s' % (
            relay_address.address, relay_from_domain(request)['RELAY_DOMAIN']
        )
        return JsonResponse({
            'id': relay_address.id,
            'address': address_string
        }, status=201)

    return redirect('profile')


def _get_relay_address_from_id(request_data, user_profile):
    try:
        relay_address = RelayAddress.objects.get(
            id=request_data['relay_address_id'],
            user=user_profile.user
        )
        return relay_address
    except RelayAddress.DoesNotExist as e:
        print(e)
        return HttpResponse("Address does not exist")


def _index_PUT(request_data, user_profile):
    relay_address = _get_relay_address_from_id(request_data, user_profile)
    if request_data.get('enabled') == 'Disable':
        # TODO?: create a soft bounce receipt rule for the address?
        relay_address.enabled = False
    elif request_data.get('enabled') == 'Enable':
        # TODO?: remove soft bounce receipt rule for the address?
        relay_address.enabled = True
    relay_address.save(update_fields=['enabled'])

    forwardingStatus = {'enabled': relay_address.enabled}
    return JsonResponse(forwardingStatus)


def _index_DELETE(request_data, user_profile):
    relay_address = _get_relay_address_from_id(request_data, user_profile)
    # TODO?: create hard bounce receipt rule for the address
    relay_address.delete()
    return redirect('profile')


@csrf_exempt
def sns_inbound(request):
    # We can check for some invalid values in headers before processing body
    topic_arn = request.headers.get('X-Amz-Sns-Topic-Arn', None)
    if not topic_arn:
        logger.error('SNS inbound request without X-Amz-Sns-Topic-Arn')
        return HttpResponse(
            'Received SNS request without Topic ARN.', status=400
        )
    if topic_arn != settings.AWS_SNS_TOPIC:
        logger.error(
            'SNS message for wrong ARN',
            extra={
                'configured_arn': settings.AWS_SNS_TOPIC,
                'received_arn': topic_arn,
            }
        )
        return HttpResponse(
            'Received SNS message for wrong topic.', status=400
        )

    message_type = request.headers.get('X-Amz-Sns-Message-Type', None)
    if not message_type:
        logger.error('SNS inbound request without X-Amz-Sns-Message-Type')
        return HttpResponse(
            'Received SNS request without Message Type.', status=400
        )
    if message_type not in SUPPORTED_SNS_TYPES:
        logger.error(
            'SNS message for unsupported type',
            extra={
                'supported_sns_types': SUPPORTED_SNS_TYPES,
                'message_type': message_type,
            }
        )
        return HttpResponse(
            'Received SNS message for unsupported Type: %s' % message_type,
            status=400
        )

    json_body = json.loads(request.body)
    try:
        verified_json_body = verify_from_sns(json_body)
    except Exception:
        logger.error(
            'SNS message with invalid signature',
            extra={
                'SigningCertURL': json_body['SigningCertURL'],
                'Signature': json_body['Signature'],
            }
        )
        return HttpResponse(
            'Received SNS message with invalid signature: %s' % message_type,
            status=401
        )

    return _sns_inbound_logic(topic_arn, message_type, verified_json_body)


def _sns_inbound_logic(topic_arn, message_type, json_body):
    if message_type == 'SubscriptionConfirmation':
        logger.info(
            'SNS SubscriptionConfirmation',
            extra={'SubscribeURL': json_body['SubscribeURL']}
        )
        return HttpResponse('Logged SubscribeURL', status=200)
    if message_type == 'Notification':
        logger.info(
            'SNS Notification',
            extra={'json_body': json_body},
        )
        return _sns_notification(json_body)


def _sns_notification(json_body):
    message_json = json.loads(json_body['Message'])
    notification_type = message_json['notificationType']
    if notification_type != 'Received':
        logger.error(
            'SNS notification for unsupported type',
            extra={'notification_type': notification_type},
        )
        return HttpResponse(
            'Received SNS notification for unsupported Type: %s' %
            notification_type,
            status=400
        )

    return _sns_message(message_json)


def _sns_message(message_json):
    mail = message_json['mail']
    if 'commonHeaders' not in mail:
        logger.error('SNS message without commonHeaders')
        return HttpResponse(
            'Received SNS notification without commonHeaders.',
            status=400
        )

    to_address = parseaddr(mail['commonHeaders']['to'][0])[1]
    local_portion = to_address.split('@')[0]

    try:
        relay_address = RelayAddress.objects.get(address=local_portion)
        if not relay_address.enabled:
            relay_address.num_blocked += 1
            relay_address.save(update_fields=['num_blocked'])
            return HttpResponse("Address is temporarily disabled.")
    except RelayAddress.DoesNotExist:
        # TODO?: if sha256 of the address is in DeletedAddresses,
        # create a hard bounce receipt rule
        logger.error('email_relay', extra={'message_json': message_json})
        return HttpResponse("Address does not exist", status=404)

    logger.info('email_relay', extra={
        'fxa_uid': (
            relay_address.user.socialaccount_set.first().uid
        ),
        'relay_address_id': relay_address.id,
        'relay_address': sha256(local_portion.encode('utf-8')).hexdigest(),
        'real_address': sha256(
            relay_address.user.email.encode('utf-8')
        ).hexdigest(),
    })

    from_address = parseaddr(mail['commonHeaders']['from'])[1]
    subject = mail['commonHeaders']['subject']
    email_message = message_from_string(
        message_json['content'], policy=policy.default
    )

    text_content, html_content = _get_text_and_html_content(email_message)

    # scramble alias so that clients don't recognize it and apply default link styles
    display_email = re.sub('([@.:])', r'<span>\1</span>', to_address)

    message_body = {}
    if html_content:
        wrapped_html = render_to_string('emails/wrapped_email.html', {
            'original_html': html_content,
            'email_to': to_address,
            'display_email': display_email,
            'SITE_ORIGIN': settings.SITE_ORIGIN,
        })
        message_body['Html'] = {'Charset': 'UTF-8', 'Data': wrapped_html}

    if text_content:
        message_body['Text'] = {'Charset': 'UTF-8', 'Data': text_content}

    relay_from_address, relay_from_display = _generate_relay_From(from_address)
    formatted_from_address = str(
        Address(relay_from_display, addr_spec=relay_from_address)
    )

    ses_client = boto3.client('ses', region_name=settings.AWS_REGION)
    try:
        ses_response = ses_client.send_email(
            Destination={'ToAddresses': [relay_address.user.email]},
            Message={
                'Body': message_body,
                'Subject': {'Charset': 'UTF-8', 'Data': subject},
            },
            Source=formatted_from_address,
            ConfigurationSetName=settings.AWS_SES_CONFIGSET,
        )
        logger.debug('ses_sent_response', extra=ses_response['MessageId'])
        relay_address.num_forwarded += 1
        relay_address.last_used_at = datetime.now()
        relay_address.save(update_fields=['num_forwarded', 'last_used_at'])
    except ClientError as e:
        logger.error('ses_client_error', extra=e.response['Error'])
        return HttpResponse("SES client error", status=400)

    return HttpResponse("Sent email to final recipient.", status=200)


def _get_text_and_html_content(email_message):
    text_content = None
    html_content = None
    if email_message.is_multipart():
        for message_payload in email_message.get_payload():
            content = message_payload.get_content()
            if message_payload.get_content_type() == 'text/plain':
                text_content = content
            if message_payload.get_content_type() == 'text/html':
                html_content = content
    else:
        if email_message.get_content_type() == 'text/plain':
            text_content = email_message.get_content()
        if email_message.get_content_type() == 'text/html':
            html_content = email_message.get_content()

    # TODO: if html_content is still None, wrap the text_content with our
    # header and footer HTML and send that as the html_content
    return text_content, html_content


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
        # TODO?: if sha256 of the address is in DeletedAddresses,
        # create a hard bounce receipt rule
        print(e)
        return HttpResponse("Address does not exist")

    logger.info('email_relay', extra={
        'fxa_uid': (
            relay_address.user.socialaccount_set.first().uid
        ),
        'relay_address_id': relay_address.id,
        'relay_address': sha256(local_portion.encode('utf-8')).hexdigest(),
        'real_address': sha256(
            relay_address.user.email.encode('utf-8')
        ).hexdigest(),
    })
    # Forward to real email address
    sl_message = BasicMessage()
    sl_message.subject = subject

    # scramble alias so that clients don't recognize it and apply default link styles
    display_email = re.sub('([@.:])', r'<span>\1</span>', email_to)
    wrapped_html = render_to_string('emails/wrapped_email.html', {
        'original_html': html,
        'email_to': email_to,
        'display_email': display_email,
        'SITE_ORIGIN': settings.SITE_ORIGIN,
    })

    sl_message.html_body = wrapped_html
    sl_message.plain_text_body = text

    relay_from_address, relay_from_display = _generate_relay_From(from_address)
    sl_message.from_email_address = EmailAddress(
        relay_from_address, relay_from_display
    )
    sl_message.to_email_address.append(EmailAddress(relay_address.user.email))
    sl_client = get_socketlabs_client()
    response = socketlabs_send(sl_client, sl_message)
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
