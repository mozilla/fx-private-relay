from datetime import datetime, timezone
from email import message_from_bytes, policy
from email.utils import parseaddr
from hashlib import sha256
import json
import logging
import mimetypes
import os
import re
from tempfile import SpooledTemporaryFile

from botocore.exceptions import ClientError
from sentry_sdk import capture_message
from markus.utils import generate_tag

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from .models import (
    address_hash,
    CannotMakeAddressException,
    get_domain_numerical,
    get_domains_from_settings,
    DeletedAddress,
    DomainAddress,
    Profile,
    RelayAddress,
    Reply
)
from .utils import (
    _get_bucket_and_key_from_s3_json,
    b64_lookup_key,
    get_message_content_from_s3,
    get_post_data_from_request,
    incr_if_enabled,
    histogram_if_enabled,
    ses_relay_email,
    urlize_and_linebreaks,
    derive_reply_keys,
    decrypt_reply_metadata,
    remove_message_from_s3,
    ses_send_raw_email,
    get_message_id_bytes,
    generate_relay_From,
    S3ClientException,
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
    if not user_profile.user.is_active:
        raise PermissionDenied
    try:
        if request_data.get('method_override', None) == 'PUT':
            return _index_PUT(request_data, user_profile)
        if request_data.get('method_override', None) == 'DELETE':
            return _index_DELETE(request_data, user_profile)
    except (RelayAddress.DoesNotExist, DomainAddress.DoesNotExist):
        return HttpResponse("Address does not exist", status=404)

    incr_if_enabled('emails_index_post', 1)

    with transaction.atomic():
        locked_profile = Profile.objects.select_for_update().get(
            user=user_profile.user
        )
        try:
            relay_address = RelayAddress.objects.create(
                user=locked_profile.user,
            )
        except CannotMakeAddressException as e:
            if settings.SITE_ORIGIN not in request.headers.get('Origin', ''):
                # add-on request
                return HttpResponse(e.message, status=402)
            messages.error(
                request,
                e.message
            )
            return redirect('profile')

    if settings.SITE_ORIGIN not in request.headers.get('Origin', ''):
        return JsonResponse({
            'id': relay_address.id,
            'address': relay_address.full_address,
            'domain': relay_address.domain_value,
            'local_portion': relay_address.address
        }, status=201)

    return redirect('profile')


def _get_address_from_id(request_data, user_profile):
    if request_data.get('relay_address_id', False):
        relay_address = RelayAddress.objects.get(
            id=request_data['relay_address_id'],
            user=user_profile.user
        )
        return relay_address
    domain_address = DomainAddress.objects.get(
        id=request_data['domain_address_id'],
        user=user_profile.user
    )
    return domain_address


def _index_PUT(request_data, user_profile):
    incr_if_enabled('emails_index_put', 1)
    address = _get_address_from_id(request_data, user_profile)
    if request_data.get('enabled') == 'Disable':
        # TODO?: create a soft bounce receipt rule for the address?
        address.enabled = False
    elif request_data.get('enabled') == 'Enable':
        # TODO?: remove soft bounce receipt rule for the address?
        address.enabled = True
    address.save()

    forwardingStatus = {'enabled': address.enabled}
    return JsonResponse(forwardingStatus)


def _index_DELETE(request_data, user_profile):
    incr_if_enabled('emails_index_delete', 1)
    address = _get_address_from_id(request_data, user_profile)
    # TODO?: create hard bounce receipt rule for the address
    address.delete()
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
    event_type = message_json.get('eventType')
    notification_type = message_json.get('notificationType')
    if notification_type != 'Received' and event_type != 'Bounce':
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
    if message_json.get('eventType') == 'Bounce':
        return _handle_bounce(message_json)
    if 'commonHeaders' not in mail:
        logger.error('SNS message without commonHeaders')
        return HttpResponse(
            'Received SNS notification without commonHeaders.',
            status=400
        )
    common_headers = mail['commonHeaders']
    if 'to' not in common_headers:
        logger.error('SNS message without commonHeaders "to".')
        return HttpResponse(
            'Received SNS notification without commonHeaders "to".',
            status=400
        )

    from_address = parseaddr(common_headers['from'][0])[1]
    to_address = parseaddr(common_headers['to'][0])[1]
    [to_local_portion, to_domain_portion] = to_address.split('@')
    if to_local_portion == 'noreply':
        incr_if_enabled('email_for_noreply_address', 1)
        return HttpResponse('noreply address is not supported.')
    try:
        # FIXME: this ambiguous return of either
        # RelayAddress or DomainAddress types makes the Rustacean in me throw
        # up a bit.
        address = _get_address(to_address, to_local_portion, to_domain_portion)
        user_profile = address.user.profile_set.first()
    except Exception:
        if to_local_portion == 'replies':
            return _handle_reply(from_address, message_json)

        return HttpResponse("Address does not exist", status=404)

    address_hash = sha256(to_address.encode('utf-8')).hexdigest()

    # first see if this user is over bounce limits
    bounce_paused, bounce_type = user_profile.check_bounce_pause()
    if bounce_paused:
        incr_if_enabled('email_suppressed_for_%s_bounce' % bounce_type, 1)
        return HttpResponse("Address is temporarily disabled.")

    if address and not address.enabled:
        incr_if_enabled('email_for_disabled_address', 1)
        address.num_blocked += 1
        address.save(update_fields=['num_blocked'])
        return HttpResponse("Address is temporarily disabled.")

    incr_if_enabled('email_for_active_address', 1)
    logger.info('email_relay', extra={
        'fxa_uid': user_profile.fxa.uid,
        'address': address_hash,
        'real_address': sha256(
            user_profile.user.email.encode('utf-8')
        ).hexdigest(),
    })

    subject = common_headers.get('subject', '')

    try:
        text_content, html_content, attachments = _get_text_html_attachments(
            message_json
        )
    except S3ClientException as e:
        logger.error('s3_client_error_get_email', extra=e.response['Error'])
        return HttpResponse("Cannot find the message content from S3", status=400)

    # scramble alias so that clients don't recognize it
    # and apply default link styles
    display_email = re.sub('([@.:])', r'<span>\1</span>', to_address)

    message_body = {}
    if html_content:
        incr_if_enabled('email_with_html_content', 1)
        wrapped_html = render_to_string('emails/wrapped_email.html', {
            'original_html': html_content,
            'recipient_profile': user_profile,
            'email_to': to_address,
            'display_email': display_email,
            'SITE_ORIGIN': settings.SITE_ORIGIN,
            'has_attachment': bool(attachments),
            'survey_text': settings.RECRUITMENT_EMAIL_BANNER_TEXT,
            'survey_link': settings.RECRUITMENT_EMAIL_BANNER_LINK
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
            '{alias}. To stop receiving emails sent to this alias, '
            'update the forwarding settings in your dashboard.\n'
            '{extra_msg}---Begin Email---\n'
        ).format(
            alias=to_address, extra_msg=attachment_msg
        )
        wrapped_text = relay_header_text + text_content
        message_body['Text'] = {'Charset': 'UTF-8', 'Data': wrapped_text}

    to_address = user_profile.user.email
    formatted_from_address = generate_relay_From(from_address)
    response = ses_relay_email(
        formatted_from_address, to_address, subject,
        message_body, attachments, mail, address
    )
    address.num_forwarded += 1
    address.last_used_at = datetime.now(timezone.utc)
    address.save(
        update_fields=['num_forwarded', 'last_used_at']
    )

    # only remove message from S3 if the email was stored in S3
    bucket, object_key = _get_bucket_and_key_from_s3_json(message_json)
    if bucket and object_key:
        remove_message_from_s3(bucket, object_key)

    return response


def _get_keys_from_headers(headers):
    for header in headers:
        if header['name'].lower() == 'in-reply-to':
            in_reply_to = header['value']
            message_id_bytes = get_message_id_bytes(in_reply_to)
    if in_reply_to is None:
        incr_if_enabled('mail_to_replies_without_in_reply_to', 1)
        raise Exception("Received mail to reply address without In-Reply-To")
    return derive_reply_keys(message_id_bytes)


def _get_reply_record_from_lookup_key(lookup_key):
    lookup = b64_lookup_key(lookup_key)
    return Reply.objects.get(lookup=lookup)


def _strip_localpart_tag(address):
    [localpart, domain] = address.split('@')
    subaddress_parts = localpart.split('+')
    return f'{subaddress_parts[0]}@{domain}'


def _handle_reply(from_address, message_json):
    stripped_from_address = _strip_localpart_tag(from_address)

    mail = message_json['mail']
    (lookup_key, encryption_key) = _get_keys_from_headers(mail['headers'])
    reply_record = _get_reply_record_from_lookup_key(lookup_key)
    address = reply_record.address
    reply_record_email = address.user.email
    stripped_reply_record_address = _strip_localpart_tag(reply_record_email)

    if (
        (from_address == reply_record_email) or
        (stripped_from_address == stripped_reply_record_address)
    ):
        # This is a Relay user replying to an external sender;
        # verify they are premium
        if not reply_record.owner_has_premium:
            # TODO: send the user an email
            # that replies are a premium feature
            incr_if_enabled('free_user_reply_attempt', 1)
            return HttpResponse(
                "Rely replies require a premium account", status=403
            )

    outbound_from_address = address.full_address
    decrypted_metadata = json.loads(decrypt_reply_metadata(
        encryption_key, reply_record.encrypted_metadata
    ))
    incr_if_enabled('reply_email', 1)
    subject = mail['commonHeaders'].get('subject', '')
    to_address = (
        decrypted_metadata.get('reply-to') or decrypted_metadata.get('from')
    )

    text_content, html_content, attachments = _get_text_html_attachments(
        message_json
    )

    message_body = {}
    if html_content:
        message_body['Html'] = {'Charset': 'UTF-8', 'Data': html_content}

    if text_content:
        message_body['Text'] = {'Charset': 'UTF-8', 'Data': text_content}

    try:
        response = ses_send_raw_email(
            outbound_from_address,
            to_address,
            subject,
            message_body,
            attachments,
            outbound_from_address,
            mail,
            address
        )
        address.num_forwarded += 1
        address.last_used_at = datetime.now(timezone.utc)
        address.save(
            update_fields=['num_forwarded', 'last_used_at']
        )
        return response
    except ClientError as e:
        logger.error('ses_client_error', extra=e.response['Error'])
        return HttpResponse("SES client error", status=400)


def _get_domain_address(local_portion, domain_portion):
    [address_subdomain, address_domain] = domain_portion.split('.', 1)
    try:
        user_profile = Profile.objects.get(subdomain=address_subdomain)
        domain_numerical = get_domain_numerical(address_domain)
        # filter DomainAddress because it may not exist
        # which will throw an error with get()
        domain_address = DomainAddress.objects.filter(
            user=user_profile.user, address=local_portion, domain=domain_numerical
        ).first()
        if domain_address is None:
            # TODO: We may want to consider flows when
            # a user generating alias on a fly was unable to
            # receive an email due to the following exceptions
            domain_address = DomainAddress.make_domain_address(
                user_profile, local_portion, True
            )
        domain_address.last_used_at = datetime.now(timezone.utc)
        domain_address.save()
        return domain_address
    except Profile.DoesNotExist:
        incr_if_enabled('email_for_dne_subdomain', 1)
        raise Exception("Address does not exist")


def _get_address(to_address, local_portion, domain_portion):
    # if the domain is not the site's 'top' relay domain,
    # it may be for a user's subdomain
    email_domains = get_domains_from_settings().values()
    if domain_portion not in email_domains:
        return _get_domain_address(local_portion, domain_portion)

    # the domain is the site's 'top' relay domain, so look up the RelayAddress
    try:
        domain_numerical = get_domain_numerical(domain_portion)
        relay_address = RelayAddress.objects.get(address=local_portion, domain=domain_numerical)
        return relay_address
    except RelayAddress.DoesNotExist:
        try:
            DeletedAddress.objects.get(
                address_hash=address_hash(local_portion, domain=domain_portion)
            )
            incr_if_enabled('email_for_deleted_address', 1)
            # TODO: create a hard bounce receipt rule in SES
        except DeletedAddress.DoesNotExist:
            incr_if_enabled('email_for_unknown_address', 1)
        except DeletedAddress.MultipleObjectsReturned:
            # not sure why this happens on stage but let's handle it
            incr_if_enabled('email_for_deleted_address_multiple', 1)
        raise Exception("Address does not exist")


def _handle_bounce(message_json):
    incr_if_enabled('email_bounce', 1)
    bounce = message_json.get('bounce')
    bounced_recipients = bounce.get('bouncedRecipients')
    for recipient in bounced_recipients:
        try:
            user = User.objects.get(email=recipient.get('emailAddress'))
            profile = user.profile_set.first()
        except User.DoesNotExist:
            incr_if_enabled('email_bounce_relay_user_gone', 1)
            # TODO: handle bounce for a user who no longer exists
            # add to SES account-wide suppression list?
            return HttpResponse("Address does not exist", status=404)
        now = datetime.now(timezone.utc)
        incr_if_enabled(
            'email_bounce_%s_%s' % (
                bounce.get('bounceType'), bounce.get('bounceSubType')
            ),
            1
        )
        if bounce.get('bounceType') == 'Permanent':
            profile.last_hard_bounce = now
        if bounce.get('bounceType') == 'Transient':
            profile.last_soft_bounce = now
            # TODO: handle sub-types: 'MessageTooLarge', 'AttachmentRejected',
            # 'ContentRejected'
        profile.save()
    return HttpResponse("OK", status=200)


def _get_text_html_attachments(message_json):
    if 'content' in message_json:
        # email content in sns message
        message_content = message_json['content'].encode('utf-8')
    else:
        # assume email content in S3
        bucket, object_key = _get_bucket_and_key_from_s3_json(message_json)
        message_content = get_message_content_from_s3(bucket, object_key)
        histogram_if_enabled(
            'relayed_email.size',
            len(message_content)
        )

    bytes_email_message = message_from_bytes(message_content, policy=policy.default)

    text_content, html_content, attachments = _get_all_contents(
        bytes_email_message
    )
    return text_content, html_content, attachments


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
