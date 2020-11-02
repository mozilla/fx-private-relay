from email import message_from_bytes, message_from_string, policy
from email.utils import parseaddr
from hashlib import sha256
from sentry_sdk import capture_message
from tempfile import SpooledTemporaryFile
import json
import logging
import mimetypes
import os
import re

from markus.utils import generate_tag

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from .context_processors import relay_from_domain
from .models import DeletedAddress, Profile, RelayAddress
from .utils import (
    get_post_data_from_request,
    incr_if_enabled,
    histogram_if_enabled,
    ses_relay_email,
    urlize_and_linebreaks
)
from .sns import verify_from_sns, SUPPORTED_SNS_TYPES


logger = logging.getLogger('events')


@csrf_exempt
def index(request):
    incr_if_enabled('emails_index', 1)
    request_data = get_post_data_from_request(request)
    is_validated_create = (
        request_data.get('method_override', None) is None and
        request_data.get("api_token", False)
    )
    is_validated_user = (
        request.user.is_authenticated and
        request_data.get("api_token", False)
    )
    if is_validated_create:
        return _index_POST(request)
    if not is_validated_user:
        return redirect('profile')
    if request.method == 'POST':
        return _index_POST(request)
    incr_if_enabled('emails_index_get', 1)
    return redirect('profile')


def _get_user_profile(request, api_token):
    if not request.user.is_authenticated:
        return Profile.objects.get(api_token=api_token)
    return request.user.profile_set.first()


def _index_POST(request):
    request_data = get_post_data_from_request(request)
    api_token = request_data.get('api_token', None)
    if not api_token:
        raise PermissionDenied
    user_profile = _get_user_profile(request, api_token)
    if request_data.get('method_override', None) == 'PUT':
        return _index_PUT(request_data, user_profile)
    if request_data.get('method_override', None) == 'DELETE':
        return _index_DELETE(request_data, user_profile)

    incr_if_enabled('emails_index_post', 1)

    with transaction.atomic():
        locked_profile = Profile.objects.select_for_update().get(
            user=user_profile.user
        )
        if locked_profile.num_active_address >= settings.MAX_NUM_BETA_ALIASES:
            if 'moz-extension' in request.headers.get('Origin', ''):
                return HttpResponse('Payment Required', status=402)
            messages.error(
                request, "You already have 5 email addresses. Please upgrade."
            )
            return redirect('profile')
        relay_address = RelayAddress.make_relay_address(locked_profile.user)

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
    except RelayAddress.DoesNotExist:
        return HttpResponse("Address does not exist")


def _index_PUT(request_data, user_profile):
    incr_if_enabled('emails_index_put', 1)
    relay_address = _get_relay_address_from_id(request_data, user_profile)
    if not isinstance(relay_address, RelayAddress):
        return relay_address
    if request_data.get('enabled') == 'Disable':
        # TODO?: create a soft bounce receipt rule for the address?
        relay_address.enabled = False
    elif request_data.get('enabled') == 'Enable':
        # TODO?: remove soft bounce receipt rule for the address?
        relay_address.enabled = True
    relay_address.save()

    forwardingStatus = {'enabled': relay_address.enabled}
    return JsonResponse(forwardingStatus)


def _index_DELETE(request_data, user_profile):
    incr_if_enabled('emails_index_delete', 1)
    relay_address = _get_relay_address_from_id(request_data, user_profile)
    if isinstance(relay_address, RelayAddress):
        # TODO?: create hard bounce receipt rule for the address
        relay_address.delete()
    return redirect('profile')


@csrf_exempt
def sns_inbound(request):
    incr_if_enabled('sns_inbound', 1)
    # We can check for some invalid values in headers before processing body
    # Grabs message information for validation
    topic_arn = request.headers.get('X-Amz-Sns-Topic-Arn', None)
    message_type = request.headers.get('X-Amz-Sns-Message-Type', None)

    # Validates header
    validate_sns_header(topic_arn, message_type)

    json_body = json.loads(request.body)
    verified_json_body = verify_from_sns(json_body)

    return _sns_inbound_logic(topic_arn, message_type, verified_json_body)


def validate_sns_header(topic_arn, message_type):
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


def _sns_inbound_logic(topic_arn, message_type, json_body):
    if message_type == 'SubscriptionConfirmation':
        logger.info(
            'SNS SubscriptionConfirmation',
            extra={'SubscribeURL': json_body['SubscribeURL']}
        )
        return HttpResponse('Logged SubscribeURL', status=200)
    if message_type == 'Notification':
        incr_if_enabled('sns_inbound_Notification', 1)
        logger.info(
            'SNS Notification',
            extra={'json_body': json_body},
        )
        return _sns_notification(json_body)

    logger.error(
        'SNS message type did not fall under the SNS inbound logic',
        extra={'message_type': message_type}
    )
    capture_message(
        'Received SNS message with type not handled in inbound log',
        level="error",
        stack=True
    )
    return HttpResponse(
        'Received SNS message with type not handled in inbound log',
        status=400
    )


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
    incr_if_enabled('sns_inbound_Notification_Received', 1)
    mail = message_json['mail']
    if 'commonHeaders' not in mail:
        logger.error('SNS message without commonHeaders')
        return HttpResponse(
            'Received SNS notification without commonHeaders.',
            status=400
        )

    if 'to' not in mail['commonHeaders']:
        logger.error('SNS message without commonHeaders "to".')
        return HttpResponse(
            'Received SNS notification without commonHeaders "to".',
            status=400
        )

    to_address = parseaddr(mail['commonHeaders']['to'][0])[1]
    local_portion = to_address.split('@')[0]

    if local_portion == 'noreply':
        incr_if_enabled('email_for_noreply_address', 1)
        return HttpResponse('noreply address is not supported.')

    local_portion_hash = sha256(local_portion.encode('utf-8')).hexdigest()

    try:
        relay_address = RelayAddress.objects.get(address=local_portion)
        if not relay_address.enabled:
            incr_if_enabled('email_for_disabled_address', 1)
            relay_address.num_blocked += 1
            relay_address.save(update_fields=['num_blocked'])
            return HttpResponse("Address is temporarily disabled.")
    except RelayAddress.DoesNotExist:
        try:
            DeletedAddress.objects.get(
                address_hash=local_portion_hash
            )
            incr_if_enabled('email_for_deleted_address', 1)
            # TODO: create a hard bounce receipt rule in SES
        except DeletedAddress.DoesNotExist:
            incr_if_enabled('email_for_unknown_address', 1)
            logger.error(
                'Received email for unknown address.',
                extra={'to_address': to_address}
            )
        return HttpResponse("Address does not exist", status=404)

    incr_if_enabled('email_for_active_address', 1)
    logger.info('email_relay', extra={
        'fxa_uid': (
            relay_address.user.socialaccount_set.first().uid
        ),
        'relay_address_id': relay_address.id,
        'relay_address': local_portion_hash,
        'real_address': sha256(
            relay_address.user.email.encode('utf-8')
        ).hexdigest(),
    })

    from_address = parseaddr(mail['commonHeaders']['from'])[1]
    subject = mail['commonHeaders'].get('subject', '')
    bytes_email_message = message_from_bytes(
        message_json['content'].encode('utf-8'), policy=policy.default
    )

    text_content, html_content, attachments = _get_all_contents(
        bytes_email_message
    )
    strip_texts = []
    for item in mail['headers']:
        for k, v in item.items():
            strip_texts.append(': '.join([k, v]))
    stripped_content = message_json['content']
    for item in strip_texts:
        stipped_content = stripped_content.replace(item, '')

    # scramble alias so that clients don't recognize it
    # and apply default link styles
    display_email = re.sub('([@.:])', r'<span>\1</span>', to_address)

    message_body = {}
    if html_content:
        incr_if_enabled('email_with_html_content', 1)
        wrapped_html = render_to_string('emails/wrapped_email.html', {
            'original_html': html_content,
            'email_to': to_address,
            'display_email': display_email,
            'SITE_ORIGIN': settings.SITE_ORIGIN,
            'has_attachment': bool(attachments),
            'faq_page': settings.SITE_ORIGIN + reverse('faq')
        })
        message_body['Html'] = {'Charset': 'UTF-8', 'Data': wrapped_html}

    if text_content:
        incr_if_enabled('email_with_text_content', 1)
        attachment_msg = (
            'Firefox Relay supports email forwarding (including attachments) '
            'of email up to 150KB in size. To learn more visit {site}{faq}\n'
        ).format(site=settings.SITE_ORIGIN, faq=reverse('faq'))
        relay_header_text = (
            'This email was sent to your alias '
            '{relay_address}. To stop receiving emails sent to this alias, '
            'update the forwarding settings in your dashboard.\n'
            '{extra_msg}---Begin Email---\n'
        ).format(
            relay_address=to_address, extra_msg=attachment_msg
        )
        wrapped_text = relay_header_text + text_content
        message_body['Text'] = {'Charset': 'UTF-8', 'Data': wrapped_text}

    return ses_relay_email(
        from_address, relay_address, subject, message_body, attachments
    )


def _get_attachment(part):
    incr_if_enabled('email_with_attachment', 1)
    fn = part.get_filename()
    ct = part.get_content_type()
    payload = part.get_payload(decode=True)
    payload_size = len(payload)
    if fn:
        extension = os.path.splitext(fn)[1]
    else:
        extension = mimetypes.guess_extension(ct)
    tag_type = 'attachment'
    attachment_extension_tag = generate_tag(tag_type, extension)
    attachment_content_type_tag = generate_tag(tag_type, ct)
    histogram_if_enabled(
        'attachment.size',
        payload_size,
        [attachment_extension_tag, attachment_content_type_tag]
    )

    attachment = SpooledTemporaryFile(
        max_size=150*1000,  # 150KB max from SES
        suffix=extension,
        prefix=os.path.splitext(fn)[0]
    )
    attachment.write(payload)
    return fn, attachment


def _get_all_contents(email_message):
    text_content = None
    html_content = None
    attachments = {}
    if email_message.is_multipart():
        for part in email_message.walk():
            try:
                if part.is_attachment():
                    att_name, att = (
                        _get_attachment(part)
                    )
                    attachments[att_name] = att
                    continue
                if part.get_content_type() == 'text/plain':
                    text_content = part.get_content()
                if part.get_content_type() == 'text/html':
                    html_content = part.get_content()
            except KeyError:
                # log the un-handled content type but don't stop processing
                logger.error(
                    'part.get_content()',
                    extra={'type': part.get_content_type()}
                )
        histogram_if_enabled(
            'attachment.count_per_email', len(attachments)
        )
        if text_content is not None and html_content is None:
            html_content = urlize_and_linebreaks(text_content)
    else:
        if email_message.get_content_type() == 'text/plain':
            text_content = email_message.get_content()
            html_content = urlize_and_linebreaks(email_message.get_content())
        if email_message.get_content_type() == 'text/html':
            html_content = email_message.get_content()

    # TODO: if html_content is still None, wrap the text_content with our
    # header and footer HTML and send that as the html_content
    return text_content, html_content, attachments
