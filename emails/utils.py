import contextlib
from datetime import datetime, timezone
from email.header import Header
from email.headerregistry import Address
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import parseaddr
import json

from botocore.exceptions import ClientError
import markus
import logging

from django.apps import apps
from django.conf import settings
from django.http import HttpResponse
from django.template.defaultfilters import linebreaksbr, urlize
from urllib.parse import urlparse


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


def get_email_domain_from_settings():
    email_network_locality = urlparse(settings.SITE_ORIGIN).netloc
    # on Heroku we need to add "mail" prefix
    # because we can’t publish MX records on Heroku
    if settings.ON_HEROKU:
        email_network_locality = f'mail.{email_network_locality}'
    return email_network_locality


@time_if_enabled('ses_send_email')
def ses_send_email(from_address, to_address, subject, message_body):
    emails_config = apps.get_app_config('emails')
    try:
        emails_config.ses_client.send_email(
            Destination={'ToAddresses': [to_address]},
            Message={
                'Body': message_body,
                'Subject': {'Charset': 'UTF-8', 'Data': subject},
            },
            Source=from_address,
            ConfigurationSetName=settings.AWS_SES_CONFIGSET,
        )
        incr_if_enabled('ses_send_email', 1)
    except ClientError as e:
        logger.error('ses_client_error', extra=e.response['Error'])
        return HttpResponse("SES client error", status=400)
    return HttpResponse("Sent email to final recipient.", status=200)


@time_if_enabled('ses_send_email')
def ses_send_raw_email(
        from_address, to_address, subject, message_body, attachments
):
    charset = "UTF-8"

    # Create a multipart/mixed parent container.
    msg = MIMEMultipart('mixed')
    # Add subject, from and to lines.
    msg['Subject'] = subject
    msg['From'] = from_address
    msg['To'] = to_address

    # Create a multipart/alternative child container.
    msg_body = MIMEMultipart('alternative')

    # Encode the text and HTML content and set the character encoding.
    # This step is necessary if you're sending a message with characters
    # outside the ASCII range.
    if 'Text' in message_body:
        body_text = message_body['Text']['Data']
        textpart = MIMEText(body_text.encode(charset), 'plain', charset)
        msg_body.attach(textpart)
    if 'Html' in message_body:
        body_html = message_body['Html']['Data']
        htmlpart = MIMEText(body_html.encode(charset), 'html', charset)
        msg_body.attach(htmlpart)

    # Attach the multipart/alternative child container to the multipart/mixed
    # parent container.
    msg.attach(msg_body)

    # attach attachments
    for actual_att_name, attachment in attachments.items():
        # Define the attachment part and encode it using MIMEApplication.
        attachment.seek(0)
        att = MIMEApplication(attachment.read())

        # Add a header to tell the email client to treat this
        # part as an attachment, and to give the attachment a name.
        att.add_header(
            'Content-Disposition',
            'attachment',
            filename=actual_att_name
        )
        # Add the attachment to the parent container.
        msg.attach(att)
        attachment.close()

    try:
        # Provide the contents of the email.
        emails_config = apps.get_app_config('emails')
        emails_config.ses_client.send_raw_email(
            Source=from_address,
            Destinations=[
                to_address
            ],
            RawMessage={
                'Data': msg.as_string(),
            },
        )
        incr_if_enabled('ses_send_email', 1)
    except ClientError as e:
        logger.error('ses_client_error_raw_email', extra=e.response['Error'])
        return HttpResponse("SES client error on Raw Email", status=400)
    return HttpResponse("Sent email to final recipient.", status=200)


def ses_relay_email(from_address, address, subject,
                    message_body, attachments, user_email,
                    open_trackers_found, click_trackers_found):
    formatted_from_address = generate_relay_From(from_address)
    try:
        if attachments:
            response = ses_send_raw_email(
                formatted_from_address,
                user_email,
                subject,
                message_body,
                attachments
            )
        else:
            response = ses_send_email(
                formatted_from_address,
                user_email,
                subject,
                message_body
            )
        address.num_forwarded += 1
        address.last_used_at = datetime.now(timezone.utc)
        address.num_open_trackers += open_trackers_found
        address.num_click_trackers += click_trackers_found
        address.save(
            update_fields=[
                'num_forwarded',
                'last_used_at',
                'num_open_trackers',
                'num_click_trackers'
            ]
        )
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
    # RFC 2822 (https://tools.ietf.org/html/rfc2822#section-2.1.1)
    # says email header lines must not be more than 998 chars long.
    # Encoding display names to longer than 998 chars will add wrap
    # characters which are unsafe. (See https://bugs.python.org/issue39073)
    # So, truncate the original sender to 900 chars so we can add our
    # "[via Relay] <relayfrom>" and encode it all.
    if len(original_from_address) > 998:
        original_from_address = '%s ...' % original_from_address[:900]
    # line breaks in From: will encode to unsafe chars, so strip them.
    original_from_address = (
        original_from_address
        .replace('\u2028', '')
        .replace('\r', '')
        .replace('\n', '')
    )

    display_name = Header(
        '"%s [via Relay]"' % (original_from_address), 'UTF-8'
    )
    formatted_from_address = str(
        Address(
            display_name.encode(maxlinelen=998), addr_spec=relay_from_address
        )
    )
    return formatted_from_address

def convert_domains_to_regex_patterns(domain_pattern):
    return '(["])(\\S*://\\S*.' + domain_pattern + '\\S*)\\1'

def get_email_trackers(tracker_type):
    if tracker_type == 'click':
        with open('emails/tracker_lists/click-trackers.json') as f:
            trackers = json.load(f)
    if tracker_type == 'open':
        with open('emails/tracker_lists/open-trackers.json') as f:
            trackers = json.load(f)
    tracker_patterns = []
    for tracker in trackers:
        regex_patterns = [convert_domains_to_regex_patterns(pattern) for pattern in tracker['patterns']]
        tracker_patterns.extend(regex_patterns)
    return tracker_patterns