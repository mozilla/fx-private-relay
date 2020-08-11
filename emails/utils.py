import contextlib
from datetime import datetime, timezone
from email.headerregistry import Address
from email.utils import parseaddr
import json

from botocore.exceptions import ClientError
import markus
import logging

from django.apps import apps
from django.conf import settings
from django.http import HttpResponse
from django.template.defaultfilters import linebreaksbr, urlize
from django.template.loader import render_to_string


logger = logging.getLogger('events')
metrics = markus.get_metrics('fx-private-relay')


def time_if_enabled(name):
    def timing_decorator(func):
        def func_wrapper(*args, **kwargs):
            ctx_manager = (metrics.timer(name) if settings.STATSD_ENABLED
                           else contextlib.nullcontext())
            with ctx_manager:
                return func(*args, **kwargs)
        return func_wrapper
    return timing_decorator


def incr_if_enabled(name, value=1):
    if settings.STATSD_ENABLED:
        metrics.incr(name, value)


def histogram_if_enabled(name, value, tags=None):
    if settings.STATSD_ENABLED:
        metrics.histogram(name, value=value, tags=None)


@time_if_enabled('ses_send_email')
def ses_send_email(from_address, to_address, subject, message_body):
    emails_config = apps.get_app_config('emails')
    try:
        ses_response = emails_config.ses_client.send_email(
            Destination={'ToAddresses': [to_address]},
            Message={
                'Body': message_body,
                'Subject': {'Charset': 'UTF-8', 'Data': subject},
            },
            Source=from_address,
            ConfigurationSetName=settings.AWS_SES_CONFIGSET,
        )
        logger.debug('ses_sent_response', extra=ses_response['MessageId'])
        incr_if_enabled('ses_send_email', 1)
    except ClientError as e:
        logger.error('ses_client_error', extra=e.response['Error'])
        return HttpResponse("SES client error", status=400)
    return HttpResponse("Sent email to final recipient.", status=200)


def ses_relay_email(from_address, relay_address, subject, message_body):
    relay_from_address, relay_from_display = generate_relay_From(from_address)
    formatted_from_address = str(
        Address(relay_from_display, addr_spec=relay_from_address)
    )
    try:
        response = ses_send_email(
            formatted_from_address,
            relay_address.user.email,
            subject,
            message_body
        )
        relay_address.num_forwarded += 1
        relay_address.last_used_at = datetime.now()
        relay_address.save(update_fields=['num_forwarded', 'last_used_at'])
        return response
    except ClientError as e:
        logger.error('ses_client_error', extra=e.response['Error'])
        return HttpResponse("SES client error", status=400)


def urlize_and_linebreaks(text, autoescape=True):
    return linebreaksbr(
        urlize(text, autoescape=autoescape),
        autoescape=autoescape
    )


def get_post_data_from_request(request):
    if request.content_type == 'application/json':
        return json.loads(request.body)
    return request.POST


def generate_relay_From(original_from_address):
    relay_display_name, relay_from_address = parseaddr(
        settings.RELAY_FROM_ADDRESS
    )
    return relay_from_address, '%s [via Relay]' % (
        original_from_address
    )


def email_invited_user(invitation, invitee=None):
    email = invitee.primary_email if invitee else invitation.email
    context = {
        'email': email,
        'current_domain': settings.SITE_ORIGIN,
    }

    subject = ("Firefox Relay beta: Protect your real email address from "
               "hackers and trackers")

    message_body = {}

    message_body['Html'] = {
        'Charset': 'UTF-8',
        'Data': render_to_string(
            'emails/beta_invite_html_email.html',
            context
        )
    }
    message_body['Text'] = {
        'Charset': 'UTF-8',
        'Data': render_to_string(
            'emails/beta_invite_text_email.txt',
            context
        )
    }

    relay_display_name, relay_from_address = parseaddr(
        settings.RELAY_FROM_ADDRESS
    )
    from_address = '%s <%s>' % (relay_display_name, relay_from_address)

    response = ses_send_email(
        from_address, email, subject, message_body
    )

    if not response.status_code == 200:
        logger.error('ses_error', extra=response)
        return response

    invitation.date_sent = datetime.now(timezone.utc)
    invitation.save(update_fields=['date_sent'])

    if invitee:
        invitee.waitlists_joined['email_relay']['notified'] = True
        invitee.save(update_fields=['waitlists_joined'])

    return response
