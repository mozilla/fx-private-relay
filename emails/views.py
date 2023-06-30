from copy import deepcopy
from datetime import datetime, timezone
from email import message_from_bytes, policy
from email.mime.multipart import MIMEMultipart
from email.utils import parseaddr
import html
import json
from json import JSONDecodeError
import logging
import mimetypes
import os
import re
import shlex
from tempfile import SpooledTemporaryFile
from textwrap import dedent
from typing import Any, Optional
from urllib.parse import urlencode

from botocore.exceptions import ClientError
from decouple import strtobool
from django.shortcuts import render
from sentry_sdk import capture_message
from markus.utils import generate_tag
from waffle import sample_is_active

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import prefetch_related_objects
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt


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
from .types import AWS_SNSMessageJSON, MessageBody, OutgoingHeaders
from .utils import (
    _get_bucket_and_key_from_s3_json,
    b64_lookup_key,
    count_all_trackers,
    create_message,
    decrypt_reply_metadata,
    derive_reply_keys,
    generate_from_header,
    generate_relay_From,
    get_message_content_from_s3,
    get_message_id_bytes,
    get_reply_to_address,
    histogram_if_enabled,
    incr_if_enabled,
    remove_message_from_s3,
    remove_trackers,
    ses_relay_email,
    ses_send_raw_email,
    urlize_and_linebreaks,
)
from .sns import verify_from_sns, SUPPORTED_SNS_TYPES

from privaterelay.ftl_bundles import main as ftl_bundle
from privaterelay.utils import flag_is_active_in_task

RESENDER_HEADERS_FLAG_NAME = "resender_headers"

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
        "forwarded": False,
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


def wrap_html_email(
    original_html,
    language,
    has_premium,
    display_email,
    num_level_one_email_trackers_removed=None,
    tracker_report_link=0,
):
    """Add Relay banners, surveys, etc. to an HTML email"""
    email_context = {
        "original_html": original_html,
        "language": language,
        "has_premium": has_premium,
        "display_email": display_email,
        "tracker_report_link": tracker_report_link,
        "num_level_one_email_trackers_removed": num_level_one_email_trackers_removed,
        "SITE_ORIGIN": settings.SITE_ORIGIN,
    }
    return render_to_string("emails/wrapped_email.html", email_context)


def wrapped_email_test(request):
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
        assert user_profile is not None
        language = user_profile.language

    if "has_premium" in request.GET:
        has_premium = strtobool(request.GET["has_premium"])
    else:
        assert user_profile is not None
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
    topic_arn: str, message_type: str
) -> Optional[dict[str, Any]]:
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
            "received_topic_arn": shlex.quote(topic_arn),
            "supported_topic_arn": sorted(settings.AWS_SNS_TOPIC),
            "received_sns_type": shlex.quote(message_type),
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
            "Received SNS notification for unsupported Type: %s"
            % html.escape(shlex.quote(notification_type)),
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

    # First check commmon headers for to or cc match
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
    notification_type = message_json.get("notificationType")
    event_type = message_json.get("eventType")
    if notification_type == "Bounce" or event_type == "Bounce":
        return _handle_bounce(message_json)
    if notification_type == "Complaint" or event_type == "Complaint":
        return _handle_complaint(message_json)
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
    from_address = parseaddr(common_headers["from"][0])[1]
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
        return HttpResponse("Address rejects spam.")

    if _get_verdict(receipt, "dmarc") == "FAIL":
        policy = receipt.get("dmarcPolicy", "none")
        # TODO: determine action on dmarcPolicy "quarantine"
        if policy == "reject":
            incr_if_enabled(
                "email_suppressed_for_dmarc_failure",
                1,
                tags=["dmarcPolicy:reject", "dmarcVerdict:FAIL"],
            )
            return HttpResponse("DMARC failure, policy is reject", status=400)

    # if this user is over bounce limits, early return
    bounce_paused, bounce_type = user_profile.check_bounce_pause()
    if bounce_paused:
        _record_receipt_verdicts(receipt, "user_bounce_paused")
        incr_if_enabled("email_suppressed_for_%s_bounce" % bounce_type, 1)
        return HttpResponse("Address is temporarily disabled.")

    # check if this is a reply from an external sender to a Relay user
    try:
        (lookup_key, _) = _get_keys_from_headers(mail["headers"])
        reply_record = _get_reply_record_from_lookup_key(lookup_key)
        address = reply_record.address
        message_id = _get_message_id_from_headers(mail["headers"])
        # make sure the relay user is premium
        if not _reply_allowed(from_address, to_address, reply_record, message_id):
            # TODO: Add metrics
            return HttpResponse("Relay replies require a premium account", status=403)
    except (ReplyHeadersNotFound, Reply.DoesNotExist):
        # if there's no In-Reply-To header, or the In-Reply-To value doesn't
        # match a Reply record, continue to treat this as a regular email from
        # an external sender to a relay user
        pass

    # if account flagged for abuse, early return
    if user_profile.is_flagged:
        return HttpResponse("Address is temporarily disabled.")

    # if address is set to block, early return
    if not address.enabled:
        incr_if_enabled("email_for_disabled_address", 1)
        address.num_blocked += 1
        address.save(update_fields=["num_blocked"])
        _record_receipt_verdicts(receipt, "disabled_alias")
        # TODO: Add metrics
        return HttpResponse("Address is temporarily disabled.")

    _record_receipt_verdicts(receipt, "active_alias")
    incr_if_enabled("email_for_active_address", 1)

    # if address is blocking list emails, and email is from list, early return
    email_is_from_list = _check_email_from_list(mail["headers"])
    if address and address.block_list_emails and email_is_from_list:
        incr_if_enabled("list_email_for_address_blocking_lists", 1)
        address.num_blocked += 1
        address.save(update_fields=["num_blocked"])
        return HttpResponse("Address is not accepting list emails.")

    subject = common_headers.get("subject", "")

    try:
        (
            text_content,
            html_content,
            attachments,
            email_size,
        ) = _get_text_html_attachments(message_json)
    except ClientError as e:
        if e.response["Error"].get("Code", "") == "NoSuchKey":
            logger.error("s3_object_does_not_exist", extra=e.response["Error"])
            return HttpResponse("Email not in S3", status=404)
        logger.error("s3_client_error_get_email", extra=e.response["Error"])
        # we are returning a 503 so that SNS can retry the email processing
        return HttpResponse("Cannot fetch the message content from S3", status=503)

    # sample tracker numbers
    if sample_is_active("tracker-sample") and html_content:
        count_all_trackers(html_content)

    # scramble alias so that clients don't recognize it
    # and apply default link styles
    display_email = re.sub("([@.:])", r"<span>\1</span>", to_address)

    message_body: MessageBody = {}
    tracker_report_link = ""
    removed_count = 0
    # frontend expects a timestamp in milliseconds
    datetime_now = int(datetime.now(timezone.utc).timestamp() * 1000)

    if html_content:
        incr_if_enabled("email_with_html_content", 1)
        tracker_removal_active = flag_is_active_in_task("tracker_removal", address.user)
        if tracker_removal_active and user_profile.remove_level_one_email_trackers:
            html_content, tracker_details = remove_trackers(
                html_content, from_address, datetime_now
            )
            removed_count = tracker_details["tracker_removed"]
            datetime_now = int(
                datetime.now(timezone.utc).timestamp() * 1000
            )  # frontend is expecting in milli seconds
            tracker_report_details = {
                "sender": from_address,
                "received_at": datetime_now,
                "trackers": tracker_details["level_one"]["trackers"],
            }
            tracker_report_link = (
                f"{settings.SITE_ORIGIN}/tracker-report/#"
                + json.dumps(tracker_report_details)
            )
            address.num_level_one_trackers_blocked = (
                address.num_level_one_trackers_blocked or 0
            ) + removed_count
            address.save()

        wrapped_html = wrap_html_email(
            original_html=html_content,
            language=user_profile.language,
            has_premium=user_profile.has_premium,
            display_email=display_email,
            tracker_report_link=tracker_report_link,
            num_level_one_email_trackers_removed=removed_count,
        )
        message_body["Html"] = {"Charset": "UTF-8", "Data": wrapped_html}

    if text_content:
        incr_if_enabled("email_with_text_content", 1)
        relay_header_text = (
            "This email was sent to your alias "
            f"{to_address}. To stop receiving emails sent to this alias, "
            "update the forwarding settings in your dashboard.\n"
            "---Begin Email---\n"
        )
        wrapped_text = relay_header_text + text_content
        message_body["Text"] = {"Charset": "UTF-8", "Data": wrapped_text}

    use_resender_headers = flag_is_active_in_task(
        RESENDER_HEADERS_FLAG_NAME, user_profile.user
    )
    destination_address = user_profile.user.email
    reply_address = get_reply_to_address()
    if use_resender_headers:
        from_header = generate_from_header(from_address, to_address)
        source_address = reply_address
    else:
        from_header = generate_relay_From(from_address, user_profile)
        source_address = from_header

    headers: OutgoingHeaders = {
        "Subject": subject,
        "From": from_header,
        "To": destination_address,
        "Reply-To": reply_address,
    }
    if use_resender_headers:
        headers["Resent-From"] = from_address

    response = ses_relay_email(
        source_address,
        destination_address,
        headers,
        message_body,
        attachments,
        mail,
        address,
    )
    if response.status_code == 503:
        # early return the response to trigger SNS to re-attempt
        return response

    user_profile.update_abuse_metric(
        email_forwarded=True, forwarded_email_size=email_size
    )
    address.num_forwarded += 1
    address.last_used_at = datetime.now(timezone.utc)
    address.save(update_fields=["num_forwarded", "last_used_at"])
    return response


def _get_verdict(receipt, verdict_type):
    return receipt["%sVerdict" % verdict_type]["status"]


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


def _build_reply_requires_premium_email(
    from_address: str,
    reply_record: Reply,
    message_id: str | None,
    decrypted_metadata: dict[str, Any] | None,
) -> MIMEMultipart:
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
    subject_ftl_id = "replies-not-included-in-free-account-header"
    subject = ftl_bundle.format(subject_ftl_id)

    headers: OutgoingHeaders = {
        "Subject": subject,
        "From": get_reply_to_address(),
        "To": from_address,
    }
    if message_id:
        headers["In-Reply-To"] = message_id
        headers["References"] = message_id

    message_body: MessageBody = {
        "Html": {"Charset": "utf-8", "Data": html_body},
        "Text": {"Charset": "utf-8", "Data": text_body},
    }

    msg = create_message(headers, message_body)
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
        # TODO: should we return a 200 OK here?
        return HttpResponse("Relay replies require a premium account", status=403)

    outbound_from_address = address.full_address
    incr_if_enabled("reply_email", 1)
    subject = mail["commonHeaders"].get("subject", "")
    to_address = decrypted_metadata.get("reply-to") or decrypted_metadata.get("from")

    try:
        text_content, html_content, attachments, _ = _get_text_html_attachments(
            message_json
        )
    except ClientError as e:
        if e.response["Error"].get("Code", "") == "NoSuchKey":
            logger.error("s3_object_does_not_exist", extra=e.response["Error"])
            return HttpResponse("Email not in S3", status=404)
        logger.error("s3_client_error_get_email", extra=e.response["Error"])
        # we are returning a 500 so that SNS can retry the email processing
        return HttpResponse("Cannot fetch the message content from S3", status=503)

    message_body: MessageBody = {}
    if html_content:
        message_body["Html"] = {"Charset": "UTF-8", "Data": html_content}

    if text_content:
        message_body["Text"] = {"Charset": "UTF-8", "Data": text_content}

    headers: OutgoingHeaders = {
        "Subject": subject,
        "From": outbound_from_address,
        "To": to_address,
        "Reply-To": outbound_from_address,
    }
    try:
        response = ses_relay_email(
            outbound_from_address,
            to_address,
            headers,
            message_body,
            attachments,
            mail,
            address,
        )
        reply_record.increment_num_replied()
        profile = address.user.profile
        profile.update_abuse_metric(replied=True)
        return response
    except ClientError as e:
        logger.error("ses_client_error", extra=e.response["Error"])
        return HttpResponse("SES client error", status=400)


def _get_domain_address(local_portion: str, domain_portion: str) -> DomainAddress:
    """
    Find or create the DomainAddress for the parts of an email address.

    If the domain_portion is for a valid subdomain, a new DomainAddress
    will be created and returned.

    If the domain_portion is for an unknown domain, ObjectDoesNotExist is raised.

    If the domain_portion is for an unclaimed subdomain, Profile.DoesNotExist is raised.
    """

    [address_subdomain, address_domain] = domain_portion.split(".", 1)
    if address_domain != get_domains_from_settings()["MOZMAIL_DOMAIN"]:
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
                # TODO: Consider flows when a user generating alias on a fly
                # was unable to receive an email due to user no longer being a
                # premium user as seen in exception thrown on make_domain_address
                domain_address = DomainAddress.make_domain_address(
                    locked_profile, local_portion, True
                )
            domain_address.last_used_at = datetime.now(timezone.utc)
            domain_address.save()
            return domain_address
    except Profile.DoesNotExist as e:
        incr_if_enabled("email_for_dne_subdomain", 1)
        raise e


def _get_address(address: str) -> RelayAddress | DomainAddress:
    """
    Find or create the RelayAddress or DomainAddress for an email address.

    If an unknown email address is for a valid subdomain, a new DomainAddress
    will be created.

    On failure, raises exception based on Django's ObjectDoesNotExist:
    * RelayAddress.DoesNotExist - looks like RelayAddress, deleted or does not exist
    * Profile.DoesNotExist - looks like DomainAddress, no subdomain match
    * ObjectDoesNotExist - Unknown domain
    """

    local_portion, domain_portion = address.split("@")
    local_address = local_portion.lower()
    domain = domain_portion.lower()

    # if the domain is not the site's 'top' relay domain,
    # it may be for a user's subdomain
    email_domains = get_domains_from_settings().values()
    if domain not in email_domains:
        return _get_domain_address(local_address, domain)

    # the domain is the site's 'top' relay domain, so look up the RelayAddress
    try:
        domain_numerical = get_domain_numerical(domain)
        relay_address = RelayAddress.objects.get(
            address=local_address, domain=domain_numerical
        )
        return relay_address
    except RelayAddress.DoesNotExist as e:
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

    Emits a legacy log "bounced recipient domain: {domain}", with data from
    bounced recipient data, without the email address.
    """
    bounce = message_json.get("bounce", {})
    bounce_type = bounce.get("bounceType", "none")
    bounce_subtype = bounce.get("bounceSubType", "none")
    bounced_recipients = bounce.get("bouncedRecipients", [])

    now = datetime.now(timezone.utc)
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

        # Legacy log, can be removed Q4 2023
        recipient_domain = data.get("domain")
        if recipient_domain:
            legacy_extra = {
                "action": data.get("bounce_action"),
                "status": data.get("bounce_status"),
                "diagnosticCode": data.get("bounce_diagnostic"),
            }
            legacy_extra.update(data.get("bounce_extra", {}))
            info_logger.info(
                f"bounced recipient domain: {recipient_domain}", extra=legacy_extra
            )

    if any(data["user_match"] == "missing" for data in bounce_data):
        return HttpResponse("Address does not exist", status=404)
    return HttpResponse("OK", status=200)


def _handle_complaint(message_json: AWS_SNSMessageJSON) -> HttpResponse:
    """
    Handle an AWS SES complaint notification.

    For more information, see:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object

    Returns:
    * 404 response if any email address does not match a user,
    * 200 response if all match or none are given

    Emits a counter metric "email_complaint" with these tags:
    * complaint_subtype: 'onaccounsuppressionlist', or 'none' if omitted
    * complaint_feedback - feedback enumeration from ISP or 'none'
    * user_match: 'found', 'missing', error states 'no_address' and 'no_recipients'
    * relay_action: 'no_action', 'auto_block_spam'

    Emits an info log "complaint_notification", same data as metric, plus:
    * complaint_user_agent - identifies the client used to file the complaint
    * complaint_extra - Extra data from complainedRecipients data, if any
    * domain - User's domain, if an address was given

    Emits a legacy log "complaint_received", with data:
    * recipient_domains: list of extracted user domains
    * subtype: 'onaccounsuppressionlist', or 'none'
    * feedback: feedback from ISP or 'none'
    """
    complaint = deepcopy(message_json.get("complaint", {}))
    complained_recipients = complaint.pop("complainedRecipients", [])
    subtype = complaint.pop("complaintSubType", None)
    user_agent = complaint.pop("userAgent", None)
    feedback = complaint.pop("complaintFeedbackType", None)

    complaint_data = []
    for recipient in complained_recipients:
        recipient_address = recipient.pop("emailAddress", None)
        data = {
            "complaint_subtype": subtype,
            "complaint_user_agent": user_agent,
            "complaint_feedback": feedback,
            "user_match": "no_address",
            "relay_action": "no_action",
        }
        if recipient:
            data["complaint_extra"] = recipient.copy()
        complaint_data.append(data)

        if recipient_address is None:
            continue

        recipient_address = parseaddr(recipient_address)[1]
        recipient_domain = recipient_address.split("@")[1]
        data["domain"] = recipient_domain

        try:
            user = User.objects.get(email=recipient_address)
            profile = user.profile
            data["user_match"] = "found"
        except User.DoesNotExist:
            data["user_match"] = "missing"
            continue

        data["relay_action"] = "auto_block_spam"
        profile.auto_block_spam = True
        profile.save()

    if not complaint_data:
        # Data when there are no identified recipients
        complaint_data = [{"user_match": "no_recipients", "relay_action": "no_action"}]

    for data in complaint_data:
        tags = {
            "complaint_subtype": subtype or "none",
            "complaint_feedback": feedback or "none",
            "user_match": data["user_match"],
            "relay_action": data["relay_action"],
        }
        incr_if_enabled(
            "email_complaint",
            1,
            tags=[generate_tag(key, val) for key, val in tags.items()],
        )
        info_logger.info("complaint_notification", extra=data)

    # Legacy log, can be removed Q4 2023
    domains = [data["domain"] for data in complaint_data if "domain" in data]
    info_logger.info(
        "complaint_received",
        extra={
            "recipient_domains": sorted(domains),
            "subtype": subtype,
            "feedback": feedback,
        },
    )

    if any(data["user_match"] == "missing" for data in complaint_data):
        return HttpResponse("Address does not exist", status=404)
    return HttpResponse("OK", status=200)


def _get_text_html_attachments(message_json):
    if "content" in message_json:
        # email content in sns message
        message_content = message_json["content"].encode("utf-8")
    else:
        # assume email content in S3
        bucket, object_key = _get_bucket_and_key_from_s3_json(message_json)
        message_content = get_message_content_from_s3(bucket, object_key)
    email_size = len(message_content)
    histogram_if_enabled("relayed_email.size", email_size)
    bytes_email_message = message_from_bytes(message_content, policy=policy.default)

    text_content, html_content, attachments = _get_all_contents(bytes_email_message)
    # TODO: add logs on the entire size of the email and the time it takes to
    # download/process
    return text_content, html_content, attachments, email_size


def _get_attachment(part):
    incr_if_enabled("email_with_attachment", 1)
    fn = part.get_filename()
    ct = part.get_content_type()
    payload = part.get_payload(decode=True)
    payload_size = len(payload)
    if fn:
        extension = os.path.splitext(fn)[1]
    else:
        extension = mimetypes.guess_extension(ct)
    tag_type = "attachment"
    attachment_extension_tag = generate_tag(tag_type, extension)
    attachment_content_type_tag = generate_tag(tag_type, ct)
    histogram_if_enabled(
        "attachment.size",
        payload_size,
        [attachment_extension_tag, attachment_content_type_tag],
    )

    attachment = SpooledTemporaryFile(
        max_size=150 * 1000, prefix="relay_attachment_"  # 150KB max from SES
    )
    attachment.write(payload)
    return fn, attachment


def _get_all_contents(email_message):
    text_content = None
    html_content = None
    attachments = []
    if email_message.is_multipart():
        for part in email_message.walk():
            try:
                if part.is_attachment():
                    att_name, att = _get_attachment(part)
                    attachments.append((att_name, att))
                    continue
                if part.get_content_type() == "text/plain":
                    text_content = part.get_content()
                if part.get_content_type() == "text/html":
                    html_content = part.get_content()
            except KeyError:
                # log the un-handled content type but don't stop processing
                logger.error(
                    "part.get_content()", extra={"type": part.get_content_type()}
                )
        histogram_if_enabled("attachment.count_per_email", len(attachments))
        if text_content is not None and html_content is None:
            html_content = urlize_and_linebreaks(text_content)
    else:
        if email_message.get_content_type() == "text/plain":
            text_content = email_message.get_content()
            html_content = urlize_and_linebreaks(email_message.get_content())
        if email_message.get_content_type() == "text/html":
            html_content = email_message.get_content()

    # TODO: if html_content is still None, wrap the text_content with our
    # header and footer HTML and send that as the html_content
    return text_content, html_content, attachments
