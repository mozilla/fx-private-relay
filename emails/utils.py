import base64
import contextlib
from email.header import Header
from email.headerregistry import Address
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import parseaddr
import json
import re

from botocore.exceptions import ClientError
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDFExpand
import jwcrypto.jwe
import jwcrypto.jwk
import markus
import logging
from waffle.models import Flag

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import Group
from django.http import HttpResponse
from django.template.defaultfilters import linebreaksbr, urlize
from urllib.parse import urlparse

from .models import DomainAddress, RelayAddress, Reply, get_domains_from_settings
from .ses import send_raw_email


NEW_FROM_ADDRESS_FLAG_NAME = "new_from_address"

logger = logging.getLogger("events")
info_logger = logging.getLogger("eventsinfo")
study_logger = logging.getLogger("studymetrics")
metrics = markus.get_metrics("fx-private-relay")

with open("emails/tracker_lists/level-one-tracker.json", "r") as f:
    GENERAL_TRACKERS = json.load(f)
with open("emails/tracker_lists/level-two-tracker.json", "r") as f:
    STRICT_TRACKERS = json.load(f)


def time_if_enabled(name):
    def timing_decorator(func):
        def func_wrapper(*args, **kwargs):
            ctx_manager = (
                metrics.timer(name)
                if settings.STATSD_ENABLED
                else contextlib.nullcontext()
            )
            with ctx_manager:
                return func(*args, **kwargs)

        return func_wrapper

    return timing_decorator


def incr_if_enabled(name, value=1, tags=None):
    if settings.STATSD_ENABLED:
        metrics.incr(name, value, tags)


def histogram_if_enabled(name, value, tags=None):
    if settings.STATSD_ENABLED:
        metrics.histogram(name, value=value, tags=tags)


def gauge_if_enabled(name, value, tags=None):
    if settings.STATSD_ENABLED:
        metrics.gauge(name, value, tags)


def get_email_domain_from_settings():
    email_network_locality = urlparse(settings.SITE_ORIGIN).netloc
    # on dev server we need to add "mail" prefix
    # because we can’t publish MX records on Heroku
    if settings.RELAY_CHANNEL == "dev":
        email_network_locality = f"mail.{email_network_locality}"
    return email_network_locality


@time_if_enabled("ses_send_raw_email")
def ses_send_raw_email(
    from_address,
    to_address,
    subject,
    message_body,
    attachments,
    reply_address,
    mail,
    address,
):

    msg_with_headers = _start_message_with_headers(
        subject, from_address, to_address, reply_address
    )
    msg_with_body = _add_body_to_message(msg_with_headers, message_body)
    msg_with_attachments = _add_attachments_to_message(msg_with_body, attachments)

    try:
        # Provide the contents of the email.
        ses_response = send_raw_email(
            from_address=from_address,
            to_addresses=[to_address],
            raw_message=msg_with_attachments.as_string(),
        )
        incr_if_enabled("ses_send_raw_email", 1)

        _store_reply_record(mail, ses_response.MessageId, address)
    except ClientError as e:
        logger.error("ses_client_error_raw_email", extra=e.response["Error"])
        # 503 service unavailable reponse to SNS so it can retry
        return HttpResponse("SES client error on Raw Email", status=503)
    return HttpResponse("Sent email to final recipient.", status=200)


def _start_message_with_headers(subject, from_address, to_address, reply_address):
    # Create a multipart/mixed parent container.
    msg = MIMEMultipart("mixed")
    # Add subject, from and to lines.
    msg["Subject"] = subject
    msg["From"] = from_address
    msg["To"] = to_address
    msg["Reply-To"] = reply_address
    return msg


def _add_body_to_message(msg, message_body):
    charset = "UTF-8"
    # Create a multipart/alternative child container.
    msg_body = MIMEMultipart("alternative")

    # Encode the text and HTML content and set the character encoding.
    # This step is necessary if you're sending a message with characters
    # outside the ASCII range.
    if "Text" in message_body:
        body_text = message_body["Text"]["Data"]
        textpart = MIMEText(body_text.encode(charset), "plain", charset)
        msg_body.attach(textpart)
    if "Html" in message_body:
        body_html = message_body["Html"]["Data"]
        htmlpart = MIMEText(body_html.encode(charset), "html", charset)
        msg_body.attach(htmlpart)

    # Attach the multipart/alternative child container to the multipart/mixed
    # parent container.
    msg.attach(msg_body)
    return msg


def _add_attachments_to_message(msg, attachments):
    # attach attachments
    for actual_att_name, attachment in attachments:
        # Define the attachment part and encode it using MIMEApplication.
        attachment.seek(0)
        att = MIMEApplication(attachment.read())

        # Add a header to tell the email client to treat this
        # part as an attachment, and to give the attachment a name.
        att.add_header("Content-Disposition", "attachment", filename=actual_att_name)
        # Add the attachment to the parent container.
        msg.attach(att)
        attachment.close()
    return msg


def _store_reply_record(mail, message_id, address):
    # After relaying email, store a Reply record for it
    reply_metadata = {}
    for header in mail["headers"]:
        if header["name"].lower() in ["message-id", "from", "reply-to"]:
            reply_metadata[header["name"].lower()] = header["value"]
    message_id_bytes = get_message_id_bytes(message_id)
    (lookup_key, encryption_key) = derive_reply_keys(message_id_bytes)
    lookup = b64_lookup_key(lookup_key)
    encrypted_metadata = encrypt_reply_metadata(encryption_key, reply_metadata)
    reply_create_args = {"lookup": lookup, "encrypted_metadata": encrypted_metadata}
    if type(address) == DomainAddress:
        reply_create_args["domain_address"] = address
    elif type(address) == RelayAddress:
        reply_create_args["relay_address"] = address
    Reply.objects.create(**reply_create_args)
    return mail


def ses_relay_email(
    from_address, to_address, subject, message_body, attachments, mail, address
):

    reply_address = "replies@%s" % get_domains_from_settings().get(
        "RELAY_FIREFOX_DOMAIN"
    )

    response = ses_send_raw_email(
        from_address,
        to_address,
        subject,
        message_body,
        attachments,
        reply_address,
        mail,
        address,
    )
    return response


def urlize_and_linebreaks(text, autoescape=True):
    return linebreaksbr(urlize(text, autoescape=autoescape), autoescape=autoescape)


def get_post_data_from_request(request):
    if request.content_type == "application/json":
        return json.loads(request.body)
    return request.POST


def generate_relay_From(original_from_address, user_profile=None):
    _, relay_from_address = parseaddr(settings.RELAY_FROM_ADDRESS)
    try:
        new_from_flag = Flag.objects.get(name=NEW_FROM_ADDRESS_FLAG_NAME)
        if user_profile and new_from_flag.is_active_for_user(user_profile.user):
            _, relay_from_address = parseaddr(settings.NEW_RELAY_FROM_ADDRESS)
    except Flag.DoesNotExist:
        pass
    if user_profile and user_profile.has_premium:
        _, relay_from_address = parseaddr(
            "replies@%s" % get_domains_from_settings().get("RELAY_FIREFOX_DOMAIN")
        )
    # RFC 2822 (https://tools.ietf.org/html/rfc2822#section-2.1.1)
    # says email header lines must not be more than 998 chars long.
    # Encoding display names to longer than 998 chars will add wrap
    # characters which are unsafe. (See https://bugs.python.org/issue39073)
    # So, truncate the original sender to 900 chars so we can add our
    # "[via Relay] <relayfrom>" and encode it all.
    if len(original_from_address) > 998:
        original_from_address = "%s ..." % original_from_address[:900]
    # line breaks in From: will encode to unsafe chars, so strip them.
    original_from_address = (
        original_from_address.replace("\u2028", "").replace("\r", "").replace("\n", "")
    )

    display_name = Header('"%s [via Relay]"' % (original_from_address), "UTF-8")
    formatted_from_address = str(
        Address(display_name.encode(maxlinelen=998), addr_spec=relay_from_address)
    )
    return formatted_from_address


def get_message_id_bytes(message_id_str):
    message_id = message_id_str.split("@", 1)[0].rsplit("<", 1)[-1].strip()
    return message_id.encode()


def b64_lookup_key(lookup_key):
    return base64.urlsafe_b64encode(lookup_key).decode("ascii")


def derive_reply_keys(message_id):
    """Derive the lookup key and encrytion key from an aliased message id."""
    algorithm = hashes.SHA256()
    hkdf = HKDFExpand(algorithm=algorithm, length=16, info=b"replay replies lookup key")
    lookup_key = hkdf.derive(message_id)
    hkdf = HKDFExpand(
        algorithm=algorithm, length=32, info=b"replay replies encryption key"
    )
    encryption_key = hkdf.derive(message_id)
    return (lookup_key, encryption_key)


def encrypt_reply_metadata(key, payload):
    """Encrypt the given payload into a JWE, using the given key."""
    # This is a bit dumb, we have to base64-encode the key in order to load it :-/
    k = jwcrypto.jwk.JWK(
        kty="oct", k=base64.urlsafe_b64encode(key).rstrip(b"=").decode("ascii")
    )
    e = jwcrypto.jwe.JWE(
        json.dumps(payload), json.dumps({"alg": "dir", "enc": "A256GCM"}), recipient=k
    )
    return e.serialize(compact=True)


def decrypt_reply_metadata(key, jwe):
    """Decrypt the given JWE into a json payload, using the given key."""
    # This is a bit dumb, we have to base64-encode the key in order to load it :-/
    k = jwcrypto.jwk.JWK(
        kty="oct", k=base64.urlsafe_b64encode(key).rstrip(b"=").decode("ascii")
    )
    e = jwcrypto.jwe.JWE()
    e.deserialize(jwe)
    e.decrypt(k)
    return e.plaintext


def _get_bucket_and_key_from_s3_json(message_json):
    bucket = None
    object_key = None
    if "receipt" in message_json and "action" in message_json["receipt"]:
        message_json_receipt = message_json["receipt"]
    else:
        notification_type = message_json.get("notificationType")
        event_type = message_json.get("eventType")
        known_types = {"Bounce", "Complaint", "Delivery"}
        if not (notification_type in known_types or event_type in known_types):
            # TODO: sns inbound notification does not have 'receipt'
            # we need to look into this more
            logger.error(
                "sns_inbound_message_without_receipt",
                extra={"message_json_keys": message_json.keys()},
            )
        return None, None

    try:
        if "S3" in message_json_receipt["action"]["type"]:
            bucket = message_json_receipt["action"]["bucketName"]
            object_key = message_json_receipt["action"]["objectKey"]
    except (KeyError, TypeError) as e:
        logger.error(
            "sns_inbound_message_receipt_malformed",
            extra={
                "receipt_action": message_json_receipt["action"],
            },
        )
    return bucket, object_key


def get_message_content_from_s3(bucket, object_key):
    if bucket and object_key:
        s3_client = apps.get_app_config("emails").s3_client
        streamed_s3_object = s3_client.get_object(Bucket=bucket, Key=object_key).get(
            "Body"
        )
        return streamed_s3_object.read()


def remove_message_from_s3(bucket, object_key):
    if bucket is None or object_key is None:
        return False
    try:
        s3_client = apps.get_app_config("emails").s3_client
        response = s3_client.delete_object(Bucket=bucket, Key=object_key)
        return response.get("DeleteMarker")
    except ClientError as e:
        if e.response["Error"].get("Code", "") == "NoSuchKey":
            logger.error("s3_delete_object_does_not_exist", extra=e.response["Error"])
        else:
            logger.error("s3_client_error_delete_email", extra=e.response["Error"])
        incr_if_enabled("message_not_removed_from_s3", 1)
    return False


def set_user_group(user):
    if "@" not in user.email:
        return None
    email_domain = user.email.split("@")[1]
    group_attribute = {
        "mozilla.com": "mozilla_corporation",
        "mozillafoundation.org": "mozilla_foundation",
        "getpocket.com": "pocket",
    }
    group_name = group_attribute.get(email_domain)
    if not group_name:
        return None
    internal_group_qs = Group.objects.filter(name=group_name)
    internal_group = internal_group_qs.first()
    if internal_group is None:
        return None
    internal_group.user_set.add(user)


def convert_domains_to_regex_patterns(domain_pattern):
    return r"""(["'])(\S*://(\S*\.)*""" + re.escape(domain_pattern) + r"\S*)\1"


def count_tracker(html_content, trackers):
    tracker_total = 0
    details = {}
    # html_content needs to be str for count()
    for tracker in trackers:
        pattern = convert_domains_to_regex_patterns(tracker)
        html_content, count = re.subn(pattern, "", html_content)
        if count:
            tracker_total += count
            details[tracker] = count
    return {"count": tracker_total, "trackers": details}


def count_all_trackers(html_content):
    general_detail = count_tracker(html_content, GENERAL_TRACKERS)
    strict_detail = count_tracker(html_content, STRICT_TRACKERS)

    incr_if_enabled("tracker.general_count", general_detail["count"])
    incr_if_enabled("tracker.strict_count", strict_detail["count"])
    study_logger.info(
        "email_tracker_summary",
        extra={"level_one": general_detail, "level_two": strict_detail},
    )


def remove_trackers(html_content, level="general"):
    trackers = GENERAL_TRACKERS if level == "general" else STRICT_TRACKERS
    tracker_removed = 0
    changed_content = html_content

    for tracker in trackers:
        pattern = convert_domains_to_regex_patterns(tracker)
        changed_content, matched = re.subn(
            pattern, rf"\g<1>{settings.SITE_ORIGIN}/faq\g<1>", changed_content
        )
        tracker_removed += matched

    level_one_detail = count_tracker(html_content, GENERAL_TRACKERS)
    level_two_detail = count_tracker(html_content, STRICT_TRACKERS)

    tracker_details = {
        "tracker_removed": tracker_removed,
        "level_one": level_one_detail,
    }
    logger_details = {"level": level, "level_two": level_two_detail}
    logger_details.update(tracker_details)
    info_logger.info(
        "email_tracker_summary",
        extra=logger_details,
    )
    return changed_content, tracker_details
