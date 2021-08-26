import base64
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
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDFExpand
import jwcrypto.jwe
import jwcrypto.jwk
import markus
import logging

from django.apps import apps
from django.conf import settings
from django.http import HttpResponse
from django.template.defaultfilters import linebreaksbr, urlize
from urllib.parse import urlparse

from .models import Reply, DEFAULT_DOMAIN


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


@time_if_enabled('ses_send_raw_email')
def ses_send_raw_email(
    from_address, to_address, subject, message_body, attachments,
    reply_address, mail, address
):
    charset = "UTF-8"

    # Create a multipart/mixed parent container.
    msg = MIMEMultipart('mixed')
    # Add subject, from and to lines.
    msg['Subject'] = subject
    msg['From'] = from_address
    msg['To'] = to_address
    msg['Reply-To'] = reply_address

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
        ses_response = emails_config.ses_client.send_raw_email(
            Source=from_address,
            Destinations=[
                to_address
            ],
            RawMessage={
                'Data': msg.as_string(),
            },
        )
        incr_if_enabled('ses_send_raw_email', 1)

        # After relaying email, store a Reply record for it
        reply_metadata = {}
        for header in mail['headers']:
            if header['name'].lower() in ['message-id', 'from', 'reply-to']:
                reply_metadata[header['name'].lower()] = header['value']
        message_id_bytes = get_message_id_bytes(ses_response['MessageId'])
        (lookup_key, encryption_key) = derive_reply_keys(message_id_bytes)
        lookup = base64.urlsafe_b64encode(lookup_key).decode('ascii')
        encrypted_metadata = encrypt_reply_metadata(
            encryption_key, reply_metadata
        )

        Reply.objects.create(
            relay_address=address,
            lookup=lookup,
            encrypted_metadata=encrypted_metadata
        )
    except ClientError as e:
        logger.error('ses_client_error_raw_email', extra=e.response['Error'])
        return HttpResponse("SES client error on Raw Email", status=400)
    return HttpResponse("Sent email to final recipient.", status=200)


def ses_relay_email(from_address, to_address, subject,
                    message_body, attachments, mail, address):

    reply_address = 'replies@%s' % DEFAULT_DOMAIN

    try:
        response = ses_send_raw_email(
            from_address,
            to_address,
            subject,
            message_body,
            attachments,
            reply_address,
            mail,
            address
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


def get_message_id_bytes(message_id_str):
    message_id = message_id_str.split("@", 1)[0].rsplit("<", 1)[-1].strip()
    return message_id.encode()


def derive_reply_keys(message_id):
    """Derive the lookup key and encrytion key from an aliased message id."""
    algorithm = hashes.SHA256()
    hkdf = HKDFExpand(algorithm=algorithm, length=16, info=b"replay replies lookup key")
    lookup_key = hkdf.derive(message_id)
    hkdf = HKDFExpand(algorithm=algorithm, length=32, info=b"replay replies encryption key")
    encryption_key = hkdf.derive(message_id)
    return (lookup_key, encryption_key)


def encrypt_reply_metadata(key, payload):
    """Encrypt the given payload into a JWE, using the given key."""
    # This is a bit dumb, we have to base64-encode the key in order to load it :-/
    k = jwcrypto.jwk.JWK(kty="oct", k=base64.urlsafe_b64encode(key).rstrip(b"=").decode('ascii'))
    e = jwcrypto.jwe.JWE(json.dumps(payload), json.dumps({"alg": "dir", "enc": "A256GCM"}), recipient=k)
    return e.serialize(compact=True)


def decrypt_reply_metadata(key, jwe):
    """Decrypt the given JWE into a json payload, using the given key."""
    # This is a bit dumb, we have to base64-encode the key in order to load it :-/
    k = jwcrypto.jwk.JWK(kty="oct", k=base64.urlsafe_b64encode(key).rstrip(b"=").decode('ascii'))
    e = jwcrypto.jwe.JWE()
    e.deserialize(jwe)
    e.decrypt(k)
    return e.plaintext


def load_reply_metadata(message_id, encrypted_reply_metadata):
    """Decrypt the encrypted reply metadata using the given aliaed-message-id."""
    message_id = message_id.split("@", 1)[0].rsplit("<", 1)[-1].strip()
    message_id = base64.urlsafe_b64decode(message_id)
    (lookup_key, encryption_key) = derive_reply_keys(message_id)
    # In a real system, you'd use `lookup_key` to fetch the encrypted data from the database.
    return decrypt_reply_metadata(encryption_key, encrypted_reply_metadata)
