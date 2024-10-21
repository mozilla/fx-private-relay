import html
import json
import logging
import re
import shlex
from datetime import UTC, datetime
from email import message_from_bytes
from email.iterators import _structure
from email.message import EmailMessage
from email.utils import parseaddr
from io import StringIO
from json import JSONDecodeError
from textwrap import dedent
from typing import Any, Literal, NamedTuple, TypedDict, TypeVar
from urllib.parse import urlencode
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import prefetch_related_objects
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.template.loader import render_to_string
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from botocore.exceptions import ClientError
from codetiming import Timer
from decouple import strtobool
from markus.utils import generate_tag
from sentry_sdk import capture_message
from waffle import get_waffle_flag_model, sample_is_active

from privaterelay.ftl_bundles import main as ftl_bundle
from privaterelay.models import Profile
from privaterelay.utils import (
    flag_is_active_in_task,
    get_subplat_upgrade_link_by_language,
    glean_logger,
)

from .exceptions import CannotMakeAddressException
from .models import (
    DeletedAddress,
    DomainAddress,
    RelayAddress,
    Reply,
    address_hash,
    get_domain_numerical,
)
from .policy import relay_policy
from .sns import SUPPORTED_SNS_TYPES, verify_from_sns
from .types import (
    AWS_MailJSON,
    AWS_SNSMessageJSON,
    EmailForwardingIssues,
    EmailHeaderIssues,
    OutgoingHeaders,
)
from .utils import (
    InvalidFromHeader,
    _get_bucket_and_key_from_s3_json,
    b64_lookup_key,
    count_all_trackers,
    decrypt_reply_metadata,
    derive_reply_keys,
    encode_dict_gza85,
    encrypt_reply_metadata,
    generate_from_header,
    get_domains_from_settings,
    get_message_content_from_s3,
    get_message_id_bytes,
    get_reply_to_address,
    histogram_if_enabled,
    incr_if_enabled,
    parse_email_header,
    remove_message_from_s3,
    remove_trackers,
    ses_send_raw_email,
    urlize_and_linebreaks,
)

logger = logging.getLogger("events")
info_logger = logging.getLogger("eventsinfo")


class ReplyHeadersNotFound(Exception):
    def __init__(self, message="No In-Reply-To or References headers."):
        self.message = message


def first_time_user_test(request):
    """
    Demonstrate rendering of the "First time Relay user" email.
    Settings like language can be given in the querystring, otherwise settings
    come from a random free profile.
    """
    in_bundle_country = strtobool(request.GET.get("in_bundle_country", "yes"))
    email_context = {
        "in_bundle_country": in_bundle_country,
        "SITE_ORIGIN": settings.SITE_ORIGIN,
    }
    if request.GET.get("format", "html") == "text":
        return render(
            request,
            "emails/first_time_user.txt",
            email_context,
            "text/plain; charset=utf-8",
        )
    return render(request, "emails/first_time_user.html", email_context)


def reply_requires_premium_test(request):
    """
    Demonstrate rendering of the "Reply requires premium" email.

    Settings like language can be given in the querystring, otherwise settings
    come from a random free profile.
    """
    email_context = {
        "sender": "test@example.com",
        "forwarded": True,
        "SITE_ORIGIN": settings.SITE_ORIGIN,
    }
    for param in request.GET:
        email_context[param] = request.GET.get(param)
        if param == "forwarded" and request.GET[param] == "True":
            email_context[param] = True

    for param in request.GET:
        if param == "content-type" and request.GET[param] == "text/plain":
            return render(
                request,
                "emails/reply_requires_premium.txt",
                email_context,
                "text/plain; charset=utf-8",
            )
    return render(request, "emails/reply_requires_premium.html", email_context)


def disabled_mask_for_spam_test(request):
    """
    Demonstrate rendering of the "Disabled mask for spam" email.

    Settings like language can be given in the querystring, otherwise settings
    come from a random free profile.
    """
    mask = "abc123456@mozmail.com"
    email_context = {
        "mask": mask,
        "SITE_ORIGIN": settings.SITE_ORIGIN,
    }
    for param in request.GET:
        email_context[param] = request.GET.get(param)

    for param in request.GET:
        if param == "content-type" and request.GET[param] == "text/plain":
            return render(
                request,
                "emails/disabled_mask_for_spam.txt",
                email_context,
                "text/plain; charset=utf-8",
            )
    return render(request, "emails/disabled_mask_for_spam.html", email_context)


def first_forwarded_email_test(request: HttpRequest) -> HttpResponse:
    # TO DO: Update with correct context when trigger is created
    first_forwarded_email_html = render_to_string(
        "emails/first_forwarded_email.html",
        {
            "SITE_ORIGIN": settings.SITE_ORIGIN,
        },
    )

    wrapped_email = wrap_html_email(
        first_forwarded_email_html,
        "en-us",
        True,
        "test@example.com",
        0,
    )

    return HttpResponse(wrapped_email)


def wrap_html_email(
    original_html: str,
    language: str,
    has_premium: bool,
    display_email: str,
    num_level_one_email_trackers_removed: int | None = None,
    tracker_report_link: str | None = None,
) -> str:
    """Add Relay banners, surveys, etc. to an HTML email"""
    subplat_upgrade_link = get_subplat_upgrade_link_by_language(language)
    email_context = {
        "original_html": original_html,
        "language": language,
        "has_premium": has_premium,
        "subplat_upgrade_link": subplat_upgrade_link,
        "display_email": display_email,
        "tracker_report_link": tracker_report_link,
        "num_level_one_email_trackers_removed": num_level_one_email_trackers_removed,
        "SITE_ORIGIN": settings.SITE_ORIGIN,
    }
    content = render_to_string("emails/wrapped_email.html", email_context)
    # Remove empty lines
    content_lines = [line for line in content.splitlines() if line.strip()]
    return "\n".join(content_lines) + "\n"


def wrapped_email_test(request: HttpRequest) -> HttpResponse:
    """
    Demonstrate rendering of forwarded HTML emails.

    Settings like language can be given in the querystring, otherwise settings
    come from a randomly chosen profile.
    """

    if all(key in request.GET for key in ("language", "has_premium")):
        user_profile = None
    else:
        user_profile = Profile.objects.order_by("?").first()

    if "language" in request.GET:
        language = request.GET["language"]
    else:
        if user_profile is None:
            raise ValueError("user_profile must not be None")
        language = user_profile.language

    if "has_premium" in request.GET:
        has_premium = strtobool(request.GET["has_premium"])
    else:
        if user_profile is None:
            raise ValueError("user_profile must not be None")
        has_premium = user_profile.has_premium

    if "num_level_one_email_trackers_removed" in request.GET:
        num_level_one_email_trackers_removed = int(
            request.GET["num_level_one_email_trackers_removed"]
        )
    else:
        num_level_one_email_trackers_removed = 0

    if "has_tracker_report_link" in request.GET:
        has_tracker_report_link = strtobool(request.GET["has_tracker_report_link"])
    else:
        has_tracker_report_link = False
    if has_tracker_report_link:
        if num_level_one_email_trackers_removed:
            trackers = {
                "fake-tracker.example.com": num_level_one_email_trackers_removed
            }
        else:
            trackers = {}
        tracker_report_link = (
            "/tracker-report/#{"
            '"sender": "sender@example.com", '
            '"received_at": 1658434657, '
            f'"trackers": { json.dumps(trackers) }'
            "}"
        )
    else:
        tracker_report_link = ""

    path = "/emails/wrapped_email_test"
    old_query = {
        "language": language,
        "has_premium": "Yes" if has_premium else "No",
        "has_tracker_report_link": "Yes" if has_tracker_report_link else "No",
        "num_level_one_email_trackers_removed": str(
            num_level_one_email_trackers_removed
        ),
    }

    def switch_link(key, value):
        if old_query[key] == value:
            return str(value)
        new_query = old_query.copy()
        new_query[key] = value
        return f'<a href="{path}?{urlencode(new_query)}">{value}</a>'

    html_content = dedent(
        f"""\
    <p>
      <strong>Email rendering Test</strong>
    </p>
    <p>Settings: (<a href="{path}">clear all</a>)</p>
    <ul>
      <li>
        <strong>language</strong>:
        {escape(language)}
        (switch to
        {switch_link("language", "en-us")},
        {switch_link("language", "de")},
        {switch_link("language", "en-gb")},
        {switch_link("language", "fr")},
        {switch_link("language", "ru-ru")},
        {switch_link("language", "es-es")},
        {switch_link("language", "pt-br")},
        {switch_link("language", "it-it")},
        {switch_link("language", "en-ca")},
        {switch_link("language", "de-de")},
        {switch_link("language", "es-mx")})
      </li>
      <li>
        <strong>has_premium</strong>:
        {"Yes" if has_premium else "No"}
        (switch to
        {switch_link("has_premium", "Yes")},
        {switch_link("has_premium", "No")})
      </li>
      <li>
        <strong>has_tracker_report_link</strong>:
        {"Yes" if has_tracker_report_link else "No"}
        (switch to
        {switch_link("has_tracker_report_link", "Yes")},
        {switch_link("has_tracker_report_link", "No")})
      </li>
      <li>
        <strong>num_level_one_email_trackers_removed</strong>:
        {num_level_one_email_trackers_removed}
        (switch to
        {switch_link("num_level_one_email_trackers_removed", "0")},
        {switch_link("num_level_one_email_trackers_removed", "1")},
        {switch_link("num_level_one_email_trackers_removed", "2")})
      </li>
    </ul>
    """
    )

    wrapped_email = wrap_html_email(
        original_html=html_content,
        language=language,
        has_premium=has_premium,
        tracker_report_link=tracker_report_link,
        display_email="test@relay.firefox.com",
        num_level_one_email_trackers_removed=num_level_one_email_trackers_removed,
    )
    return HttpResponse(wrapped_email)


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
    if isinstance(address, DomainAddress):
        reply_create_args["domain_address"] = address
    else:
        if not isinstance(address, RelayAddress):
            raise TypeError("address must be type RelayAddress")
        reply_create_args["relay_address"] = address
    Reply.objects.create(**reply_create_args)
    return mail


@csrf_exempt
def sns_inbound(request):
    incr_if_enabled("sns_inbound", 1)
    # First thing we do is verify the signature
    json_body = json.loads(request.body)
    verified_json_body = verify_from_sns(json_body)

    # Validate ARN and message type
    topic_arn = verified_json_body.get("TopicArn", None)
    message_type = verified_json_body.get("Type", None)
    error_details = validate_sns_arn_and_type(topic_arn, message_type)
    if error_details:
        logger.error("validate_sns_arn_and_type_error", extra=error_details)
        return HttpResponse(error_details["error"], status=400)

    return _sns_inbound_logic(topic_arn, message_type, verified_json_body)


def validate_sns_arn_and_type(
    topic_arn: str | None, message_type: str | None
) -> dict[str, Any] | None:
    """
    Validate Topic ARN and SNS Message Type.

    If an error is detected, the return is a dictionary of error details.
    If no error is detected, the return is None.
    """
    if not topic_arn:
        error = "Received SNS request without Topic ARN."
    elif topic_arn not in settings.AWS_SNS_TOPIC:
        error = "Received SNS message for wrong topic."
    elif not message_type:
        error = "Received SNS request without Message Type."
    elif message_type not in SUPPORTED_SNS_TYPES:
        error = "Received SNS message for unsupported Type."
    else:
        error = None

    if error:
        return {
            "error": error,
            "received_topic_arn": shlex.quote(topic_arn) if topic_arn else topic_arn,
            "supported_topic_arn": sorted(settings.AWS_SNS_TOPIC),
            "received_sns_type": (
                shlex.quote(message_type) if message_type else message_type
            ),
            "supported_sns_types": SUPPORTED_SNS_TYPES,
        }
    return None


def _sns_inbound_logic(topic_arn, message_type, json_body):
    if message_type == "SubscriptionConfirmation":
        info_logger.info(
            "SNS SubscriptionConfirmation",
            extra={"SubscribeURL": json_body["SubscribeURL"]},
        )
        return HttpResponse("Logged SubscribeURL", status=200)
    if message_type == "Notification":
        incr_if_enabled("sns_inbound_Notification", 1)
        return _sns_notification(json_body)

    logger.error(
        "SNS message type did not fall under the SNS inbound logic",
        extra={"message_type": shlex.quote(message_type)},
    )
    capture_message(
        "Received SNS message with type not handled in inbound log",
        level="error",
        stack=True,
    )
    return HttpResponse(
        "Received SNS message with type not handled in inbound log", status=400
    )


def _sns_notification(json_body):
    try:
        message_json = json.loads(json_body["Message"])
    except JSONDecodeError:
        logger.error(
            "SNS notification has non-JSON message body",
            extra={"content": shlex.quote(json_body["Message"])},
        )
        return HttpResponse("Received SNS notification with non-JSON body", status=400)

    event_type = message_json.get("eventType")
    notification_type = message_json.get("notificationType")
    if notification_type not in {
        "Complaint",
        "Received",
        "Bounce",
    } and event_type not in {"Complaint", "Bounce"}:
        logger.error(
            "SNS notification for unsupported type",
            extra={
                "notification_type": shlex.quote(notification_type),
                "event_type": shlex.quote(event_type),
                "keys": [shlex.quote(key) for key in message_json.keys()],
            },
        )
        return HttpResponse(
            (
                "Received SNS notification for unsupported Type: "
                f"{html.escape(shlex.quote(notification_type))}"
            ),
            status=400,
        )
    response = _sns_message(message_json)
    bucket, object_key = _get_bucket_and_key_from_s3_json(message_json)
    if response.status_code < 500:
        remove_message_from_s3(bucket, object_key)

    return response


def _get_recipient_with_relay_domain(recipients):
    domains_to_check = get_domains_from_settings().values()
    for recipient in recipients:
        for domain in domains_to_check:
            if domain in recipient:
                return recipient
    return None


def _get_relay_recipient_from_message_json(message_json):
    # Go thru all To, Cc, and Bcc fields and
    # return the one that has a Relay domain

    # First check common headers for to or cc match
    headers_to_check = "to", "cc"
    common_headers = message_json["mail"]["commonHeaders"]
    for header in headers_to_check:
        if header in common_headers:
            recipient = _get_recipient_with_relay_domain(common_headers[header])
            if recipient is not None:
                return parseaddr(recipient)[1]

    # SES-SNS sends bcc in a different part of the message
    recipients = message_json["receipt"]["recipients"]
    return _get_recipient_with_relay_domain(recipients)


def _sns_message(message_json: AWS_SNSMessageJSON) -> HttpResponse:
    incr_if_enabled("sns_inbound_Notification_Received", 1)
    init_waffle_flags()
    notification_type = message_json.get("notificationType")
    event_type = message_json.get("eventType")
    if notification_type == "Bounce" or event_type == "Bounce":
        return _handle_bounce(message_json)
    if notification_type == "Complaint" or event_type == "Complaint":
        return _handle_complaint(message_json)
    if notification_type != "Received":
        raise ValueError('notification_type must be "Received"')
    if event_type is not None:
        raise ValueError("event_type must be None")
    return _handle_received(message_json)


# Enumerate the reasons that an email was not forwarded.
# This excludes emails dropped due to mask forwarding settings,
# such as "block all" and "block promotional". Those are logged
# as Glean email_blocked events.
EmailDroppedReason = Literal[
    "auto_block_spam",  # Email identified as spam, user has the auto_block_spam flag
    "dmarc_reject_failed",  # Email failed DMARC check with a reject policy
    "hard_bounce_pause",  # The user recently had a hard bounce
    "soft_bounce_pause",  # The user recently has a soft bounce
    "abuse_flag",  # The user exceeded an abuse limit, like mails forwarded
    "user_deactivated",  # The user account is deactivated
    "reply_requires_premium",  # The email is a reply from a free user
    "content_missing",  # Could not load the email from storage
    "error_from_header",  # Error generating the From: header, retryable
    "error_storage",  # Error fetching the email contents from storage (S3), retryable
    "error_sending",  # Error sending the forwarded email (SES), retryable
]


def log_email_dropped(
    reason: EmailDroppedReason,
    mask: RelayAddress | DomainAddress,
    is_reply: bool = False,
    can_retry: bool = False,
) -> None:
    """
    Log that an email was dropped for a reason other than a mask blocking setting.

    This mirrors the interface of glean_logger().log_email_blocked(), which
    records emails dropped due to the mask's blocking setting.
    """
    extra: dict[str, str | int | bool] = {"reason": reason}
    if mask.user.profile.metrics_enabled:
        if mask.user.profile.fxa is not None:
            extra["fxa_id"] = mask.user.profile.fxa.uid
        extra["mask_id"] = mask.metrics_id
    extra |= {
        "is_random_mask": isinstance(mask, RelayAddress),
        "is_reply": is_reply,
        "can_retry": can_retry,
    }
    info_logger.info("email_dropped", extra=extra)


def _handle_received(message_json: AWS_SNSMessageJSON) -> HttpResponse:
    """
    Handle an AWS SES received notification.

    For more information, see:
    https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html

    Returns (may be incomplete):
    * 200 if the email was sent, the Relay address is disabled, the Relay user is
      flagged for abuse, the email is under a bounce pause, the email was suppressed
      for spam, the list email was blocked, or the noreply address was the recipient.
    * 400 if commonHeaders entry is missing, the Relay recipient address is malformed,
      the email failed DMARC with reject policy, or the email is a reply chain to a
      non-premium user.
    * 404 if an S3-stored email was not found, no Relay address was found in the "To",
      "CC", or "BCC" fields, or the Relay address is not in the database.
    * 503 if the "From" address is malformed, the S3 client returned an error different
      from "not found", or the SES client fails

    And many other returns conditions if the email is a reply. The HTTP returns are an
    artifact from an earlier time when emails were sent to a webhook. Currently,
    production instead pulls events from a queue.

    TODO: Return a more appropriate status object
    TODO: Document the metrics emitted
    """
    mail = message_json["mail"]
    if "commonHeaders" not in mail:
        logger.error("SNS message without commonHeaders")
        return HttpResponse(
            "Received SNS notification without commonHeaders.", status=400
        )
    common_headers = mail["commonHeaders"]
    receipt = message_json["receipt"]

    _record_receipt_verdicts(receipt, "all")
    to_address = _get_relay_recipient_from_message_json(message_json)
    if to_address is None:
        incr_if_enabled("no_relay_domain_in_recipient_fields", 1)
        return HttpResponse("Address does not exist", status=404)

    _record_receipt_verdicts(receipt, "relay_recipient")
    from_addresses = parse_email_header(common_headers["from"][0])
    if not from_addresses:
        info_logger.error(
            "_handle_received: no from address",
            extra={
                "source": mail["source"],
                "common_headers_from": common_headers["from"],
            },
        )
        return HttpResponse("Unable to parse From address", status=400)
    from_address = from_addresses[0][1]

    try:
        [to_local_portion, to_domain_portion] = to_address.split("@")
    except ValueError:
        # TODO: Add metric
        return HttpResponse("Malformed to field.", status=400)

    if to_local_portion.lower() == "noreply":
        incr_if_enabled("email_for_noreply_address", 1)
        return HttpResponse("noreply address is not supported.")
    try:
        # FIXME: this ambiguous return of either
        # RelayAddress or DomainAddress types makes the Rustacean in me throw
        # up a bit.
        address = _get_address(to_address)
        prefetch_related_objects([address.user], "socialaccount_set", "profile")
        user_profile = address.user.profile
    except (
        ObjectDoesNotExist,
        CannotMakeAddressException,
        DeletedAddress.MultipleObjectsReturned,
    ):
        if to_local_portion.lower() == "replies":
            response = _handle_reply(from_address, message_json, to_address)
        else:
            response = HttpResponse("Address does not exist", status=404)
        return response

    _record_receipt_verdicts(receipt, "valid_user")
    # if this is spam and the user is set to auto-block spam, early return
    if user_profile.auto_block_spam and _get_verdict(receipt, "spam") == "FAIL":
        incr_if_enabled("email_auto_suppressed_for_spam", 1)
        log_email_dropped(reason="auto_block_spam", mask=address)
        return HttpResponse("Address rejects spam.")

    if _get_verdict(receipt, "dmarc") == "FAIL":
        policy = receipt.get("dmarcPolicy", "none")
        # TODO: determine action on dmarcPolicy "quarantine"
        if policy == "reject":
            log_email_dropped(reason="dmarc_reject_failed", mask=address)
            incr_if_enabled(
                "email_suppressed_for_dmarc_failure",
                tags=["dmarcPolicy:reject", "dmarcVerdict:FAIL"],
            )
            return HttpResponse("DMARC failure, policy is reject", status=400)

    # if this user is over bounce limits, early return
    bounce_paused, bounce_type = user_profile.check_bounce_pause()
    if bounce_paused:
        _record_receipt_verdicts(receipt, "user_bounce_paused")
        incr_if_enabled(f"email_suppressed_for_{bounce_type}_bounce", 1)
        reason: Literal["soft_bounce_pause", "hard_bounce_pause"] = (
            "soft_bounce_pause" if bounce_type == "soft" else "hard_bounce_pause"
        )
        log_email_dropped(reason=reason, mask=address)
        return HttpResponse("Address is temporarily disabled.")

    # check if this is a reply from an external sender to a Relay user
    try:
        (lookup_key, _) = _get_keys_from_headers(mail["headers"])
        reply_record = _get_reply_record_from_lookup_key(lookup_key)
        user_address = address
        address = reply_record.address
        message_id = _get_message_id_from_headers(mail["headers"])
        # make sure the relay user is premium
        if not _reply_allowed(from_address, to_address, reply_record, message_id):
            log_email_dropped(reason="reply_requires_premium", mask=user_address)
            return HttpResponse("Relay replies require a premium account", status=403)
    except (ReplyHeadersNotFound, Reply.DoesNotExist):
        # if there's no In-Reply-To header, or the In-Reply-To value doesn't
        # match a Reply record, continue to treat this as a regular email from
        # an external sender to a relay user
        pass

    # if account flagged for abuse, early return
    if user_profile.is_flagged:
        log_email_dropped(reason="abuse_flag", mask=address)
        return HttpResponse("Address is temporarily disabled.")

    if not user_profile.user.is_active:
        log_email_dropped(reason="user_deactivated", mask=address)
        return HttpResponse("Account is deactivated.")

    # if address is set to block, early return
    if not address.enabled:
        incr_if_enabled("email_for_disabled_address", 1)
        address.num_blocked += 1
        address.save(update_fields=["num_blocked"])
        _record_receipt_verdicts(receipt, "disabled_alias")
        user_profile.last_engagement = datetime.now(UTC)
        user_profile.save()
        glean_logger().log_email_blocked(mask=address, reason="block_all")
        return HttpResponse("Address is temporarily disabled.")

    _record_receipt_verdicts(receipt, "active_alias")
    incr_if_enabled("email_for_active_address", 1)

    # if address is blocking list emails, and email is from list, early return
    if (
        address
        and address.block_list_emails
        and user_profile.has_premium
        and _check_email_from_list(mail["headers"])
    ):
        incr_if_enabled("list_email_for_address_blocking_lists", 1)
        address.num_blocked += 1
        address.save(update_fields=["num_blocked"])
        user_profile.last_engagement = datetime.now(UTC)
        user_profile.save()
        glean_logger().log_email_blocked(mask=address, reason="block_promotional")
        return HttpResponse("Address is not accepting list emails.")

    # Collect new headers
    subject = common_headers.get("subject", "")
    destination_address = user_profile.user.email
    reply_address = get_reply_to_address()
    try:
        from_header = generate_from_header(from_address, to_address)
    except InvalidFromHeader:
        # TODO: MPP-3407, MPP-3417 - Determine how to handle these
        header_from = []
        for header in mail["headers"]:
            if header["name"].lower() == "from":
                header_from.append(header)
        info_logger.error(
            "generate_from_header",
            extra={
                "from_address": from_address,
                "source": mail["source"],
                "common_headers_from": common_headers["from"],
                "headers_from": header_from,
            },
        )
        log_email_dropped(reason="error_from_header", mask=address, can_retry=True)
        return HttpResponse("Cannot parse the From address", status=503)

    # Get incoming email
    try:
        (incoming_email_bytes, transport, load_time_s) = _get_email_bytes(message_json)
    except ClientError as e:
        if e.response["Error"].get("Code", "") == "NoSuchKey":
            logger.error("s3_object_does_not_exist", extra=e.response["Error"])
            log_email_dropped(reason="content_missing", mask=address)
            return HttpResponse("Email not in S3", status=404)
        logger.error("s3_client_error_get_email", extra=e.response["Error"])
        log_email_dropped(reason="error_storage", mask=address, can_retry=True)
        # we are returning a 503 so that SNS can retry the email processing
        return HttpResponse("Cannot fetch the message content from S3", status=503)

    # Handle developer overrides, logging
    dev_action = _get_developer_mode_action(address)
    if dev_action:
        if dev_action.new_destination_address:
            destination_address = dev_action.new_destination_address
        _log_dev_notification(
            "_handle_received: developer_mode", dev_action, message_json
        )

    # Convert to new email
    headers: OutgoingHeaders = {
        "Subject": subject,
        "From": from_header,
        "To": destination_address,
        "Reply-To": reply_address,
        "Resent-From": from_address,
    }
    sample_trackers = bool(sample_is_active("tracker_sample"))
    tracker_removal_flag = flag_is_active_in_task("tracker_removal", address.user)
    remove_level_one_trackers = bool(
        tracker_removal_flag and user_profile.remove_level_one_email_trackers
    )
    (
        forwarded_email,
        issues,
        level_one_trackers_removed,
        has_html,
        has_text,
    ) = _convert_to_forwarded_email(
        incoming_email_bytes=incoming_email_bytes,
        headers=headers,
        to_address=to_address,
        from_address=from_address,
        language=user_profile.language,
        has_premium=user_profile.has_premium,
        sample_trackers=sample_trackers,
        remove_level_one_trackers=remove_level_one_trackers,
    )
    if has_html:
        incr_if_enabled("email_with_html_content", 1)
    if has_text:
        incr_if_enabled("email_with_text_content", 1)
    if issues:
        info_logger.info(
            "_handle_received: forwarding issues", extra={"issues": issues}
        )

    # Send new email
    try:
        ses_response = ses_send_raw_email(
            source_address=reply_address,
            destination_address=destination_address,
            message=forwarded_email,
        )
    except ClientError:
        # 503 service unavailable response to SNS so it can retry
        log_email_dropped(reason="error_sending", mask=address, can_retry=True)
        return HttpResponse("SES client error on Raw Email", status=503)

    message_id = ses_response["MessageId"]
    _store_reply_record(mail, message_id, address)

    user_profile.update_abuse_metric(
        email_forwarded=True, forwarded_email_size=len(incoming_email_bytes)
    )
    user_profile.last_engagement = datetime.now(UTC)
    user_profile.save()
    address.num_forwarded += 1
    address.last_used_at = datetime.now(UTC)
    if level_one_trackers_removed:
        address.num_level_one_trackers_blocked = (
            address.num_level_one_trackers_blocked or 0
        ) + level_one_trackers_removed
    address.save(
        update_fields=[
            "num_forwarded",
            "last_used_at",
            "block_list_emails",
            "num_level_one_trackers_blocked",
        ]
    )
    glean_logger().log_email_forwarded(mask=address, is_reply=False)
    return HttpResponse("Sent email to final recipient.", status=200)


class DeveloperModeAction(NamedTuple):
    mask_id: str
    action: Literal["log", "simulate_complaint"] = "log"
    new_destination_address: str | None = None


def _get_verdict(receipt, verdict_type):
    return receipt[f"{verdict_type}Verdict"]["status"]


def _check_email_from_list(headers):
    for header in headers:
        if header["name"].lower().startswith("list-"):
            return True
    return False


def _record_receipt_verdicts(receipt, state):
    verdict_tags = []
    for key in sorted(receipt.keys()):
        if key.endswith("Verdict"):
            value = receipt[key]["status"]
            verdict_tags.append(f"{key}:{value}")
            incr_if_enabled(f"relay.emails.verdicts.{key}", 1, [f"state:{state}"])
        elif key == "dmarcPolicy":
            value = receipt[key]
            verdict_tags.append(f"{key}:{value}")
    incr_if_enabled(f"relay.emails.state.{state}", 1, verdict_tags)


def _get_message_id_from_headers(headers):
    message_id = None
    for header in headers:
        if header["name"].lower() == "message-id":
            message_id = header["value"]
    return message_id


def _get_keys_from_headers(headers):
    in_reply_to = None
    for header in headers:
        if header["name"].lower() == "in-reply-to":
            in_reply_to = header["value"]
            message_id_bytes = get_message_id_bytes(in_reply_to)
            return derive_reply_keys(message_id_bytes)

        if header["name"].lower() == "references":
            message_ids = header["value"]
            for message_id in message_ids.split(" "):
                message_id_bytes = get_message_id_bytes(message_id)
                lookup_key, encryption_key = derive_reply_keys(message_id_bytes)
                try:
                    # FIXME: calling code is likely to duplicate this query
                    _get_reply_record_from_lookup_key(lookup_key)
                    return lookup_key, encryption_key
                except Reply.DoesNotExist:
                    pass
            raise Reply.DoesNotExist
    incr_if_enabled("mail_to_replies_without_reply_headers", 1)
    raise ReplyHeadersNotFound


def _get_reply_record_from_lookup_key(lookup_key):
    lookup = b64_lookup_key(lookup_key)
    return Reply.objects.get(lookup=lookup)


def _strip_localpart_tag(address):
    [localpart, domain] = address.split("@")
    subaddress_parts = localpart.split("+")
    return f"{subaddress_parts[0]}@{domain}"


_TransportType = Literal["sns", "s3"]


def _get_email_bytes(
    message_json: AWS_SNSMessageJSON,
) -> tuple[bytes, _TransportType, float]:
    with Timer(logger=None) as load_timer:
        if "content" in message_json:
            # email content in sns message
            message_content = message_json["content"].encode("utf-8")
            transport: Literal["sns", "s3"] = "sns"
        else:
            # assume email content in S3
            bucket, object_key = _get_bucket_and_key_from_s3_json(message_json)
            message_content = get_message_content_from_s3(bucket, object_key)
            transport = "s3"
        histogram_if_enabled("relayed_email.size", len(message_content))
    load_time_s = round(load_timer.last, 3)
    return (message_content, transport, load_time_s)


def _get_developer_mode_action(
    mask: RelayAddress | DomainAddress,
) -> DeveloperModeAction | None:
    """Get the developer mode actions for this mask, if enabled."""

    if not (
        flag_is_active_in_task("developer_mode", mask.user)
        and "DEV:" in mask.description
    ):
        return None

    if "DEV:simulate_complaint" in mask.description:
        action = DeveloperModeAction(
            mask_id=mask.metrics_id,
            action="simulate_complaint",
            new_destination_address=f"complaint+{mask.metrics_id}@simulator.amazonses.com",
        )
    else:
        action = DeveloperModeAction(mask_id=mask.metrics_id, action="log")
    return action


def _log_dev_notification(
    log_message: str, dev_action: DeveloperModeAction, notification: dict[str, Any]
) -> None:
    """
    Log notification JSON

    This will log information beyond our privacy policy, so it should only be used on
    Relay staff accounts with prior permission.

    The notification JSON will be compressed, Ascii85-encoded with padding, and broken
    into 1024-bytes chunks. This will ensure it fits into GCP's log entry, which has a
    64KB limit per label value.
    """

    notification_gza85 = encode_dict_gza85(notification)
    total_parts = notification_gza85.count("\n") + 1
    log_group_id = uuid4()
    for partnum, part in enumerate(notification_gza85.splitlines()):
        info_logger.info(
            log_message,
            extra={
                "mask_id": dev_action.mask_id,
                "dev_action": dev_action.action,
                "log_group_id": log_group_id,
                "part": partnum,
                "parts": total_parts,
                "notification_gza85": part,
            },
        )


def _convert_to_forwarded_email(
    incoming_email_bytes: bytes,
    headers: OutgoingHeaders,
    to_address: str,
    from_address: str,
    language: str,
    has_premium: bool,
    sample_trackers: bool,
    remove_level_one_trackers: bool,
    now: datetime | None = None,
) -> tuple[EmailMessage, EmailForwardingIssues, int, bool, bool]:
    """
    Convert an email (as bytes) to a forwarded email.

    Return is a tuple:
    - email - The forwarded email
    - issues - Any detected issues in conversion
    - level_one_trackers_removed (int) - Number of trackers removed
    - has_html - True if the email has an HTML representation
    - has_text - True if the email has a plain text representation
    """
    email = message_from_bytes(incoming_email_bytes, policy=relay_policy)
    # python/typeshed issue 2418
    # The Python 3.2 default was Message, 3.6 uses policy.message_factory, and
    # policy.default.message_factory is EmailMessage
    if not isinstance(email, EmailMessage):
        raise TypeError("email must be type EmailMessage")

    # Replace headers in the original email
    header_issues = _replace_headers(email, headers)

    # Find and replace text content
    text_body = email.get_body("plain")
    text_content = None
    has_text = False
    if text_body:
        has_text = True
        if not isinstance(text_body, EmailMessage):
            raise TypeError("text_body must be type EmailMessage")
        text_content = text_body.get_content()
        new_text_content = _convert_text_content(text_content, to_address)
        text_body.set_content(new_text_content)

    # Find and replace HTML content
    html_body = email.get_body("html")
    level_one_trackers_removed = 0
    has_html = False
    if html_body:
        has_html = True
        if not isinstance(html_body, EmailMessage):
            raise TypeError("html_body must be type EmailMessage")
        html_content = html_body.get_content()
        new_content, level_one_trackers_removed = _convert_html_content(
            html_content,
            to_address,
            from_address,
            language,
            has_premium,
            sample_trackers,
            remove_level_one_trackers,
        )
        html_body.set_content(new_content, subtype="html")
    elif text_content:
        # Try to use the text content to generate HTML content
        html_content = urlize_and_linebreaks(text_content)
        new_content, level_one_trackers_removed = _convert_html_content(
            html_content,
            to_address,
            from_address,
            language,
            has_premium,
            sample_trackers,
            remove_level_one_trackers,
        )
        if not isinstance(text_body, EmailMessage):
            raise TypeError("text_body must be type EmailMessage")
        try:
            text_body.add_alternative(new_content, subtype="html")
        except TypeError as e:
            out = StringIO()
            _structure(email, fp=out)
            info_logger.error(
                "Adding HTML alternate failed",
                extra={"exception": str(e), "structure": out.getvalue()},
            )

    issues: EmailForwardingIssues = {}
    if header_issues:
        issues["headers"] = header_issues
    return (email, issues, level_one_trackers_removed, has_html, has_text)


def _replace_headers(
    email: EmailMessage, headers: OutgoingHeaders
) -> EmailHeaderIssues:
    """
    Replace the headers in email with new headers.

    This replaces headers in the passed email object, rather than returns an altered
    copy. The primary reason is that the Python email package can read an email with
    non-compliant headers or content, but can't write it. A read/write is required to
    create a copy that we then alter. This code instead alters the passed EmailMessage
    object, making header-specific changes in try / except statements.

    The other reason is the object size. An Email can be up to 10 MB, and we hope to
    support 40 MB emails someday. Modern servers may be OK with this, but it would be
    nice to handle the non-compliant headers without crashing before we add a source of
    memory-related crashes.
    """
    # Look for headers to drop
    to_drop: list[str] = []
    replacements: set[str] = {_k.lower() for _k in headers.keys()}
    issues: EmailHeaderIssues = []

    # Detect non-compliant headers in incoming emails
    for header in email.keys():
        try:
            value = email[header]
        except Exception as e:
            issues.append(
                {"header": header, "direction": "in", "exception_on_read": repr(e)}
            )
            value = None
        if getattr(value, "defects", None):
            issues.append(
                {
                    "header": header,
                    "direction": "in",
                    "defect_count": len(value.defects),
                    "parsed_value": str(value),
                    "raw_value": str(value.as_raw),
                }
            )
        elif getattr(getattr(value, "_parse_tree", None), "all_defects", []):
            issues.append(
                {
                    "header": header,
                    "direction": "in",
                    "defect_count": len(value._parse_tree.all_defects),
                    "parsed_value": str(value),
                    "raw_value": str(value.as_raw),
                }
            )

    # Collect headers that will not be forwarded
    for header in email.keys():
        header_lower = header.lower()
        if (
            header_lower not in replacements
            and header_lower != "mime-version"
            and not header_lower.startswith("content-")
        ):
            to_drop.append(header)

    # Drop headers that should be dropped
    for header in to_drop:
        del email[header]

    # Replace the requested headers
    for header, value in headers.items():
        del email[header]
        try:
            email[header] = value.rstrip("\r\n")
        except Exception as e:
            issues.append(
                {
                    "header": header,
                    "direction": "out",
                    "exception_on_write": repr(e),
                    "value": value,
                }
            )
            continue
        try:
            parsed_value = email[header]
        except Exception as e:
            issues.append(
                {
                    "header": header,
                    "direction": "out",
                    "exception_on_write": repr(e),
                    "value": value,
                }
            )
            continue
        if parsed_value.defects:
            issues.append(
                {
                    "header": header,
                    "direction": "out",
                    "defect_count": len(parsed_value.defects),
                    "parsed_value": str(parsed_value),
                    "raw_value": str(parsed_value.as_raw),
                },
            )

    return issues


def _convert_html_content(
    html_content: str,
    to_address: str,
    from_address: str,
    language: str,
    has_premium: bool,
    sample_trackers: bool,
    remove_level_one_trackers: bool,
    now: datetime | None = None,
) -> tuple[str, int]:
    # frontend expects a timestamp in milliseconds
    now = now or datetime.now(UTC)
    datetime_now_ms = int(now.timestamp() * 1000)

    # scramble alias so that clients don't recognize it
    # and apply default link styles
    display_email = re.sub("([@.:])", r"<span>\1</span>", to_address)

    # sample tracker numbers
    if sample_trackers:
        count_all_trackers(html_content)

    tracker_report_link = ""
    removed_count = 0
    if remove_level_one_trackers:
        html_content, tracker_details = remove_trackers(
            html_content, from_address, datetime_now_ms
        )
        removed_count = tracker_details["tracker_removed"]
        tracker_report_details = {
            "sender": from_address,
            "received_at": datetime_now_ms,
            "trackers": tracker_details["level_one"]["trackers"],
        }
        tracker_report_link = f"{settings.SITE_ORIGIN}/tracker-report/#" + json.dumps(
            tracker_report_details
        )

    wrapped_html = wrap_html_email(
        original_html=html_content,
        language=language,
        has_premium=has_premium,
        display_email=display_email,
        tracker_report_link=tracker_report_link,
        num_level_one_email_trackers_removed=removed_count,
    )
    return wrapped_html, removed_count


def _convert_text_content(text_content: str, to_address: str) -> str:
    relay_header_text = (
        "This email was sent to your alias "
        f"{to_address}. To stop receiving emails sent to this alias, "
        "update the forwarding settings in your dashboard.\n"
        "---Begin Email---\n"
    )
    wrapped_text = relay_header_text + text_content
    return wrapped_text


def _build_reply_requires_premium_email(
    from_address: str,
    reply_record: Reply,
    message_id: str | None,
    decrypted_metadata: dict[str, Any] | None,
) -> EmailMessage:
    # If we haven't forwarded a first reply for this user yet, _reply_allowed
    # will forward.  So, tell the user we forwarded it.
    forwarded = not reply_record.address.user.profile.forwarded_first_reply
    sender: str | None = ""
    if decrypted_metadata is not None:
        sender = decrypted_metadata.get("reply-to") or decrypted_metadata.get("from")
    ctx = {
        "sender": sender or "",
        "forwarded": forwarded,
        "SITE_ORIGIN": settings.SITE_ORIGIN,
    }
    html_body = render_to_string("emails/reply_requires_premium.html", ctx)
    text_body = render_to_string("emails/reply_requires_premium.txt", ctx)

    # Create the message
    msg = EmailMessage()
    msg["Subject"] = ftl_bundle.format("replies-not-included-in-free-account-header")
    msg["From"] = get_reply_to_address()
    msg["To"] = from_address
    if message_id:
        msg["In-Reply-To"] = message_id
        msg["References"] = message_id
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    return msg


def _set_forwarded_first_reply(profile):
    profile.forwarded_first_reply = True
    profile.save()


def _send_reply_requires_premium_email(
    from_address: str,
    reply_record: Reply,
    message_id: str | None,
    decrypted_metadata: dict[str, Any] | None,
) -> None:
    msg = _build_reply_requires_premium_email(
        from_address, reply_record, message_id, decrypted_metadata
    )
    try:
        ses_send_raw_email(
            source_address=get_reply_to_address(premium=False),
            destination_address=from_address,
            message=msg,
        )
        # If we haven't forwarded a first reply for this user yet, _reply_allowed will.
        # So, updated the DB.
        _set_forwarded_first_reply(reply_record.address.user.profile)
    except ClientError as e:
        logger.error("reply_not_allowed_ses_client_error", extra=e.response["Error"])
    incr_if_enabled("free_user_reply_attempt", 1)


def _reply_allowed(
    from_address, to_address, reply_record, message_id=None, decrypted_metadata=None
):
    stripped_from_address = _strip_localpart_tag(from_address)
    reply_record_email = reply_record.address.user.email
    stripped_reply_record_address = _strip_localpart_tag(reply_record_email)
    if (from_address == reply_record_email) or (
        stripped_from_address == stripped_reply_record_address
    ):
        # This is a Relay user replying to an external sender;

        if not reply_record.profile.user.is_active:
            return False

        if reply_record.profile.is_flagged:
            return False

        if reply_record.owner_has_premium:
            return True

        # if we haven't forwarded a first reply for this user, return True to allow
        # this first reply
        allow_first_reply = not reply_record.address.user.profile.forwarded_first_reply
        _send_reply_requires_premium_email(
            from_address, reply_record, message_id, decrypted_metadata
        )
        return allow_first_reply
    else:
        # The From: is not a Relay user, so make sure this is a reply *TO* a
        # premium Relay user
        try:
            address = _get_address(to_address)
            if address.user.profile.has_premium:
                return True
        except ObjectDoesNotExist:
            return False
    incr_if_enabled("free_user_reply_attempt", 1)
    return False


def _handle_reply(
    from_address: str, message_json: AWS_SNSMessageJSON, to_address: str
) -> HttpResponse:
    """
    Handle a reply from a Relay user to an external email.

    Returns (may be incomplete):
    * 200 if the reply was sent
    * 400 if the In-Reply-To and References headers are missing, none of the References
      headers are a reply record, or the SES client raises an error
    * 403 if the Relay user is not allowed to reply
    * 404 if the S3-stored email is not found, or there is no matching Reply record in
      the database
    * 503 if the S3 client returns an error (other than not found), or the SES client
      returns an error

    TODO: Return a more appropriate status object (see _handle_received)
    TODO: Document metrics emitted
    """
    mail = message_json["mail"]
    try:
        (lookup_key, encryption_key) = _get_keys_from_headers(mail["headers"])
    except ReplyHeadersNotFound:
        incr_if_enabled("reply_email_header_error", 1, tags=["detail:no-header"])
        return HttpResponse("No In-Reply-To header", status=400)

    try:
        reply_record = _get_reply_record_from_lookup_key(lookup_key)
    except Reply.DoesNotExist:
        incr_if_enabled("reply_email_header_error", 1, tags=["detail:no-reply-record"])
        return HttpResponse("Unknown or stale In-Reply-To header", status=404)

    address = reply_record.address
    message_id = _get_message_id_from_headers(mail["headers"])
    decrypted_metadata = json.loads(
        decrypt_reply_metadata(encryption_key, reply_record.encrypted_metadata)
    )
    if not _reply_allowed(
        from_address, to_address, reply_record, message_id, decrypted_metadata
    ):
        log_email_dropped(reason="reply_requires_premium", mask=address, is_reply=True)
        return HttpResponse("Relay replies require a premium account", status=403)

    outbound_from_address = address.full_address
    incr_if_enabled("reply_email", 1)
    subject = mail["commonHeaders"].get("subject", "")
    to_address = decrypted_metadata.get("reply-to") or decrypted_metadata.get("from")
    headers: OutgoingHeaders = {
        "Subject": subject,
        "From": outbound_from_address,
        "To": to_address,
        "Reply-To": outbound_from_address,
    }

    try:
        (email_bytes, transport, load_time_s) = _get_email_bytes(message_json)
    except ClientError as e:
        if e.response["Error"].get("Code", "") == "NoSuchKey":
            logger.error("s3_object_does_not_exist", extra=e.response["Error"])
            log_email_dropped(reason="content_missing", mask=address, is_reply=True)
            return HttpResponse("Email not in S3", status=404)
        logger.error("s3_client_error_get_email", extra=e.response["Error"])
        log_email_dropped(
            reason="error_storage", mask=address, is_reply=True, can_retry=True
        )
        # we are returning a 500 so that SNS can retry the email processing
        return HttpResponse("Cannot fetch the message content from S3", status=503)

    email = message_from_bytes(email_bytes, policy=relay_policy)
    if not isinstance(email, EmailMessage):
        raise TypeError("email must be type EmailMessage")

    # Convert to a reply email
    # TODO: Issue #1747 - Remove wrapper / prefix in replies
    _replace_headers(email, headers)

    try:
        ses_send_raw_email(
            source_address=outbound_from_address,
            destination_address=to_address,
            message=email,
        )
    except ClientError:
        log_email_dropped(reason="error_sending", mask=address, is_reply=True)
        return HttpResponse("SES client error", status=400)

    reply_record.increment_num_replied()
    profile = address.user.profile
    profile.update_abuse_metric(replied=True)
    profile.last_engagement = datetime.now(UTC)
    profile.save()
    glean_logger().log_email_forwarded(mask=address, is_reply=True)
    return HttpResponse("Sent email to final recipient.", status=200)


def _get_domain_address(
    local_portion: str, domain_portion: str, create: bool = True
) -> DomainAddress:
    """
    Find or create the DomainAddress for the parts of an email address.

    If the domain_portion is for a valid subdomain, and create=True, a new DomainAddress
    will be created and returned. If create=False, DomainAddress.DoesNotExist is raised.

    If the domain_portion is for an unknown domain, ObjectDoesNotExist is raised.

    If the domain_portion is for an unclaimed subdomain, Profile.DoesNotExist is raised.
    """

    [address_subdomain, address_domain] = domain_portion.split(".", 1)
    if address_domain != get_domains_from_settings()["MOZMAIL_DOMAIN"]:
        if create:
            incr_if_enabled("email_for_not_supported_domain", 1)
        raise ObjectDoesNotExist("Address does not exist")
    try:
        with transaction.atomic():
            locked_profile = Profile.objects.select_for_update().get(
                subdomain=address_subdomain
            )
            domain_numerical = get_domain_numerical(address_domain)
            # filter DomainAddress because it may not exist
            # which will throw an error with get()
            domain_address = DomainAddress.objects.filter(
                user=locked_profile.user, address=local_portion, domain=domain_numerical
            ).first()
            if domain_address is None:
                if not create:
                    raise DomainAddress.DoesNotExist()
                # TODO: Consider flows when a user generating alias on a fly
                # was unable to receive an email due to user no longer being a
                # premium user as seen in exception thrown on make_domain_address
                domain_address = DomainAddress.make_domain_address(
                    locked_profile.user, local_portion, True
                )
                glean_logger().log_email_mask_created(
                    mask=domain_address,
                    created_by_api=False,
                )
            domain_address.last_used_at = datetime.now(UTC)
            domain_address.save()
            return domain_address
    except Profile.DoesNotExist as e:
        if create:
            incr_if_enabled("email_for_dne_subdomain", 1)
        raise e


def _get_address(address: str, create: bool = True) -> RelayAddress | DomainAddress:
    """
    Find or create the RelayAddress or DomainAddress for an email address.

    If an unknown email address is for a valid subdomain, and create is True,
    a new DomainAddress will be created.

    On failure, raises exception based on Django's ObjectDoesNotExist:
    * RelayAddress.DoesNotExist - looks like RelayAddress, deleted or does not exist
    * Profile.DoesNotExist - looks like DomainAddress, no subdomain match
    * DomainAddress.DoesNotExist - looks like unknown DomainAddress, create is False
    * ObjectDoesNotExist - Unknown domain
    """

    local_portion, domain_portion = address.split("@")
    local_address = local_portion.lower()
    domain = domain_portion.lower()

    # if the domain is not the site's 'top' relay domain,
    # it may be for a user's subdomain
    email_domains = get_domains_from_settings().values()
    if domain not in email_domains:
        return _get_domain_address(local_address, domain, create)

    # the domain is the site's 'top' relay domain, so look up the RelayAddress
    try:
        domain_numerical = get_domain_numerical(domain)
        relay_address = RelayAddress.objects.get(
            address=local_address, domain=domain_numerical
        )
        return relay_address
    except RelayAddress.DoesNotExist as e:
        if not create:
            raise e
        try:
            DeletedAddress.objects.get(
                address_hash=address_hash(local_address, domain=domain)
            )
            incr_if_enabled("email_for_deleted_address", 1)
            # TODO: create a hard bounce receipt rule in SES
        except DeletedAddress.DoesNotExist:
            incr_if_enabled("email_for_unknown_address", 1)
        except DeletedAddress.MultipleObjectsReturned:
            # not sure why this happens on stage but let's handle it
            incr_if_enabled("email_for_deleted_address_multiple", 1)
        raise e


def _get_address_if_exists(address: str) -> RelayAddress | DomainAddress | None:
    """Get the matching RelayAddress or DomainAddress, or None if it doesn't exist."""
    try:
        return _get_address(address, create=False)
    except (RelayAddress.DoesNotExist, Profile.DoesNotExist, ObjectDoesNotExist):
        return None


def _handle_bounce(message_json: AWS_SNSMessageJSON) -> HttpResponse:
    """
    Handle an AWS SES bounce notification.

    For more information, see:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#bounce-object

    Returns:
    * 404 response if any email address does not match a user,
    * 200 response if all match or none are given

    Emits a counter metric "email_bounce" with these tags:
    * bounce_type: 'permanent', 'transient', 'undetermined', 'none' if omitted
    * bounce_subtype: 'undetermined', 'general', etc., 'none' if omitted
    * user_match: 'found', 'missing', error states 'no_address' and 'no_recipients'
    * relay_action: 'no_action', 'auto_block_spam', 'hard_bounce', 'soft_bounce'

    Emits an info log "bounce_notification", same data as metric, plus:
    * bounce_action: 'action' from bounced recipient data, or None
    * bounce_status: 'status' from bounced recipient data, or None
    * bounce_diagnostic: 'diagnosticCode' from bounced recipient data, or None
    * bounce_extra: Extra data from bounce_recipient data, if any
    * domain: User's real email address domain, if an address was given
    * fxa_id - The Mozilla account (previously known as Firefox Account) ID of the user
    """
    bounce = message_json.get("bounce", {})
    bounce_type = bounce.get("bounceType", "none")
    bounce_subtype = bounce.get("bounceSubType", "none")
    bounced_recipients = bounce.get("bouncedRecipients", [])

    now = datetime.now(UTC)
    bounce_data = []
    for recipient in bounced_recipients:
        recipient_address = recipient.pop("emailAddress", None)
        data = {
            "bounce_type": bounce_type,
            "bounce_subtype": bounce_subtype,
            "bounce_action": recipient.pop("action", ""),
            "bounce_status": recipient.pop("status", ""),
            "bounce_diagnostic": recipient.pop("diagnosticCode", ""),
            "user_match": "no_address",
            "relay_action": "no_action",
        }
        if recipient:
            data["bounce_extra"] = recipient.copy()
        bounce_data.append(data)

        if recipient_address is None:
            continue

        recipient_address = parseaddr(recipient_address)[1]
        recipient_domain = recipient_address.split("@")[1]
        data["domain"] = recipient_domain

        try:
            user = User.objects.get(email=recipient_address)
            profile = user.profile
            data["user_match"] = "found"
            if (fxa := profile.fxa) and profile.metrics_enabled:
                data["fxa_id"] = fxa.uid
            else:
                data["fxa_id"] = ""
        except User.DoesNotExist:
            # TODO: handle bounce for a user who no longer exists
            # add to SES account-wide suppression list?
            data["user_match"] = "missing"
            continue

        action = None
        if "spam" in data["bounce_diagnostic"].lower():
            # if an email bounced as spam, set to auto block spam for this user
            # and DON'T set them into bounce pause state
            action = "auto_block_spam"
            profile.auto_block_spam = True
        elif bounce_type == "Permanent":
            # TODO: handle sub-types: 'General', 'NoEmail', etc.
            action = "hard_bounce"
            profile.last_hard_bounce = now
        elif bounce_type == "Transient":
            # TODO: handle sub-types: 'MessageTooLarge', 'AttachmentRejected', etc.
            action = "soft_bounce"
            profile.last_soft_bounce = now
        if action:
            data["relay_action"] = action
            profile.save()

    if not bounce_data:
        # Data when there are no identified recipients
        bounce_data = [{"user_match": "no_recipients", "relay_action": "no_action"}]

    for data in bounce_data:
        tags = {
            "bounce_type": bounce_type,
            "bounce_subtype": bounce_subtype,
            "user_match": data["user_match"],
            "relay_action": data["relay_action"],
        }
        incr_if_enabled(
            "email_bounce",
            1,
            tags=[generate_tag(key, val) for key, val in tags.items()],
        )
        info_logger.info("bounce_notification", extra=data)

    if any(data["user_match"] == "missing" for data in bounce_data):
        return HttpResponse("Address does not exist", status=404)
    return HttpResponse("OK", status=200)


def _build_disabled_mask_for_spam_email(
    mask: RelayAddress | DomainAddress,
) -> EmailMessage:
    ctx = {"mask": mask.full_address, "SITE_ORIGIN": settings.SITE_ORIGIN}
    html_body = render_to_string("emails/disabled_mask_for_spam.html", ctx)
    text_body = render_to_string("emails/disabled_mask_for_spam.txt", ctx)

    # Create the message
    msg = EmailMessage()
    msg["Subject"] = ftl_bundle.format("relay-deactivated-your-mask")
    msg["From"] = settings.RELAY_FROM_ADDRESS
    msg["To"] = mask.user.email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    return msg


def _send_disabled_mask_for_spam_email(mask: RelayAddress | DomainAddress) -> None:
    msg = _build_disabled_mask_for_spam_email(mask)
    if not settings.RELAY_FROM_ADDRESS:
        raise ValueError(
            "Must set settings.RELAY_FROM_ADDRESS to send disabled_mask_for_spam email."
        )
    try:
        ses_send_raw_email(
            source_address=settings.RELAY_FROM_ADDRESS,
            destination_address=mask.user.email,
            message=msg,
        )
    except ClientError as e:
        logger.error("send_disabled_mask_ses_client_error", extra=e.response["Error"])
    incr_if_enabled("send_disabled_mask_email", 1)


def _handle_complaint(message_json: AWS_SNSMessageJSON) -> HttpResponse:
    """
    Handle an AWS SES complaint notification.

    This looks for Relay users in the complainedRecipients (real email address)
    and the From: header (mask address). We expect both to match the same Relay user,
    and return a 200. If one or the other do not match, a 404 is returned, and errors
    may be logged.

    The first time a user complains, this sets the user's auto_block_spam flag to True.

    The second time a user complains, this disables the mask thru which the spam mail
    was forwarded, and sends an email to the user to notify them the mask is disabled
    and can be re-enabled on their dashboard.

    For more information on the complaint notification, see:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object

    Returns:
    * 404 response if any email address does not match a user,
    * 200 response if all match or none are given

    Emits a counter metric "email_complaint" with these tags:
    * complaint_subtype: 'onaccountsuppressionlist', or 'none' if omitted
    * complaint_feedback - feedback enumeration from ISP (usually 'abuse') or 'none'
    * user_match: 'found' or 'no_recipients'
    * relay_action: 'no_action', 'auto_block_spam', or 'disable_mask'

    Emits an info log "complaint_notification", same data as metric, plus:
    * complaint_user_agent - identifies the client used to file the complaint
    * complaint_extra - Extra data from complainedRecipients data, if any
    * domain - User's domain, if an address was given
    * found_in - "complained_recipients" (real email), "from_header" (email mask),
      or "all" (matching records found in both)
    * fxa_id - The Mozilla account (previously known as Firefox Account) ID of the user
    * mask_match - "found" if "From" header contains an email mask, or "not_found"
    """
    complaint_data = _get_complaint_data(message_json)
    complainers, unknown_count = _gather_complainers(complaint_data)

    # Reduce future complaints from complaining Relay users
    actions: list[ComplaintAction] = []
    for complainer in complainers:
        action = _reduce_future_complaints(complainer)
        actions.append(action)

        if (
            flag_is_active_in_task("developer_mode", complainer["user"])
            and action.mask_id
        ):
            _log_dev_notification(
                "_handle_complaint: developer_mode",
                DeveloperModeAction(mask_id=action.mask_id, action="log"),
                message_json,
            )

    # Log complaint and actions taken
    if not actions:
        # Log the complaint but that no action was taken
        actions.append(ComplaintAction(user_match="no_recipients"))
    for action in actions:
        tags = [
            generate_tag(key, val)
            for key, val in {
                "complaint_subtype": complaint_data.subtype or "none",
                "complaint_feedback": complaint_data.feedback_type or "none",
                "user_match": action.user_match,
                "relay_action": action.relay_action,
            }.items()
        ]
        incr_if_enabled("email_complaint", tags=tags)

        log_extra = {
            "complaint_subtype": complaint_data.subtype or None,
            "complaint_user_agent": complaint_data.user_agent or None,
            "complaint_feedback": complaint_data.feedback_type or None,
        }
        log_extra.update(
            {
                key: value
                for key, value in action._asdict().items()
                if (value is not None and key != "mask_id")
            }
        )
        info_logger.info("complaint_notification", extra=log_extra)

    if unknown_count:
        return HttpResponse("Address does not exist", status=404)
    return HttpResponse("OK", status=200)


class RawComplaintData(NamedTuple):
    complained_recipients: list[tuple[str, dict[str, Any]]]
    from_addresses: list[str]
    subtype: str
    user_agent: str
    feedback_type: str


def _get_complaint_data(message_json: AWS_SNSMessageJSON) -> RawComplaintData:
    """
    Extract complaint data from an AWS SES Complaint Notification.

    This extracts only the data used by _handle_complaint(). It also works on
    complaint events, which have a similar structure and the same data needed
    by _handle_complaint.

    For more information on the complaint notification, see:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object
    """
    complaint = message_json["complaint"]

    T = TypeVar("T")

    def get_or_log(
        key: str, source: dict[str, T], data_type: type[T]
    ) -> tuple[T, bool]:
        """Get a value from a dictionary, or log if not found"""
        if key in source:
            return source[key], True
        logger.error(
            "_get_complaint_data: Unexpected message format",
            extra={"missing_key": key, "found_keys": ",".join(sorted(source.keys()))},
        )
        return data_type(), False

    raw_recipients, has_cr = get_or_log("complainedRecipients", complaint, list)
    complained_recipients = []
    no_entries = True
    for entry in raw_recipients:
        no_entries = False
        raw_email_address, has_email = get_or_log("emailAddress", entry, str)
        if has_email:
            email_address = parseaddr(raw_email_address)[1]
            extra = {
                key: value for key, value in entry.items() if key != "emailAddress"
            }
            complained_recipients.append((email_address, extra))
    if has_cr and no_entries:
        logger.error("_get_complaint_data: Empty complainedRecipients")

    mail, has_mail = get_or_log("mail", message_json, dict)
    if has_mail:
        commonHeaders, has_ch = get_or_log("commonHeaders", mail, dict)
    else:
        commonHeaders, has_ch = {}, False
    if has_ch:
        raw_from_addresses, _ = get_or_log("from", commonHeaders, list)
    else:
        raw_from_addresses = []
    from_addresses = [parseaddr(addr)[1] for addr in raw_from_addresses]

    feedback_type, _ = get_or_log("complaintFeedbackType", complaint, str)

    # Only present when destination is on account suppression list
    subtype = complaint.get("complaintSubType", "")
    # Only present for feedback reports
    user_agent = complaint.get("userAgent", "")

    return RawComplaintData(
        complained_recipients, from_addresses, subtype, user_agent, feedback_type
    )


class Complainer(TypedDict):
    user: User
    found_in: Literal["complained_recipients", "from_header", "all"]
    domain: str
    extra: dict[str, Any] | None
    masks: list[RelayAddress | DomainAddress]


def _gather_complainers(
    complaint_data: RawComplaintData,
) -> tuple[list[Complainer], int]:
    """
    Fetch Relay Users and masks from the complaint data.

    This matches data from an AWS SES Complaint Notification (as extracted by
    _get_complaint_data()) to the Relay database, and returns the Users,
    RelayAddresses, and DomainAddresses, as well as status and extra data.

    If the complaint came from the AWS SES complaint simulator, detect
    developer_mode and move forward with the developer's User data.
    """

    users: dict[int, Complainer] = {}
    unknown_complainer_count = 0
    for email_address, extra_data in complaint_data.complained_recipients:
        local, domain = email_address.split("@", 1)

        # For developer mode complaint simulation, swap with developer's email
        if domain == "simulator.amazonses.com" and local.startswith("complaint+"):
            mask_metrics_id = local.removeprefix("complaint+")
            mask = _get_mask_by_metrics_id(mask_metrics_id)
            if mask:
                email_address = mask.user.email
                domain = mask.user.email.split("@")[1]

        try:
            user = User.objects.get(email=email_address)
        except User.DoesNotExist:
            logger.error("_gather_complainers: unknown complainedRecipient")
            unknown_complainer_count += 1
            continue

        if user.id in users:
            logger.error("_gather_complainers: complainer appears twice")
            continue

        users[user.id] = {
            "user": user,
            "found_in": "complained_recipients",
            "domain": domain,
            "extra": extra_data or None,
            "masks": [],
        }

    # Collect From: addresses and their users
    unknown_sender_count = 0
    for email_address in complaint_data.from_addresses:
        mask = _get_address_if_exists(email_address)
        if not mask:
            logger.error("_gather_complainers: unknown mask, maybe deleted?")
            unknown_sender_count += 1
            continue

        if mask.user.id not in users:
            # Add mask-only entry to users
            users[mask.user.id] = {
                "user": mask.user,
                "found_in": "from_header",
                "domain": mask.user.email.split("@")[1],
                "extra": None,
                "masks": [mask],
            }
            continue

        user_data = users[mask.user.id]
        if mask in user_data["masks"]:
            logger.error("_gather_complainers: mask appears twice")
            continue

        user_data["masks"].append(mask)
        if user_data["found_in"] in ("all", "complained_recipients"):
            user_data["found_in"] = "all"
        else:
            logger.error("_gather_complainers: no complainer, multi-mask")

    return (list(users.values()), unknown_complainer_count + unknown_sender_count)


def _get_mask_by_metrics_id(metrics_id: str) -> RelayAddress | DomainAddress | None:
    """Look up a mask by metrics ID, or None if not found."""
    if not metrics_id or metrics_id[0] not in ("R", "D"):
        return None
    mask_type_id = metrics_id[0]
    mask_raw_id = metrics_id[1:]
    try:
        mask_id = int(mask_raw_id)
    except ValueError:
        return None  # ID is not an int, do not try to match to Relay mask

    if mask_type_id == "R":
        try:
            return RelayAddress.objects.get(id=mask_id)
        except RelayAddress.DoesNotExist:
            return None
    try:
        return DomainAddress.objects.get(id=mask_id)
    except DomainAddress.DoesNotExist:
        return None


class ComplaintAction(NamedTuple):
    user_match: Literal["found", "no_recipients"]
    relay_action: Literal["no_action", "auto_block_spam", "disable_mask"] = "no_action"
    mask_match: Literal["found", "not_found"] = "not_found"
    mask_id: str | None = None
    found_in: Literal["complained_recipients", "from_header", "all"] | None = None
    fxa_id: str | None = None
    domain: str | None = None
    complaint_extra: str | None = None


def _reduce_future_complaints(complainer: Complainer) -> ComplaintAction:
    """Take action to reduce future complaints from complaining user."""

    user = complainer["user"]
    mask_match: Literal["found", "not_found"] = "not_found"
    relay_action: Literal["no_action", "auto_block_spam", "disable_mask"] = "no_action"
    mask_id = None

    if not user.profile.auto_block_spam:
        relay_action = "auto_block_spam"
        user.profile.auto_block_spam = True
        user.profile.save()

    for mask in complainer["masks"]:
        mask_match = "found"
        mask_id = mask.metrics_id
        if (
            flag_is_active_in_task("disable_mask_on_complaint", user)
            and mask.enabled
            and relay_action != "auto_block_spam"
        ):
            relay_action = "disable_mask"
            mask.enabled = False
            mask.save()
            _send_disabled_mask_for_spam_email(mask)

    return ComplaintAction(
        user_match="found",
        relay_action=relay_action,
        mask_match=mask_match,
        mask_id=mask_id,
        fxa_id=user.profile.metrics_fxa_id,
        domain=complainer["domain"],
        found_in=complainer["found_in"],
        complaint_extra=(
            json.dumps(complainer["extra"]) if complainer["extra"] else None
        ),
    )


_WAFFLE_FLAGS_INITIALIZED = False


def init_waffle_flags() -> None:
    """Initialize waffle flags for email tasks"""
    global _WAFFLE_FLAGS_INITIALIZED
    if _WAFFLE_FLAGS_INITIALIZED:
        return

    flags: list[tuple[str, str]] = [
        (
            "disable_mask_on_complaint",
            "MPP-3119: When a Relay user marks an email as spam, disable the mask.",
        ),
        (
            "developer_mode",
            "MPP-3932: Enable logging and overrides for Relay developers.",
        ),
    ]
    waffle_flag_table = get_waffle_flag_model().objects
    for name, note in flags:
        waffle_flag_table.get_or_create(name=name, defaults={"note": note})
    _WAFFLE_FLAGS_INITIALIZED = True
