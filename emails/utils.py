from datetime import datetime
from email.headerregistry import Address
from email.utils import parseaddr

from botocore.exceptions import ClientError
import contextlib
import markus
import logging
import json
from socketlabs.injectionapi import SocketLabsClient

from django.apps import apps
from django.conf import settings
from django.http import HttpResponse
from django.template.defaultfilters import linebreaksbr, urlize


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


@time_if_enabled('socketlabs_client')
def get_socketlabs_client():
    return SocketLabsClient(
        settings.SOCKETLABS_SERVER_ID, settings.SOCKETLABS_API_KEY
    )


@time_if_enabled('socketlabs_client_send')
def socketlabs_send(sl_client, sl_message):
    try:
        return sl_client.send(sl_message)
    except Exception:
        logger.exception("exception during sl send")
        return HttpResponse("Internal Server Error", status=500)


@time_if_enabled('ses_send_email')
def ses_send_email(from_address, relay_address, subject, message_body):
    emails_config = apps.get_app_config('emails')
    relay_from_address, relay_from_display = generate_relay_From(from_address)
    formatted_from_address = str(
        Address(relay_from_display, addr_spec=relay_from_address)
    )
    try:
        ses_response = emails_config.ses_client.send_email(
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
        incr_if_enabled('ses_send_email', 1)
    except ClientError as e:
        logger.error('ses_client_error', extra=e.response['Error'])
        return HttpResponse("SES client error", status=400)
    return HttpResponse("Sent email to final recipient.", status=200)


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
