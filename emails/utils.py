import contextlib
from datetime import datetime, timezone
from email.headerregistry import Address
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import parseaddr
import json
import os

from botocore.exceptions import ClientError
import markus
import logging

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


@time_if_enabled('ses_send_email')
def ses_send_raw_email(
        from_address, to_address, subject, message_body, attachments
):
    SENDER = from_address
    RECIPIENT = to_address
    SUBJECT = subject
    BODY_TEXT = message_body['Text']['Data']
    BODY_HTML = message_body['Html']['Data']
    CHARSET = "UTF-8"

    # Create a multipart/mixed parent container.
    msg = MIMEMultipart('mixed')
    # Add subject, from and to lines.
    msg['Subject'] = SUBJECT
    msg['From'] = SENDER
    msg['To'] = RECIPIENT

    # Create a multipart/alternative child container.
    msg_body = MIMEMultipart('alternative')

    # Encode the text and HTML content and set the character encoding.
    # This step is necessary if you're sending a message with characters
    # outside the ASCII range.
    textpart = MIMEText(BODY_TEXT.encode(CHARSET), 'plain', CHARSET)
    htmlpart = MIMEText(BODY_HTML.encode(CHARSET), 'html', CHARSET)

    # Add the text and HTML parts to the child container.
    msg_body.attach(textpart)
    msg_body.attach(htmlpart)

    # Attach the multipart/alternative child container to the multipart/mixed
    # parent container.
    msg.attach(msg_body)

    # attach attachments
    for temp_att_name, actual_att_name in attachments.items():
        with open(temp_att_name, 'rb') as f:
            # Define the attachment part and encode it using MIMEApplication.
            att = MIMEApplication(f.read())

        # Add a header to tell the email client to treat this
        # part as an attachment, and to give the attachment a name.
        att.add_header(
            'Content-Disposition',
            'attachment',
            filename=actual_att_name
        )
        # Add the attachment to the parent container.
        msg.attach(att)
        os.unlink(temp_att_name)
        if os.path.exists(temp_att_name):
            logger.info(
                'Attachment not removed from temporary storage',
                extra={
                    'FileExists': os.path.exists(temp_att_name),
                    'TemporaryPath': temp_att_name
                }
            )

    try:
        # Provide the contents of the email.
        emails_config = apps.get_app_config('emails')
        response = emails_config.ses_client.send_raw_email(
            Source=SENDER,
            Destinations=[
                RECIPIENT
            ],
            RawMessage={
                'Data': msg.as_string(),
            },
        )
        logger.debug('ses_sent_response', extra=response['MessageId'])
        incr_if_enabled('ses_send_email', 1)
    except ClientError as e:
        logger.error('ses_client_error_raw_email', extra=e.response['Error'])
        return HttpResponse("SES client error on Raw Email", status=400)
    return HttpResponse("Sent email to final recipient.", status=200)


def ses_relay_email(
        from_address, relay_address, subject, message_body, attachments
):
    relay_from_address, relay_from_display = generate_relay_From(from_address)
    formatted_from_address = str(
        Address(relay_from_display, addr_spec=relay_from_address)
    )
    try:
        if attachments:
            response = ses_send_raw_email(
                formatted_from_address,
                relay_address.user.email,
                subject,
                message_body,
                attachments
            )
        else:
            response = ses_send_email(
                formatted_from_address,
                relay_address.user.email,
                subject,
                message_body
            )
        relay_address.num_forwarded += 1
        relay_address.last_used_at = datetime.now(timezone.utc)
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
