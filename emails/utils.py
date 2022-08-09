import base64
import contextlib
from dataclasses import dataclass, field
from email.header import Header
from email.headerregistry import Address
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import parseaddr
from enum import Enum
import json
import re
from typing import Optional, Union

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
from django.contrib.auth.models import Group, User
from django.db import transaction
from django.http import HttpResponse
from django.template.defaultfilters import linebreaksbr, urlize
from urllib.parse import urlparse

from .models import (
    CannotMakeAddressException,
    DeletedAddress,
    DomainAddress,
    Profile,
    RelayAddress,
    Reply,
    address_hash,
    get_domain_numerical,
    get_domains_from_settings,
)


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
        emails_config = apps.get_app_config("emails")
        ses_response = emails_config.ses_client.send_raw_email(
            Source=from_address,
            Destinations=[to_address],
            RawMessage={
                "Data": msg_with_attachments.as_string(),
            },
            ConfigurationSetName=settings.AWS_SES_CONFIGSET,
        )
        incr_if_enabled("ses_send_raw_email", 1)

        _store_reply_record(mail, ses_response, address)
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


def _store_reply_record(mail, ses_response, address):
    # After relaying email, store a Reply record for it
    reply_metadata = {}
    for header in mail["headers"]:
        if header["name"].lower() in ["message-id", "from", "reply-to"]:
            reply_metadata[header["name"].lower()] = header["value"]
    message_id_bytes = get_message_id_bytes(ses_response["MessageId"])
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
        is_bounce_notification = notification_type == "Bounce" or event_type == "Bounce"
        if not is_bounce_notification:
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


class EmailAddressType(Enum):
    """Categories of emails."""

    # A RelayAddress, like "foo@mozmail.com", or something that looks like it
    RELAY_ADDRESS = "relay_address"
    DELETED_RELAY_ADDRESS = "deleted_relay_address"
    UNKNOWN_RELAY_ADDRESS = "unknown_relay_address"

    # A Firefox Relay reply address, like "noreply@mozmail.com"
    REPLY_ADDRESS = "reply_address"
    PREMIUM_REPLY_ADDRESS = "premium_reply_address"

    # A DomainAddress, like "foo@sub.mozmail.com", or a look-alike
    DOMAIN_ADDRESS = "domain_address"
    RESERVED_DOMAIN_ADDRESS = "unknown_domain_address"
    DELETED_DOMAIN_ADDRESS = "deleted_domain_address"
    UNKNOWN_DOMAIN_ADDRESS = "unknown_domain_address"

    # A DomainAddress created by lookup_email_address(create_domain_address=True)
    NEW_DOMAIN_ADDRESS = "new_domain_address"
    RECREATED_DOMAIN_ADDRESS = "recreated_domain_address"

    # The "real" address of a user
    USER_ADDRESS = "user_address"

    # Unknown email on an unknown domain
    EXTERNAL_ADDRESS = "external_address"

    # Not an email address, like "email" or "email@com@biz"
    MALFORMED_ADDRESS = "malformed_address"

    # A DomainAddress on the "old" domain
    INVALID_DOMAIN_ADDRESS = "invalid_domain_address"

    # Failed to create a DomainAddress with create_domain_address=True
    FAILED_TO_CREATE_DOMAIN_ADDRESS = "failed_to_create_domain_address"


@dataclass
class EmailAddressInfo:
    """Classification of email address and related data."""

    email_address: str
    email_type: EmailAddressType

    # Set when an RelayAddress found or a DomainAddress found or created
    address_object: Optional[Union[RelayAddress, DomainAddress]] = None

    # Set when DeletedAddress objects are found for the email
    deleted_address_objects: list[DeletedAddress] = field(default_factory=list)

    # Set when the email address matches Users
    users: list[User] = field(default_factory=list)

    # Set when create_domain_address=True but creating a DomainAddress fails
    creation_exception: Optional[CannotMakeAddressException] = None


def lookup_email_address(
    email_address: str, create_domain_address=False
) -> EmailAddressInfo:
    """
    Classify an email address and return related objects.

    If the email_address looks like a DomainAddress for an existing user, but
    there is no matching undeleted DomainAddress then
    create_domain_address=True will attempt to create it. This is done in this
    function to ensure the Profile is locked during lookup and creation.
    """
    # Validate that email_address looks like an email with a local and domain part
    try:
        local_part, domain_part = email_address.split("@")
    except ValueError:
        return EmailAddressInfo(email_address, EmailAddressType.MALFORMED_ADDRESS)

    # Look for the free account reply address, like "noreply@mozmail.com"
    for setting_name in ("RELAY_FROM_ADDRESS", "NEW_RELAY_FROM_ADDRESS"):
        relay_from_address = getattr(settings, setting_name)
        _, reply_address = parseaddr(relay_from_address)
        if email_address == reply_address:
            return EmailAddressInfo(email_address, EmailAddressType.REPLY_ADDRESS)

    # Look for relay or other addresses on the Firefox Relay domain
    domains = get_domains_from_settings()
    email_domains = domains.values()
    if domain_part in email_domains:
        return _lookup_relay_address(email_address)

    # Look for domain addresses (subdomains of the Firefox Relay domain)
    parent_domain: Optional[str] = None
    try:
        _, parent_domain = domain_part.split(".", 1)
    except ValueError:
        pass
    if parent_domain and parent_domain in email_domains:
        # The RELAY_FIREFOX_DOMAIN is invalid as a domain address.
        # Check before entering transaction.
        if parent_domain != domains["MOZMAIL_DOMAIN"]:
            return EmailAddressInfo(
                email_address, EmailAddressType.INVALID_DOMAIN_ADDRESS
            )
        if create_domain_address:
            with transaction.atomic():
                return _lookup_domain_address(email_address, True)
        else:
            return _lookup_domain_address(email_address, False)

    # Look for users with this email address
    users = list(User.objects.filter(email=email_address))
    if users:
        return EmailAddressInfo(
            email_address, EmailAddressType.USER_ADDRESS, users=users
        )

    # This is an unknown, non-Relay email address
    return EmailAddressInfo(email_address, EmailAddressType.EXTERNAL_ADDRESS)


def _lookup_relay_address(email_address: str) -> EmailAddressInfo:
    """Lookup email addresses on a relay domain, like l0c4l@mozmail.com."""

    # Look for the premium reply address
    premium_reply_domain = get_domains_from_settings()["RELAY_FIREFOX_DOMAIN"]
    premium_reply_address = f"replies@{premium_reply_domain}"
    if email_address == premium_reply_address:
        return EmailAddressInfo(email_address, EmailAddressType.PREMIUM_REPLY_ADDRESS)

    local_part, domain_part = email_address.split("@")
    domain_numerical = get_domain_numerical(domain_part)
    # Look for randomized relay addresses
    relay_address = RelayAddress.objects.filter(
        address=local_part, domain=domain_numerical
    ).first()
    if relay_address:
        return EmailAddressInfo(
            email_address,
            EmailAddressType.RELAY_ADDRESS,
            address_object=relay_address,
        )
    else:
        # Look for deleted randomized relay addresses
        deleted_addresses = list(
            DeletedAddress.objects.filter(
                address_hash=address_hash(local_part, domain=domain_part)
            )
        )
        if deleted_addresses:
            email_type = EmailAddressType.DELETED_RELAY_ADDRESS
        else:
            email_type = EmailAddressType.UNKNOWN_RELAY_ADDRESS
        return EmailAddressInfo(
            email_address, email_type, deleted_address_objects=deleted_addresses
        )


def _lookup_domain_address(
    email_address: str, create_domain_address: bool
) -> EmailAddressInfo:
    """
    Lookup and optionally auto-create domain emails, like local@subdomain.mozmail.com.
    """
    local_part, domain_part = email_address.split("@")
    subdomain, parent_domain = domain_part.split(".", 1)
    assert parent_domain == get_domains_from_settings()["MOZMAIL_DOMAIN"]

    profile_query = Profile.objects.filter(subdomain=subdomain)
    if create_domain_address:
        profile_query = profile_query.select_for_update()
    profile = profile_query.first()
    if not profile:
        return EmailAddressInfo(email_address, EmailAddressType.UNKNOWN_DOMAIN_ADDRESS)

    domain_numerical = get_domain_numerical(parent_domain)
    domain_address = DomainAddress.objects.filter(
        user=profile.user, address=local_part, domain=domain_numerical
    ).first()
    if domain_address:
        email_type = EmailAddressType.DOMAIN_ADDRESS
        deleted_addresses = []
    else:
        deleted_addresses = list(
            DeletedAddress.objects.filter(
                address_hash=address_hash(local_part, domain=domain_part)
            )
        )
        if create_domain_address:
            try:
                domain_address = DomainAddress.make_domain_address(
                    profile, local_part, made_via_email=True
                )
            except CannotMakeAddressException as exception:
                return EmailAddressInfo(
                    email_address,
                    EmailAddressType.FAILED_TO_CREATE_DOMAIN_ADDRESS,
                    deleted_address_objects=deleted_addresses,
                    creation_exception=exception,
                )
            if deleted_addresses:
                email_type = EmailAddressType.RECREATED_DOMAIN_ADDRESS
            else:
                email_type = EmailAddressType.NEW_DOMAIN_ADDRESS
        else:
            if deleted_addresses:
                email_type = EmailAddressType.DELETED_DOMAIN_ADDRESS
            else:
                email_type = EmailAddressType.RESERVED_DOMAIN_ADDRESS

    return EmailAddressInfo(
        email_address,
        email_type,
        address_object=domain_address,
        deleted_address_objects=deleted_addresses,
    )
