import base64
import contextlib
from email.errors import InvalidHeaderDefect
from email.headerregistry import Address, AddressHeader
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from functools import cache
from typing import cast, Any, Callable, TypeVar
import json
import pathlib
import re
from django.template.loader import render_to_string
from django.utils.text import Truncator
import requests

from botocore.exceptions import ClientError
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDFExpand
from mypy_boto3_ses.type_defs import SendRawEmailResponseTypeDef
import jwcrypto.jwe
import jwcrypto.jwk
import markus
import logging
from urllib.parse import quote_plus, urlparse

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import Group, User
from django.template.defaultfilters import linebreaksbr, urlize

from allauth.socialaccount.models import SocialAccount

from privaterelay.plans import get_bundle_country_language_mapping
from privaterelay.utils import get_countries_info_from_lang_and_mapping

from .apps import EmailsConfig
from .models import (
    DomainAddress,
    RelayAddress,
    Reply,
    get_domains_from_settings,
)
from .types import AWS_MailJSON


logger = logging.getLogger("events")
info_logger = logging.getLogger("eventsinfo")
study_logger = logging.getLogger("studymetrics")
metrics = markus.get_metrics("fx-private-relay")

shavar_prod_lists_url = (
    "https://raw.githubusercontent.com/mozilla-services/shavar-prod-lists/"
    "master/disconnect-blacklist.json"
)
EMAILS_FOLDER_PATH = pathlib.Path(__file__).parent
TRACKER_FOLDER_PATH = EMAILS_FOLDER_PATH / "tracker_lists"


def get_trackers(level):
    category = "Email"
    tracker_list_name = "level-one-trackers"
    if level == 2:
        category = "EmailAggressive"
        tracker_list_name = "level-two-trackers"

    trackers = []
    file_name = f"{tracker_list_name}.json"
    try:
        with open(TRACKER_FOLDER_PATH / file_name, "r") as f:
            trackers = json.load(f)
    except FileNotFoundError:
        trackers = download_trackers(shavar_prod_lists_url, category)
        store_trackers(trackers, TRACKER_FOLDER_PATH, file_name)
    return trackers


def download_trackers(repo_url, category="Email"):
    # email tracker lists from shavar-prod-list as per agreed use under license:
    resp = requests.get(repo_url)
    json_resp = resp.json()
    formatted_trackers = json_resp["categories"][category]
    trackers = []
    for entity in formatted_trackers:
        for _, resources in entity.items():
            for _, domains in resources.items():
                trackers.extend(domains)
    return trackers


def store_trackers(trackers, path, file_name):
    with open(path / file_name, "w+") as f:
        json.dump(trackers, f, indent=4)


@cache
def general_trackers():
    return get_trackers(level=1)


@cache
def strict_trackers():
    return get_trackers(level=2)


_TimedFunction = TypeVar("_TimedFunction", bound=Callable[..., Any])


def time_if_enabled(name: str) -> Callable[[_TimedFunction], _TimedFunction]:
    def timing_decorator(func: _TimedFunction) -> _TimedFunction:
        def func_wrapper(*args, **kwargs):
            ctx_manager = (
                metrics.timer(name)
                if settings.STATSD_ENABLED
                else contextlib.nullcontext()
            )
            with ctx_manager:
                return func(*args, **kwargs)

        return cast(_TimedFunction, func_wrapper)

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


def parse_email_header(header_value: str) -> list[tuple[str, str]]:
    """
    Extract the (display name, email address) pairs from a header value.

    This is useful when working with header values provided by a
    AWS SES delivery notification.

    email.utils.parseaddr() works with well-formed emails, but fails in
    cases with badly formed emails where an email address could still
    be extracted.
    """
    address_list = AddressHeader.value_parser(header_value)
    pairs: list[tuple[str, str]] = []
    for address in address_list.addresses:
        for mailbox in address.all_mailboxes:
            addr_spec = mailbox.addr_spec
            if addr_spec and addr_spec.count("@") == 1:
                pairs.append((mailbox.display_name or "", addr_spec))
    return pairs


def _get_hero_img_src(lang_code):
    img_locale = "en"
    avail_l10n_image_codes = [
        "cs",
        "de",
        "en",
        "es",
        "fi",
        "fr",
        "hu",
        "id",
        "it",
        "ja",
        "nl",
        "pt",
        "ru",
        "sv",
        "zh",
    ]
    major_lang = lang_code.split("-")[0]
    if major_lang in avail_l10n_image_codes:
        img_locale = major_lang

    return (
        settings.SITE_ORIGIN
        + f"/static/images/email-images/first-time-user/hero-image-{img_locale}.png"
    )


def get_welcome_email(user: User, format: str) -> str:
    sa = SocialAccount.objects.get(user=user)
    bundle_plans = get_countries_info_from_lang_and_mapping(
        sa.extra_data.get("locale", "en"), get_bundle_country_language_mapping()
    )
    lang_code = user.profile.language
    hero_img_src = _get_hero_img_src(lang_code)
    return render_to_string(
        f"emails/first_time_user.{format}",
        {
            "in_bundle_country": bundle_plans["available_in_country"],
            "SITE_ORIGIN": settings.SITE_ORIGIN,
            "hero_img_src": hero_img_src,
            "language": lang_code,
        },
    )


@time_if_enabled("ses_send_raw_email")
def ses_send_raw_email(
    source_address: str,
    destination_address: str,
    message: EmailMessage,
) -> SendRawEmailResponseTypeDef:
    emails_config = apps.get_app_config("emails")
    assert isinstance(emails_config, EmailsConfig)
    ses_client = emails_config.ses_client
    assert ses_client
    assert settings.AWS_SES_CONFIGSET
    try:
        ses_response = ses_client.send_raw_email(
            Source=source_address,
            Destinations=[destination_address],
            RawMessage={"Data": message.as_string()},
            ConfigurationSetName=settings.AWS_SES_CONFIGSET,
        )
        incr_if_enabled("ses_send_raw_email", 1)
        return ses_response
    except ClientError as e:
        logger.error("ses_client_error_raw_email", extra=e.response["Error"])
        raise


def _store_reply_record(
    mail: AWS_MailJSON, message_id: str, address: RelayAddress | DomainAddress
) -> AWS_MailJSON:
    # After relaying email, store a Reply record for it
    reply_metadata = {}
    for header in mail["headers"]:
        if header["name"].lower() in ["message-id", "from", "reply-to"]:
            reply_metadata[header["name"].lower()] = header["value"]
    message_id_bytes = get_message_id_bytes(message_id)
    (lookup_key, encryption_key) = derive_reply_keys(message_id_bytes)
    lookup = b64_lookup_key(lookup_key)
    encrypted_metadata = encrypt_reply_metadata(encryption_key, reply_metadata)
    reply_create_args: dict[str, Any] = {
        "lookup": lookup,
        "encrypted_metadata": encrypted_metadata,
    }
    if type(address) == DomainAddress:
        reply_create_args["domain_address"] = address
    elif type(address) == RelayAddress:
        reply_create_args["relay_address"] = address
    Reply.objects.create(**reply_create_args)
    return mail


def urlize_and_linebreaks(text, autoescape=True):
    return linebreaksbr(urlize(text, autoescape=autoescape), autoescape=autoescape)


def get_reply_to_address(premium: bool = True) -> str:
    """Return the address that relays replies."""
    if premium:
        _, reply_to_address = parseaddr(
            "replies@%s" % get_domains_from_settings().get("RELAY_FIREFOX_DOMAIN")
        )
    else:
        _, reply_to_address = parseaddr(settings.RELAY_FROM_ADDRESS)
    return reply_to_address


def truncate(max_length: int, value: str) -> str:
    """
    Truncate a string to a maximum length.

    If the value is all ASCII, the truncation suffix will be ...
    If the value is non-ASCII, the truncation suffix will be … (Unicode ellipsis)
    """
    if len(value) <= max_length:
        return value
    ellipsis = "..."  # ASCII Ellipsis
    try:
        value.encode("ascii")
    except UnicodeEncodeError:
        ellipsis = "…"
    return Truncator(value).chars(max_length, truncate=ellipsis)


class InvalidFromHeader(Exception):
    pass


def generate_from_header(original_from_address: str, relay_mask: str) -> str:
    """
    Return a From: header str using the original sender and a display name that
    refers to Relay.

    This format was introduced in June 2023 with MPP-2117.
    """
    oneline_from_address = (
        original_from_address.replace("\u2028", "").replace("\r", "").replace("\n", "")
    )
    display_name, original_address = parseaddr(oneline_from_address)
    try:
        parsed_address = Address(addr_spec=original_address)
    except (InvalidHeaderDefect, IndexError) as e:
        # TODO: MPP-3407, MPP-3417 - Determine how to handle these
        raise InvalidFromHeader from e

    # Truncate the display name to 71 characters, so the sender portion fits on the
    # first line of a multi-line "From:" header, if it is ASCII. A utf-8 encoded header
    # will be 226 chars, still below the 998 limit of RFC 5322 2.1.1.
    max_length = 71

    if display_name:
        short_name = truncate(max_length, display_name)
        short_address = truncate(max_length, parsed_address.addr_spec)
        sender = f"{short_name} <{short_address}>"
    else:
        # Use the email address if the display name was not originally set
        display_name = parsed_address.addr_spec
        sender = truncate(max_length, display_name)
    return formataddr((f"{sender} [via Relay]", relay_mask))


def get_message_id_bytes(message_id_str: str) -> bytes:
    message_id = message_id_str.split("@", 1)[0].rsplit("<", 1)[-1].strip()
    return message_id.encode()


def b64_lookup_key(lookup_key: bytes) -> str:
    return base64.urlsafe_b64encode(lookup_key).decode("ascii")


def derive_reply_keys(message_id: bytes) -> tuple[bytes, bytes]:
    """Derive the lookup key and encrytion key from an aliased message id."""
    algorithm = hashes.SHA256()
    hkdf = HKDFExpand(algorithm=algorithm, length=16, info=b"replay replies lookup key")
    lookup_key = hkdf.derive(message_id)
    hkdf = HKDFExpand(
        algorithm=algorithm, length=32, info=b"replay replies encryption key"
    )
    encryption_key = hkdf.derive(message_id)
    return (lookup_key, encryption_key)


def encrypt_reply_metadata(key: bytes, payload: dict[str, str]) -> str:
    """Encrypt the given payload into a JWE, using the given key."""
    # This is a bit dumb, we have to base64-encode the key in order to load it :-/
    k = jwcrypto.jwk.JWK(
        kty="oct", k=base64.urlsafe_b64encode(key).rstrip(b"=").decode("ascii")
    )
    e = jwcrypto.jwe.JWE(
        json.dumps(payload), json.dumps({"alg": "dir", "enc": "A256GCM"}), recipient=k
    )
    return cast(str, e.serialize(compact=True))


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
    # Only Received notifications have S3-stored data
    notification_type = message_json.get("notificationType")
    if notification_type != "Received":
        return None, None

    if "receipt" in message_json and "action" in message_json["receipt"]:
        message_json_receipt = message_json["receipt"]
    else:
        logger.error(
            "sns_inbound_message_without_receipt",
            extra={"message_json_keys": message_json.keys()},
        )
        return None, None

    bucket = None
    object_key = None
    try:
        if "S3" in message_json_receipt["action"]["type"]:
            bucket = message_json_receipt["action"]["bucketName"]
            object_key = message_json_receipt["action"]["objectKey"]
    except (KeyError, TypeError):
        logger.error(
            "sns_inbound_message_receipt_malformed",
            extra={"receipt_action": message_json_receipt["action"]},
        )
    return bucket, object_key


@time_if_enabled("s3_get_message_content")
def get_message_content_from_s3(bucket, object_key):
    if bucket and object_key:
        s3_client = apps.get_app_config("emails").s3_client
        streamed_s3_object = s3_client.get_object(Bucket=bucket, Key=object_key).get(
            "Body"
        )
        return streamed_s3_object.read()


@time_if_enabled("s3_remove_message_from")
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
    general_detail = count_tracker(html_content, general_trackers())
    strict_detail = count_tracker(html_content, strict_trackers())

    incr_if_enabled("tracker.general_count", general_detail["count"])
    incr_if_enabled("tracker.strict_count", strict_detail["count"])
    study_logger.info(
        "email_tracker_summary",
        extra={"level_one": general_detail, "level_two": strict_detail},
    )


def remove_trackers(html_content, from_address, datetime_now, level="general"):
    trackers = general_trackers() if level == "general" else strict_trackers()
    tracker_removed = 0
    changed_content = html_content

    for tracker in trackers:
        pattern = convert_domains_to_regex_patterns(tracker)

        def convert_to_tracker_warning_link(matchobj):
            quote, original_link, _ = matchobj.groups()
            tracker_link_details = {
                "sender": from_address,
                "received_at": datetime_now,
                "original_link": original_link,
            }
            anchor = quote_plus(json.dumps(tracker_link_details, separators=(",", ":")))
            url = f"{settings.SITE_ORIGIN}/contains-tracker-warning/#{anchor}"
            return f"{quote}{url}{quote}"

        changed_content, matched = re.subn(
            pattern, convert_to_tracker_warning_link, changed_content
        )
        tracker_removed += matched

    level_one_detail = count_tracker(html_content, general_trackers())
    level_two_detail = count_tracker(html_content, strict_trackers())

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
