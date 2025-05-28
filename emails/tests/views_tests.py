import glob
import json
import logging
import os
import re
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from email import message_from_string
from email.message import EmailMessage
from typing import Any, cast
from unittest._log import _LoggingWatcher
from unittest.mock import ANY, Mock, patch
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse
from django.test import Client, SimpleTestCase, TestCase, override_settings

import pytest
from allauth.socialaccount.models import SocialAccount
from botocore.exceptions import ClientError
from markus.main import MetricsRecord
from markus.testing import MetricsMock
from model_bakery import baker
from waffle.testutils import override_flag

from emails.models import (
    DeletedAddress,
    DomainAddress,
    RelayAddress,
    Reply,
    address_hash,
)
from emails.policy import relay_policy
from emails.types import AWS_SNSMessageJSON, OutgoingHeaders
from emails.utils import (
    InvalidFromHeader,
    b64_lookup_key,
    decode_dict_gza85,
    decrypt_reply_metadata,
    derive_reply_keys,
    encrypt_reply_metadata,
    get_domains_from_settings,
    get_message_id_bytes,
)
from emails.views import (
    EmailDroppedReason,
    RawComplaintData,
    ReplyHeadersNotFound,
    _build_disabled_mask_for_spam_email,
    _build_reply_requires_premium_email,
    _gather_complainers,
    _get_address,
    _get_address_if_exists,
    _get_complaint_data,
    _get_keys_from_headers,
    _get_mask_by_metrics_id,
    _record_receipt_verdicts,
    _replace_headers,
    _set_forwarded_first_reply,
    _sns_message,
    _sns_notification,
    log_email_dropped,
    reply_requires_premium_test,
    validate_sns_arn_and_type,
    wrapped_email_test,
)
from privaterelay.ftl_bundles import main
from privaterelay.glean.server_events import GLEAN_EVENT_MOZLOG_TYPE as GLEAN_LOG
from privaterelay.models import Profile
from privaterelay.tests.utils import (
    create_expected_glean_event,
    get_glean_event,
    log_extra,
    make_free_test_user,
    make_premium_test_user,
    upgrade_test_user_to_premium,
)

# Load the sns json fixtures from files
real_abs_cwd = os.path.realpath(os.path.join(os.getcwd(), os.path.dirname(__file__)))
single_rec_file = os.path.join(
    real_abs_cwd, "fixtures", "single_recipient_sns_body.json"
)


# Names of logs
INFO_LOG = "eventsinfo"
ERROR_LOG = "events"


def load_fixtures(file_suffix: str) -> dict[str, AWS_SNSMessageJSON | str]:
    """Load all fixtures with a particular suffix."""
    path = os.path.join(real_abs_cwd, "fixtures", "*" + file_suffix)
    ext = os.path.splitext(file_suffix)[1]
    fixtures: dict[str, AWS_SNSMessageJSON | str] = {}
    for fixture_file in glob.glob(path):
        file_name = os.path.basename(fixture_file)
        key = file_name[: -len(file_suffix)]
        assert key not in fixtures
        with open(fixture_file) as f:
            if ext == ".json":
                fixtures[key] = json.load(f)
            else:
                assert ext == ".email"
                fixtures[key] = f.read()
    return fixtures


def load_sns_fixtures(file_suffix: str) -> dict[str, AWS_SNSMessageJSON]:
    return cast(dict[str, AWS_SNSMessageJSON], load_fixtures(file_suffix + ".json"))


def load_email_fixtures(file_suffix: str) -> dict[str, str]:
    return cast(dict[str, str], load_fixtures(file_suffix + ".email"))


EMAIL_SNS_BODIES = load_sns_fixtures("_email_sns_body")
BOUNCE_SNS_BODIES = load_sns_fixtures("_bounce_sns_body")
INVALID_SNS_BODIES = load_sns_fixtures("_invalid_sns_body")
EMAIL_INCOMING = load_email_fixtures("_incoming")
EMAIL_EXPECTED = load_email_fixtures("_expected")

# Set mocked_function.side_effect = FAIL_TEST_IF_CALLED to safely disable a function
# for test and assert it was never called.
FAIL_TEST_IF_CALLED = Exception("This function should not have been called.")

# Set mocked ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED to
# simulate an error
SEND_RAW_EMAIL_FAILED = ClientError(
    operation_name="SES.send_raw_email",
    error_response={"Error": {"Code": "the code", "Message": "the message"}},
)


def create_email_from_notification(
    notification: AWS_SNSMessageJSON, text: str
) -> bytes:
    """
    Create an email from an SNS notification, return the serialized bytes.

    The email will have the headers from the notification and the `text` value as the
    plain text body.
    """
    message_json = notification.get("Message")
    assert message_json
    message = json.loads(message_json)
    assert "mail" in message
    mail_data = message["mail"]
    assert "content" not in mail_data
    email = EmailMessage()
    assert "headers" in mail_data
    for entry in mail_data["headers"]:
        email[entry["name"]] = entry["value"]
    assert email["Content-Type"].startswith("multipart/alternative")
    email.add_alternative(text, subtype="plain")
    return email.as_bytes()


def create_notification_from_email(email_text: str) -> AWS_SNSMessageJSON:
    """
    Create an SNS notification from a raw serialized email.

    The SNS notification is designed to be processed by _handle_received, and can be
    processed by _sns_inbound_logic and _sns_notification, which will pass it to
    _handle_received. It will not pass the external view sns_inbound, because it will
    fail signature checking, since it has a fake Signature and SigningCertURL.

    The SNS notification has a passing receipt, such as a passing spamVerdict,
    virusVerdict, and dmarcVerdict.

    The SNS notification will have the headers from the email and other mocked items.
    The email will be included in the notification body, not loaded from (mock) S3.
    """
    email = message_from_string(email_text, policy=relay_policy)
    topic_arn = "arn:aws:sns:us-east-1:168781634622:ses-inbound-grelay"
    if email["Message-ID"]:
        message_id = getattr(email["Message-ID"], "as_unstructured")
    else:
        message_id = None
    # This function cannot handle malformed To: addresses
    assert not getattr(email["To"], "defects")
    email_date = (
        getattr(email["Date"], "datetime")
        if "Date" in email
        else (datetime.now() - timedelta(minutes=5))
    )

    sns_message = {
        "notificationType": "Received",
        "mail": {
            "timestamp": email_date.isoformat(),
            # To handle invalid From address, find 'first' address with what looks like
            # an email portion and use that email, or fallback to invalid@example.com
            "source": next(
                (
                    addr.addr_spec
                    for addr in getattr(email["From"], "addresses")
                    if "@" in addr.addr_spec
                ),
                "invalid@example.com",
            ),
            "messageId": message_id,
            "destination": [
                addr.addr_spec for addr in getattr(email["To"], "addresses")
            ],
            "headersTruncated": False,
            "headers": [
                {"name": _h, "value": str(getattr(_v, "as_unstructured"))}
                for _h, _v in email.items()
            ],
            "commonHeaders": {
                "from": [getattr(email["From"], "as_unstructured")],
                "date": email["Date"],
                "to": [str(addr) for addr in getattr(email["To"], "addresses")],
                "messageId": message_id,
                "subject": getattr(email["Subject"], "as_unstructured"),
            },
        },
        "receipt": {
            "timestamp": (email_date + timedelta(seconds=1)).isoformat(),
            "processingTimeMillis": 1001,
            "recipients": [
                addr.addr_spec for addr in getattr(email["To"], "addresses")
            ],
            "spamVerdict": {"status": "PASS"},
            "virusVerdict": {"status": "PASS"},
            "spfVerdict": {"status": "PASS"},
            "dkimVerdict": {"status": "PASS"},
            "dmarcVerdict": {"status": "PASS"},
            "action": {"type": "SNS", "topicArn": topic_arn, "encoding": "UTF8"},
        },
        "content": email_text,
    }
    base_url = "https://sns.us-east-1.amazonaws.example.com"
    sns_notification = {
        "Type": "Notification",
        "MessageId": str(uuid4()),
        "TopicArn": topic_arn,
        "Subject": str(getattr(email["Subject"], "as_unstructured")),
        "Message": json.dumps(sns_message),
        "Timestamp": (email_date + timedelta(seconds=2)).isoformat(),
        "SignatureVersion": "1",
        "Signature": "invalid-signature",
        "SigningCertURL": f"{base_url}/SimpleNotificationService-abcd1234.pem",
        "UnsubscribeURL": (
            f"{base_url}/?Action=Unsubscribe&SubscriptionArn={topic_arn}:{uuid4()}"
        ),
    }
    return sns_notification


def assert_email_equals_fixture(
    output_email: str,
    fixture_name: str,
    replace_mime_boundaries: bool = False,
    fixture_replace: tuple[str, str] | None = None,
) -> None:
    """
    Assert the output equals the expected email, after optional replacements.

    If Python generated new sections in the email, such as creating an HTML section for
    a text-only email, then set replace_mime_boundaries=True to replace MIME boundaries
    with text that does not change between runs.

    If the output does not match, write the output to the fixtures directory. This
    allows using other diff tools, and makes it easy to capture new outputs when the
    email format changes.
    """
    expected = EMAIL_EXPECTED[fixture_name]

    # If requested, convert MIME boundaries in the the output_email
    if replace_mime_boundaries:
        test_output_email = _replace_mime_boundaries(output_email)
    else:
        test_output_email = output_email

    # If requested, replace a string
    if fixture_replace:
        orig_str, new_str = fixture_replace
        expected = expected.replace(orig_str, new_str)
        fixture_name += "_MODIFIED"

    if test_output_email != expected:  # pragma: no cover
        # Write the actual output as an aid for debugging or fixture updates
        path = os.path.join(real_abs_cwd, "fixtures", fixture_name + "_actual.email")
        open(path, "w").write(test_output_email)
    assert test_output_email == expected


def _replace_mime_boundaries(email: str) -> str:
    """
    Replace MIME boundary strings.  The replacement is "==[BOUNDARY#]==", where "#" is
    the order the string appears in the email.

    Per RFC 1521, 7.2.1, MIME boundary strings must not appear in the bounded content.
    Most email providers use random number generators when finding a unique string.
    Python's email library generates a large random value for email boundary strings.
    If the Python email library generates boundary strings (for example, creating an
    HTML section for a text-only email), the boundary strings are different with each
    test run. The replacement strings do not vary between test runs, and are still
    unique for different MIME sections.
    """

    generic_email_lines: list[str] = []
    mime_boundaries: dict[str, str] = {}
    boundary_re = re.compile(r' boundary="(.*)"')
    for line in email.splitlines():
        if " boundary=" in line:
            # Capture the MIME boundary and replace with generic
            cap = boundary_re.search(line)
            assert cap
            boundary = cap.group(1)
            assert boundary not in mime_boundaries
            generic_boundary = f"==[BOUNDARY{len(mime_boundaries)}]=="
            mime_boundaries[boundary] = generic_boundary

        generic_line = line
        for boundary, generic_boundary in mime_boundaries.items():
            generic_line = generic_line.replace(boundary, generic_boundary)
        generic_email_lines.append(generic_line)

    generic_email = "\n".join(generic_email_lines) + "\n"
    return generic_email


def assert_log_email_dropped(
    caplog: _LoggingWatcher,
    reason: EmailDroppedReason,
    mask: RelayAddress | DomainAddress,
    is_reply: bool = False,
    can_retry: bool = False,
) -> None:
    """Assert that there is a log entry that an email was dropped."""
    drop_log = None
    for record in caplog.records:
        if record.msg == "email_dropped":
            assert drop_log is None, "duplicate email_dropped log entry"
            drop_log = record
    assert drop_log is not None, "email_dropped log entry not found."
    assert drop_log.levelno == logging.INFO
    expected_extra = {
        "reason": reason,
        "fxa_id": getattr(mask.user.profile.fxa, "uid", ""),
        "mask_id": mask.metrics_id,
        "is_random_mask": isinstance(mask, RelayAddress),
        "is_reply": is_reply,
        "can_retry": can_retry,
    }
    if expected_extra["fxa_id"] == "":
        del expected_extra["fxa_id"]
    assert log_extra(drop_log) == expected_extra


@override_settings(RELAY_FROM_ADDRESS="reply@relay.example.com")
class SNSNotificationTestBase(TestCase):
    """Base class for tests of _sns_notification"""

    def setUp(self) -> None:
        remove_s3_patcher = patch("emails.views.remove_message_from_s3")
        self.mock_remove_message_from_s3 = remove_s3_patcher.start()
        self.addCleanup(remove_s3_patcher.stop)

        self.mock_send_raw_email = Mock(
            spec_set=[], return_value={"MessageId": str(uuid4())}
        )
        send_raw_email_patcher = patch(
            "emails.apps.EmailsConfig.ses_client",
            spec_set=["send_raw_email"],
            send_raw_email=self.mock_send_raw_email,
        )
        send_raw_email_patcher.start()
        self.addCleanup(send_raw_email_patcher.stop)

    def check_sent_email_matches_fixture(
        self,
        fixture_name: str,
        fixture_replace: tuple[str, str] | None = None,
        replace_mime_boundaries: bool = False,
        expected_source: str | None = None,
        expected_destination: str | None = None,
    ) -> None:
        """
        Extract the email and check against the expected email.

        name: the name of the test fixture to check against the email
        replace_mime_boundaries: if true, replace randomized MIME boundaries with
          sequential test versions
        expected_source: if set, assert that SES source address matches this string
        expected_destination: if set, assert that the one SES destination email matches
        """
        self.mock_send_raw_email.assert_called_once()
        source = self.mock_send_raw_email.call_args[1]["Source"]
        destinations = self.mock_send_raw_email.call_args[1]["Destinations"]
        assert len(destinations) == 1
        raw_message = self.mock_send_raw_email.call_args[1]["RawMessage"]["Data"]
        assert "\n\n" in raw_message, "Never found message body!"
        if expected_source is not None:
            assert source == expected_source
        if expected_destination is not None:
            assert destinations[0] == expected_destination
        assert_email_equals_fixture(
            raw_message, fixture_name, replace_mime_boundaries, fixture_replace
        )


class SNSNotificationIncomingTest(SNSNotificationTestBase):
    """Tests for _sns_notification for incoming emails to Relay users"""

    def setUp(self) -> None:
        super().setUp()
        self.user = baker.make(User, email="user@example.com")
        self.profile = self.user.profile
        self.profile.last_engagement = datetime.now(UTC)
        self.profile.save()
        self.sa: SocialAccount = baker.make(
            SocialAccount, user=self.user, provider="fxa"
        )
        self.ra = baker.make(
            RelayAddress, user=self.user, address="ebsbdsan7", domain=2
        )
        self.premium_user = make_premium_test_user()
        self.premium_user.profile.subdomain = "subdomain"
        self.premium_user.profile.last_engagement = datetime.now(UTC)
        self.premium_user.profile.save()

    def test_single_recipient_sns_notification(self) -> None:
        pre_sns_notification_last_engagement = self.ra.user.profile.last_engagement
        assert pre_sns_notification_last_engagement is not None
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        self.check_sent_email_matches_fixture(
            "single_recipient",
            expected_source="replies@default.com",
            expected_destination="user@example.com",
        )
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0
        self.ra.user.profile.refresh_from_db()
        assert self.ra.user.profile.last_engagement is not None
        assert (
            self.ra.user.profile.last_engagement > pre_sns_notification_last_engagement
        )

    def test_single_french_recipient_sns_notification(self) -> None:
        """
        The email content can contain non-ASCII characters.

        In this case, the HTML content is wrapped in the Relay header translated
        to French.
        """
        self.sa.extra_data = {"locale": "fr, fr-fr, en-us, en"}
        self.sa.save()
        assert self.profile.language == "fr"

        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        self.check_sent_email_matches_fixture("single_recipient_fr")
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0

    def test_list_email_sns_notification(self) -> None:
        """By default, list emails should still forward."""
        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        self.check_sent_email_matches_fixture("single_recipient_list")
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0

    def test_block_list_email_sns_notification(self) -> None:
        """When an alias is blocking list emails, list emails should not forward."""
        self.ra.user = self.premium_user
        self.ra.save()
        self.ra.block_list_emails = True
        self.ra.save()

        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        self.mock_send_raw_email.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0
        assert self.ra.num_blocked == 1

    def test_block_list_email_former_premium_user(self) -> None:
        """List emails are forwarded for formerly premium users."""
        self.ra.user = self.premium_user
        self.ra.save()
        self.ra.block_list_emails = True
        self.ra.save()

        # Remove premium from the user
        assert (fxa_account := self.premium_user.profile.fxa)
        fxa_account.extra_data["subscriptions"] = []
        fxa_account.save()
        assert not self.premium_user.profile.has_premium
        self.ra.refresh_from_db()

        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        self.mock_send_raw_email.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.num_blocked == 0
        assert self.ra.block_list_emails is False

    def test_spamVerdict_FAIL_default_still_relays(self) -> None:
        """For a default user, spam email will still relay."""
        with self.assertLogs(GLEAN_LOG) as caplog:
            _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])

        self.mock_send_raw_email.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1

        assert (event := get_glean_event(caplog)) is not None
        assert event["category"] == "email"
        assert event["name"] == "forwarded"

    @override_settings(STATSD_ENABLED=True)
    def test_spamVerdict_FAIL_auto_block_doesnt_relay(self) -> None:
        """When a user has auto_block_spam=True, spam will not relay."""
        self.profile.auto_block_spam = True
        self.profile.save()

        with self.assertLogs(INFO_LOG) as caplog, MetricsMock() as mm:
            _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])

        assert_log_email_dropped(caplog, "auto_block_spam", self.ra)
        mm.assert_incr_once("email_auto_suppressed_for_spam")

        self.mock_send_raw_email.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0

    def test_domain_recipient(self) -> None:
        with self.assertLogs(GLEAN_LOG) as caplog:
            _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])

        self.check_sent_email_matches_fixture(
            "domain_recipient", expected_destination="premium@email.com"
        )
        da = DomainAddress.objects.get(user=self.premium_user, address="wildcard")
        assert da.num_forwarded == 1
        assert da.last_used_at
        assert (datetime.now(tz=UTC) - da.last_used_at).seconds < 2.0

        mask_event = get_glean_event(caplog, "email_mask", "created")
        assert mask_event is not None
        shared_extra_items = {
            "n_domain_masks": "1",
            "is_random_mask": "false",
        }
        expected_mask_event = create_expected_glean_event(
            category="email_mask",
            name="created",
            user=self.premium_user,
            extra_items=shared_extra_items
            | {"has_website": "false", "created_by_api": "false"},
            event_time=mask_event["timestamp"],
        )
        assert mask_event == expected_mask_event

        email_event = get_glean_event(caplog, "email", "forwarded")
        assert email_event is not None
        expected_email_event = create_expected_glean_event(
            category="email",
            name="forwarded",
            user=self.premium_user,
            extra_items=shared_extra_items | {"is_reply": "false"},
            event_time=email_event["timestamp"],
        )
        assert email_event == expected_email_event

    def test_successful_email_relay_message_removed_from_s3(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        self.mock_send_raw_email.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0

    def test_unsuccessful_email_relay_message_not_removed_from_s3(self) -> None:
        self.mock_send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED
        response = _sns_notification(EMAIL_SNS_BODIES["single_recipient"])
        assert response.status_code == 503

        self.mock_send_raw_email.assert_called_once()
        self.mock_remove_message_from_s3.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0
        assert self.ra.last_used_at is None

    @patch("emails.views.generate_from_header", side_effect=InvalidFromHeader())
    def test_invalid_from_header(self, mock_generate_from_header: Mock) -> None:
        """For MPP-3407, show logging for failed from address"""
        with self.assertLogs(INFO_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["single_recipient"])
        assert response.status_code == 503
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0
        assert self.ra.last_used_at is None

        log1, log2 = caplog.records
        assert log1.levelno == logging.ERROR
        assert log_extra(log1) == {
            "from_address": "fxastage@protonmail.com",
            "source": "fxastage@protonmail.com",
            "common_headers_from": ["fxastage <fxastage@protonmail.com>"],
            "headers_from": [
                {"name": "From", "value": "fxastage <fxastage@protonmail.com>"}
            ],
        }
        assert_log_email_dropped(caplog, "error_from_header", self.ra, can_retry=True)

    def test_inline_image(self) -> None:
        email_text = EMAIL_INCOMING["inline_image"]
        test_sns_notification = create_notification_from_email(email_text)
        _sns_notification(test_sns_notification)

        self.check_sent_email_matches_fixture("inline_image")
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0

    def test_russian_spam(self) -> None:
        """
        Base64-encoded input content can be processed.

        Python picks the output encoding it thinks will be most compact. See:
        https://docs.python.org/3/library/email.contentmanager.html#email.contentmanager.set_content

        The plain text remains in base64, due to high proportion of Russian characters.
        The HTML version is converted to quoted-printable, due to the high proportion
        of ASCII characters.
        """
        email_text = EMAIL_INCOMING["russian_spam"]
        test_sns_notification = create_notification_from_email(email_text)
        _sns_notification(test_sns_notification)

        self.check_sent_email_matches_fixture("russian_spam")
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0

    @patch("emails.views.info_logger")
    def test_plain_text(self, mock_logger: Mock) -> None:
        """A plain-text only email gets an HTML part."""
        email_text = EMAIL_INCOMING["plain_text"]
        test_sns_notification = create_notification_from_email(email_text)
        _sns_notification(test_sns_notification)

        self.check_sent_email_matches_fixture(
            "plain_text", replace_mime_boundaries=True
        )
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0
        mock_logger.info.assert_not_called()

    @patch("emails.views.info_logger")
    def test_from_with_unquoted_commas_is_parsed(self, mock_logger: Mock) -> None:
        """
        A From: header with commas in an unquoted display is forwarded.

        AWS parses these headers as a single email, Python as a list of emails.
        One of the root causes of MPP-3407.
        """
        email_text = EMAIL_INCOMING["emperor_norton"]
        test_sns_notification = create_notification_from_email(email_text)
        _sns_notification(test_sns_notification)

        self.check_sent_email_matches_fixture(
            "emperor_norton", replace_mime_boundaries=True
        )

        expected_header_errors = [
            {
                "header": "From",
                "direction": "in",
                "defect_count": 4,
                "parsed_value": (
                    '"Norton I.",'
                    " Emperor of the United States <norton@sf.us.example.com>"
                ),
                "raw_value": (
                    "Norton I.,"
                    " Emperor of the United States <norton@sf.us.example.com>"
                ),
            }
        ]

        mock_logger.info.assert_called_once_with(
            "_handle_received: forwarding issues",
            extra={"issues": {"headers": expected_header_errors}},
        )

    @patch("emails.views.info_logger")
    def test_from_with_nested_brackets_is_error(self, mock_logger: Mock) -> None:
        email_text = EMAIL_INCOMING["nested_brackets_service"]
        test_sns_notification = create_notification_from_email(email_text)
        result = _sns_notification(test_sns_notification)
        assert result.status_code == 400
        self.mock_send_raw_email.assert_not_called()
        mock_logger.error.assert_called_once_with(
            "_handle_received: no from address",
            extra={
                "source": "invalid@example.com",
                "common_headers_from": [
                    "The Service <The Service <hello@theservice.example.com>>"
                ],
            },
        )
        mock_logger.info.assert_not_called()

    @patch("emails.views.info_logger")
    def test_invalid_message_id_is_forwarded(self, mock_logger: Mock) -> None:
        email_text = EMAIL_INCOMING["message_id_in_brackets"]
        test_sns_notification = create_notification_from_email(email_text)

        result = _sns_notification(test_sns_notification)
        assert result.status_code == 200
        self.check_sent_email_matches_fixture(
            "message_id_in_brackets", replace_mime_boundaries=True
        )
        expected_header_errors = [
            {
                "header": "Message-ID",
                "direction": "in",
                "defect_count": 1,
                "parsed_value": "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>",
                "raw_value": "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>",
            }
        ]
        mock_logger.info.assert_called_once_with(
            "_handle_received: forwarding issues",
            extra={"issues": {"headers": expected_header_errors}},
        )

    @patch("emails.views.info_logger")
    def test_header_with_encoded_trailing_newline_is_forwarded(
        self, mock_logger: Mock
    ) -> None:
        """
        A header with a trailing encoded newline is stripped.
        """
        email_text = EMAIL_INCOMING["encoded_trailing_newline"]
        test_sns_notification = create_notification_from_email(email_text)
        _sns_notification(test_sns_notification)

        self.check_sent_email_matches_fixture("encoded_trailing_newline")
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at
        assert (datetime.now(tz=UTC) - self.ra.last_used_at).seconds < 2.0
        expected_header_errors = [
            {
                "header": "Subject",
                "direction": "in",
                "defect_count": 1,
                "parsed_value": "An encoded newline\n",
                "raw_value": "An =?UTF-8?Q?encoded_newline=0A?=",
            }
        ]
        mock_logger.info.assert_called_once_with(
            "_handle_received: forwarding issues",
            extra={"issues": {"headers": expected_header_errors}},
        )

    @override_flag("developer_mode", active=True)
    @patch("emails.views.info_logger")
    def test_developer_mode_no_label(self, mock_logger: Mock) -> None:
        """Developer mode does nothing special without mask label"""
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])
        self.check_sent_email_matches_fixture(
            "single_recipient",
            expected_source="replies@default.com",
            expected_destination="user@example.com",
        )
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        mock_logger.info.assert_not_called()

    @override_flag("developer_mode", active=True)
    @patch("emails.views.info_logger")
    def test_developer_mode_simulate_complaint(self, mock_logger: Mock) -> None:
        """Developer mode with 'DEV:simulate_complaint' label sends to simulator"""
        self.ra.description = "test123 DEV:simulate_complaint"
        self.ra.save()

        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])
        expected_email = f"complaint+{self.ra.metrics_id}@simulator.amazonses.com"

        self.check_sent_email_matches_fixture(
            "single_recipient",
            expected_source="replies@default.com",
            expected_destination=expected_email,
            fixture_replace=(
                f"To: {self.user.email}",
                f"To: {expected_email}",
            ),
        )
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        log_group_id: str | None = None
        parts = ["", "", "", ""]
        for callnum, call in enumerate(mock_logger.info.mock_calls):
            assert call.args == ("_handle_received: developer_mode",)
            extra = call.kwargs["extra"]
            assert extra["mask_id"] == self.ra.metrics_id
            assert extra["dev_action"] == "simulate_complaint"
            assert extra["part"] == callnum
            assert extra["parts"] == 4
            if log_group_id is None:
                log_group_id = extra["log_group_id"]
                assert log_group_id
                assert isinstance(log_group_id, str)
            else:
                assert extra["log_group_id"] == log_group_id
            parts[extra["part"]] = extra["notification_gza85"]
        log_notification = decode_dict_gza85("\n".join(parts))
        expected_log_notification = json.loads(
            EMAIL_SNS_BODIES["single_recipient"]["Message"]
        )
        assert log_notification == expected_log_notification

    @override_flag("developer_mode", active=True)
    @patch("emails.views.info_logger")
    def test_developer_mode_simulate_complaint_domain_address(
        self, mock_logger: Mock
    ) -> None:
        """Domain addresses can have 'DEV:simulate_complaint' label"""
        domain_address = DomainAddress.objects.create(
            address="wildcard",
            user=self.premium_user,
            description="DEV:simulate_complaint",
        )
        _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])
        expected_email = (
            f"complaint+{domain_address.metrics_id}@simulator.amazonses.com"
        )

        self.check_sent_email_matches_fixture(
            "domain_recipient",
            expected_source="replies@default.com",
            expected_destination=expected_email,
            fixture_replace=(
                f"To: {self.premium_user.email}",
                f"To: {expected_email}",
            ),
        )
        domain_address.refresh_from_db()
        assert domain_address.num_forwarded == 1
        assert domain_address.last_used_at is not None

        mock_logger.info.assert_called_with(
            "_handle_received: developer_mode", extra=ANY
        )


class SNSNotificationRepliesTest(SNSNotificationTestBase):
    """Tests for _sns_notification for replies from Relay users"""

    def setUp(self) -> None:
        super().setUp()

        # Create a premium user matching the s3_stored_replies sender
        self.user = baker.make(User, email="source@sender.com")
        self.user.profile.server_storage = True
        self.user.profile.date_subscribed = datetime.now(tz=UTC)
        self.user.profile.last_engagement = datetime.now(tz=UTC)
        self.user.profile.save()
        self.pre_reply_last_engagement = self.user.profile.last_engagement
        upgrade_test_user_to_premium(self.user)

        # Create a Reply record matching the s3_stored_replies headers
        lookup_key, encryption_key = derive_reply_keys(
            get_message_id_bytes("CA+J4FJFw0TXCr63y9dGcauvCGaZ7pXxspzOjEDhRpg5Zh4ziWg")
        )
        metadata = {
            "message-id": str(uuid4()),
            "from": "sender@external.example.com",
        }
        encrypted_metadata = encrypt_reply_metadata(encryption_key, metadata)
        self.relay_address = baker.make(
            RelayAddress, user=self.user, address="a1b2c3d4"
        )
        Reply.objects.create(
            lookup=b64_lookup_key(lookup_key),
            encrypted_metadata=encrypted_metadata,
            relay_address=self.relay_address,
        )

        get_message_content_patcher = patch("emails.views.get_message_content_from_s3")
        self.mock_get_content = get_message_content_patcher.start()
        self.addCleanup(get_message_content_patcher.stop)

    def successful_reply_test_implementation(
        self, text: str, expected_fixture_name: str
    ) -> None:
        """The headers of a reply refer to the Relay mask."""

        self.mock_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored_replies"], text=text
        )

        # Successfully reply to a previous sender
        with self.assertLogs(GLEAN_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 200

        assert (event := get_glean_event(caplog)) is not None
        assert event["category"] == "email"
        assert event["name"] == "forwarded"
        assert event["extra"]["is_reply"] == "true"

        self.mock_remove_message_from_s3.assert_called_once()
        self.mock_get_content.assert_called_once()
        self.check_sent_email_matches_fixture(
            expected_fixture_name,
            expected_source="a1b2c3d4@test.com",
            expected_destination="sender@external.example.com",
        )
        self.relay_address.refresh_from_db()
        assert self.relay_address.num_replied == 1
        last_used_at = self.relay_address.last_used_at
        assert last_used_at
        assert (datetime.now(tz=UTC) - last_used_at).seconds < 2.0
        assert (last_en := self.relay_address.user.profile.last_engagement) is not None
        assert last_en > self.pre_reply_last_engagement

    def assert_log_reply_email_dropped(
        self,
        caplog: _LoggingWatcher,
        reason: EmailDroppedReason,
        can_retry: bool = False,
    ) -> None:
        assert_log_email_dropped(
            caplog, reason, self.relay_address, is_reply=True, can_retry=can_retry
        )

    def test_reply(self) -> None:
        self.successful_reply_test_implementation(
            text="this is a text reply", expected_fixture_name="s3_stored_replies"
        )

    def test_reply_with_emoji_in_text(self) -> None:
        """An email with emoji text content is sent with UTF-8 encoding."""
        self.successful_reply_test_implementation(
            text="👍 Thanks I got it!",
            expected_fixture_name="s3_stored_replies_with_emoji",
        )

    @patch("emails.views._reply_allowed")
    def test_reply_not_allowed(self, mocked_reply_allowed: Mock) -> None:
        mocked_reply_allowed.return_value = False
        with self.assertLogs(INFO_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 403
        assert response.content == b"Relay replies require a premium account"
        self.assert_log_reply_email_dropped(caplog, "reply_requires_premium")

    def test_get_message_content_from_s3_not_found(self) -> None:
        self.mock_get_content.side_effect = ClientError(
            operation_name="S3.something",
            error_response={"Error": {"Code": "NoSuchKey", "Message": "the message"}},
        )
        with (
            self.assertLogs(INFO_LOG) as info_caplog,
            self.assertLogs(ERROR_LOG, "ERROR") as events_caplog,
        ):
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        self.mock_send_raw_email.assert_not_called()
        assert response.status_code == 404
        assert response.content == b"Email not in S3"

        assert len(events_caplog.records) == 1
        events_log = events_caplog.records[0]
        assert events_log.message == "s3_object_does_not_exist"
        assert getattr(events_log, "Code") == "NoSuchKey"
        assert getattr(events_log, "Message") == "the message"
        self.assert_log_reply_email_dropped(info_caplog, "content_missing")

    def test_get_message_content_from_s3_other_error(self) -> None:
        self.mock_get_content.side_effect = ClientError(
            operation_name="S3.something",
            error_response={"Error": {"Code": "IsNapping", "Message": "snooze"}},
        )
        with (
            self.assertLogs(INFO_LOG) as info_caplog,
            self.assertLogs(ERROR_LOG, "ERROR") as error_caplog,
        ):
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        self.mock_send_raw_email.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"Cannot fetch the message content from S3"

        self.assert_log_reply_email_dropped(
            info_caplog, "error_storage", can_retry=True
        )
        assert len(error_caplog.records) == 1
        error_log = error_caplog.records[0]
        assert error_log.message == "s3_client_error_get_email"
        assert getattr(error_log, "Code") == "IsNapping"
        assert getattr(error_log, "Message") == "snooze"

    def test_ses_client_error(self) -> None:
        self.mock_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored_replies"], text="text content"
        )
        self.mock_send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED
        with (
            self.assertLogs(INFO_LOG) as info_caplog,
            self.assertLogs(ERROR_LOG, "ERROR") as error_caplog,
        ):
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 400
        assert response.content == b"SES client error"

        self.assert_log_reply_email_dropped(info_caplog, "error_sending")
        assert len(error_caplog.records) == 1
        error_log = error_caplog.records[0]
        assert error_log.message == "ses_client_error_raw_email"
        assert getattr(error_log, "Code") == "the code"
        assert getattr(error_log, "Message") == "the message"


@override_settings(STATSD_ENABLED=True)
class BounceHandlingTest(TestCase):
    def setUp(self):
        self.user = baker.make(User, email="relayuser@test.com")
        self.sa: SocialAccount = baker.make(
            SocialAccount, user=self.user, provider="fxa", uid=str(uuid4())
        )

    def test_sns_message_with_hard_bounce(self) -> None:
        pre_request_datetime = datetime.now(UTC)

        with self.assertLogs(INFO_LOG) as logs, MetricsMock() as mm:
            _sns_notification(BOUNCE_SNS_BODIES["hard"])

        self.user.refresh_from_db()
        assert self.user.profile.last_hard_bounce is not None
        assert self.user.profile.last_hard_bounce >= pre_request_datetime

        assert len(logs.records) == 1
        log_data = log_extra(logs.records[0])
        assert (diagnostic := log_data["bounce_diagnostic"])
        assert log_data == {
            "bounce_action": "failed",
            "bounce_diagnostic": diagnostic,
            "bounce_status": "5.1.1",
            "bounce_subtype": "OnAccountSuppressionList",
            "bounce_type": "Permanent",
            "domain": "test.com",
            "relay_action": "hard_bounce",
            "user_match": "found",
            "fxa_id": self.sa.uid,
        }

        mm.assert_incr_once(
            "email_bounce",
            tags=[
                "bounce_type:permanent",
                "bounce_subtype:onaccountsuppressionlist",
                "user_match:found",
                "relay_action:hard_bounce",
            ],
        )

    def test_sns_message_with_soft_bounce(self) -> None:
        pre_request_datetime = datetime.now(UTC)

        with self.assertLogs(INFO_LOG) as logs, MetricsMock() as mm:
            _sns_notification(BOUNCE_SNS_BODIES["soft"])

        self.user.refresh_from_db()
        assert self.user.profile.last_soft_bounce is not None
        assert self.user.profile.last_soft_bounce >= pre_request_datetime

        assert len(logs.records) == 1
        log_data = log_extra(logs.records[0])
        assert (diagnostic := log_data["bounce_diagnostic"])
        assert log_data == {
            "bounce_action": "failed",
            "bounce_diagnostic": diagnostic,
            "bounce_status": "5.1.1",
            "bounce_subtype": "SRETeamEatenByDinosaurs",
            "bounce_type": "Transient",
            "domain": "test.com",
            "relay_action": "soft_bounce",
            "user_match": "found",
            "fxa_id": self.sa.uid,
        }

        mm.assert_incr_once(
            "email_bounce",
            tags=[
                "bounce_type:transient",
                "bounce_subtype:sreteameatenbydinosaurs",
                "user_match:found",
                "relay_action:soft_bounce",
            ],
        )

    def test_sns_message_with_spam_bounce_sets_auto_block_spam(self):
        with self.assertLogs(INFO_LOG) as logs, MetricsMock() as mm:
            _sns_notification(BOUNCE_SNS_BODIES["spam"])
        self.user.refresh_from_db()
        assert self.user.profile.auto_block_spam

        assert len(logs.records) == 1
        log_data = log_extra(logs.records[0])
        assert (diagnostic := log_data["bounce_diagnostic"])
        assert log_data == {
            "bounce_action": "failed",
            "bounce_diagnostic": diagnostic,
            "bounce_status": "5.1.1",
            "bounce_subtype": "StopRelayingSpamForThisUser",
            "bounce_type": "Transient",
            "domain": "test.com",
            "relay_action": "auto_block_spam",
            "user_match": "found",
            "fxa_id": self.sa.uid,
        }

        mm.assert_incr_once(
            "email_bounce",
            tags=[
                "bounce_type:transient",
                "bounce_subtype:stoprelayingspamforthisuser",
                "user_match:found",
                "relay_action:auto_block_spam",
            ],
        )

    def test_sns_message_with_hard_bounce_and_optout(self) -> None:
        self.sa.extra_data["metricsEnabled"] = False
        self.sa.save()

        with self.assertLogs(INFO_LOG) as logs:
            _sns_notification(BOUNCE_SNS_BODIES["hard"])

        log_data = log_extra(logs.records[0])
        assert log_data["user_match"] == "found"
        assert not log_data["fxa_id"]


@override_settings(STATSD_ENABLED=True)
@override_settings(RELAY_FROM_ADDRESS="reply@relay.example.com")
class ComplaintHandlingTest(TestCase):
    """
    Test Complaint notifications and events.

    Example derived from:
    https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object
    """

    def setUp(self):
        self.user = baker.make(User, email="relayuser@test.com")
        self.sa: SocialAccount = baker.make(
            SocialAccount, user=self.user, provider="fxa", uid=str(uuid4())
        )
        self.ra = baker.make(
            RelayAddress, user=self.user, address="ebsbdsan7", domain=2
        )

        russian_spam_notification = create_notification_from_email(
            EMAIL_EXPECTED["russian_spam"]
        )
        spam_mail_content = json.loads(russian_spam_notification["Message"])["mail"]
        spam_mail_content["source"] = "replies@default.com"  # Reply-To address
        spam_mail_content["messageId"] = (
            "0100019291f7e695-51da71c8-36cc-4cc7-82e3-23fbf48d4bb4-000000"
        )
        del spam_mail_content["commonHeaders"]["date"]
        del spam_mail_content["commonHeaders"]["messageId"]

        self.complaint_msg = {
            "notificationType": "Complaint",
            "complaint": {
                "userAgent": "ExampleCorp Feedback Loop (V0.01)",
                "complainedRecipients": [{"emailAddress": self.user.email}],
                "complaintFeedbackType": "abuse",
                "arrivalDate": "2009-12-03T04:24:21.000-05:00",
                "timestamp": "2012-05-25T14:59:38.623Z",
                "feedbackId": (
                    "000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000"
                ),
            },
            "mail": spam_mail_content,
        }
        self.complaint_body = {"Message": json.dumps(self.complaint_msg)}
        ses_client_patcher = patch(
            "emails.apps.EmailsConfig.ses_client",
            spec_set=["send_raw_email"],
        )
        self.mock_ses_client = ses_client_patcher.start()
        self.addCleanup(ses_client_patcher.stop)

    def test_notification_type_complaint(self):
        """
        A notificationType of complaint:
            1. increments a counter
            2. logs details,
            3. sets the user profile's auto_block_spam = True, and
            4. returns 200.
        """
        assert self.user.profile.auto_block_spam is False

        with self.assertLogs(INFO_LOG) as logs, MetricsMock() as mm:
            response = _sns_notification(self.complaint_body)
        assert response.status_code == 200

        self.user.profile.refresh_from_db()
        assert self.user.profile.auto_block_spam is True

        self.ra.refresh_from_db()
        assert self.ra.enabled
        self.mock_ses_client.send_raw_email.assert_not_called()

        mm.assert_incr_once(
            "email_complaint",
            tags=[
                "complaint_subtype:none",
                "complaint_feedback:abuse",
                "user_match:found",
                "relay_action:auto_block_spam",
            ],
        )
        assert len(logs.records) == 1
        record = logs.records[0]
        assert record.msg == "complaint_notification"
        log_data = log_extra(record)
        assert log_data == {
            "complaint_feedback": "abuse",
            "complaint_subtype": None,
            "complaint_user_agent": "ExampleCorp Feedback Loop (V0.01)",
            "domain": "test.com",
            "relay_action": "auto_block_spam",
            "user_match": "found",
            "mask_match": "found",
            "fxa_id": self.sa.uid,
            "found_in": "all",
        }

    def test_complaint_log_with_optout(self) -> None:
        self.sa.extra_data["metricsEnabled"] = False
        self.sa.save()

        with self.assertLogs(INFO_LOG) as logs:
            _sns_notification(self.complaint_body)

        self.user.profile.refresh_from_db()
        assert self.user.profile.auto_block_spam is True

        self.ra.refresh_from_db()
        assert self.ra.enabled
        self.mock_ses_client.send_raw_email.assert_not_called()

        log_data = log_extra(logs.records[0])
        assert log_data["user_match"] == "found"
        assert not log_data["fxa_id"]

    @override_flag("disable_mask_on_complaint", active=True)
    def test_complaint_with_auto_block_spam_disables_mask(self):
        """
        A notificationType of complaint:
            1. sets enabled=False on the mask, and
            2. returns 200.
        """
        self.user.profile.auto_block_spam = True
        self.user.profile.save()
        assert self.ra.enabled is True

        with self.assertLogs(INFO_LOG) as logs, MetricsMock() as mm:
            response = _sns_notification(self.complaint_body)
        assert response.status_code == 200

        self.user.profile.refresh_from_db()
        assert self.user.profile.auto_block_spam is True

        self.ra.refresh_from_db()
        assert self.ra.enabled is False

        self.mock_ses_client.send_raw_email.assert_called_once()
        call = self.mock_ses_client.send_raw_email.call_args
        assert call.kwargs["Source"] == settings.RELAY_FROM_ADDRESS
        assert call.kwargs["Destinations"] == [self.user.email]
        msg_without_newlines = call.kwargs["RawMessage"]["Data"].replace("\n", "")
        assert "This mask has been deactivated" in msg_without_newlines
        assert self.ra.full_address in msg_without_newlines

        mm.assert_incr_once("send_disabled_mask_email")
        mm.assert_incr_once(
            "email_complaint",
            tags=[
                "complaint_subtype:none",
                "complaint_feedback:abuse",
                "user_match:found",
                "relay_action:disable_mask",
            ],
        )

        assert len(logs.records) == 1
        record = logs.records[0]
        assert record.msg == "complaint_notification"
        log_data = log_extra(record)
        assert log_data == {
            "complaint_feedback": "abuse",
            "complaint_subtype": None,
            "complaint_user_agent": "ExampleCorp Feedback Loop (V0.01)",
            "domain": "test.com",
            "relay_action": "disable_mask",
            "user_match": "found",
            "mask_match": "found",
            "fxa_id": self.sa.uid,
            "found_in": "all",
        }

    @override_flag("developer_mode", active=True)
    def test_complaint_developer_mode(self):
        """Log complaint notification for developer_mode users."""

        simulator_complaint_message = deepcopy(self.complaint_msg)
        simulator_complaint_message["complaint"]["complainedRecipients"] = [
            {"emailAddress": f"complaint+{self.ra.metrics_id}@simulator.amazonses.com"}
        ]
        complaint_body = {"Message": json.dumps(simulator_complaint_message)}

        with self.assertLogs(INFO_LOG) as logs:
            response = _sns_notification(complaint_body)
        assert response.status_code == 200

        self.user.profile.refresh_from_db()
        assert self.user.profile.auto_block_spam is True
        self.mock_ses_client.send_raw_email.assert_not_called()

        (rec1, rec2) = logs.records
        assert rec1.msg == "_handle_complaint: developer_mode"
        assert getattr(rec1, "mask_id") == self.ra.metrics_id
        assert getattr(rec1, "dev_action") == "log"
        assert getattr(rec1, "parts") == 1
        assert getattr(rec1, "part") == 0
        notification_gza85 = getattr(rec1, "notification_gza85")
        log_complaint = decode_dict_gza85(notification_gza85)
        assert log_complaint == simulator_complaint_message

        assert rec2.msg == "complaint_notification"

    def test_complaint_from_stranger_is_404(self):
        """If no Relay users match, log the complaint."""
        complaint_msg = deepcopy(self.complaint_msg)
        complaint_msg["complaint"]["complainedRecipients"] = [
            {"emailAddress": "receiver@stranger.example.com"}
        ]
        complaint_msg["mail"]["commonHeaders"]["from"] = ["sender@stranger.example.com"]
        complaint_body = {"Message": json.dumps(complaint_msg)}

        with (
            self.assertLogs(INFO_LOG) as info_logs,
            self.assertLogs(ERROR_LOG) as error_logs,
        ):
            response = _sns_notification(complaint_body)
        assert response.status_code == 404

        self.mock_ses_client.send_raw_email.assert_not_called()

        (info_log,) = info_logs.records
        assert info_log.msg == "complaint_notification"
        assert getattr(info_log, "user_match") == "no_recipients"
        assert getattr(info_log, "relay_action") == "no_action"

        (err_log1, err_log2) = error_logs.records
        assert err_log1.msg == "_gather_complainers: unknown complainedRecipient"
        assert err_log2.msg == "_gather_complainers: unknown mask, maybe deleted?"

    def test_build_disabled_mask_for_spam_email(self):
        free_user = make_free_test_user("testreal@email.com")
        test_mask_address = "w41fwbt4q"
        relay_address = baker.make(
            RelayAddress, user=free_user, address=test_mask_address, domain=2
        )

        msg = _build_disabled_mask_for_spam_email(relay_address)

        assert msg["Subject"] == main.format("relay-deactivated-mask-email-subject")
        assert msg["From"] == settings.RELAY_FROM_ADDRESS
        assert msg["To"] == free_user.email

        text_content, html_content = get_text_and_html_content(msg)
        assert test_mask_address in text_content
        assert test_mask_address in html_content

        assert_email_equals_fixture(
            msg.as_string(), "disabled_mask_for_spam", replace_mime_boundaries=True
        )


class GetComplaintDataTest(TestCase):
    """
    Test emails.views._get_complaint_data

    This function takes a AWS SES Complaint Notification as input, and
    outputs a RawComplaintData with the data needed for complaint processing.

    The 'good data' test cases are also tested in ComplaintHandlingTest. The
    edge cases of missing data in the AWS complaint message are tested here.
    These edge cases are not expected in production, but are handled with
    logging rather than exceptions.
    """

    def test_full_complaint(self):
        """Some data from a full complaint message is extracted."""
        message = {
            "notificationType": "Complaint",
            "complaint": {
                "userAgent": "ExampleCorp Feedback Loop (V0.01)",
                "complainedRecipients": [{"emailAddress": "complainer@example.com"}],
                "complaintFeedbackType": "abuse",
                "arrivalDate": "2009-12-03T04:24:21.000-05:00",
                "timestamp": "2012-05-25T14:59:38.623Z",
                "feedbackId": (
                    "000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000"
                ),
            },
            "mail": {
                "commonHeaders": {
                    "from": [
                        '"hello@ac.spam.example.com [via Relay]" '
                        "<relay-mask@test.com>"
                    ],
                    "subject": "A spam message",
                    "to": ["complainer@example.com"],
                },
                "destination": ["complainer@example.com"],
                "headers": [
                    {"name": "MIME-Version", "value": "1.0"},
                    {
                        "name": "Content-Type",
                        "value": "multipart/mixed; "
                        'boundary="MXFqWmhZLWxxWm5TTC1OaQ=="',
                    },
                    {"name": "Subject", "value": "A spam message"},
                    {
                        "name": "From",
                        "value": '"hello@ac.spam.example.com [via Relay]" '
                        "<relay-mask@test.com>",
                    },
                    {"name": "To", "value": "complainer@example.com"},
                    {"name": "Reply-To", "value": "replies@default.com"},
                    {"name": "Resent-From", "value": "hello@ac.spam.example.com"},
                ],
                "headersTruncated": False,
                "messageId": (
                    "0100019291f7e695-51da71c8-36cc-4cc7-82e3-23fbf48d4bb4-000000"
                ),
                "source": "replies@default.com",
                "timestamp": "2024-10-21T16:46:42.622234",
            },
        }
        complaint_data = _get_complaint_data(message)
        assert complaint_data == RawComplaintData(
            complained_recipients=[("complainer@example.com", {})],
            from_addresses=["relay-mask@test.com"],
            subtype="",
            user_agent="ExampleCorp Feedback Loop (V0.01)",
            feedback_type="abuse",
        )

    def test_minimal_complaint(self):
        """
        Data is extracted from a minimized complaint message.

        This minimal form will be used for missing field tests below.
        """
        message = {
            "complaint": {
                "complainedRecipients": [{"emailAddress": "complainer@example.com"}],
            },
            "mail": {"commonHeaders": {"from": ["relay-mask@test.com"]}},
        }
        with self.assertNoLogs(ERROR_LOG):
            complaint_data = _get_complaint_data(message)
        assert complaint_data == RawComplaintData(
            complained_recipients=[("complainer@example.com", {})],
            from_addresses=["relay-mask@test.com"],
            subtype="",
            user_agent="",
            feedback_type="",
        )

    def test_no_complained_recipients_error_logged(self):
        """When complaint.complainedRecipients is missing, an error is logged."""
        message = {
            "complaint": {},
            "mail": {"commonHeaders": {"from": ["relay-mask@test.com"]}},
        }
        with self.assertLogs(ERROR_LOG) as error_logs:
            complaint_data = _get_complaint_data(message)
        assert complaint_data.complained_recipients == []

        (err_log,) = error_logs.records
        assert err_log.msg == "_get_complaint_data: Unexpected message format"
        assert getattr(err_log, "missing_key") == "complainedRecipients"
        assert getattr(err_log, "found_keys") == ""

    def test_empty_complained_recipients_error_logged(self):
        """When complaint.complainedRecipients is empty, an error is logged."""
        message = {
            "complaint": {"complainedRecipients": []},
            "mail": {"commonHeaders": {"from": ["relay-mask@test.com"]}},
        }
        with self.assertLogs(ERROR_LOG) as error_logs:
            complaint_data = _get_complaint_data(message)
        assert complaint_data.complained_recipients == []

        (err_log,) = error_logs.records
        assert err_log.msg == "_get_complaint_data: Empty complainedRecipients"

    def test_wrong_complained_recipients_error_logged(self):
        """
        When complaint.complainedRecipients has an object without the
        emailAddress key, an error is logged.
        """
        message = {
            "complaint": {
                "complainedRecipients": [{"foo": "bar"}],
            },
            "mail": {"commonHeaders": {"from": ["relay-mask@test.com"]}},
        }
        with self.assertLogs(ERROR_LOG) as error_logs:
            complaint_data = _get_complaint_data(message)
        assert complaint_data.complained_recipients == []

        (err_log,) = error_logs.records
        assert err_log.msg == "_get_complaint_data: Unexpected message format"
        assert getattr(err_log, "missing_key") == "emailAddress"
        assert getattr(err_log, "found_keys") == "foo"

    def test_no_mail_error_logged(self):
        """If the mail key is missing, an error is logged."""
        message = {
            "complaint": {
                "complainedRecipients": [{"emailAddress": "complainer@example.com"}],
            },
        }
        with self.assertLogs(ERROR_LOG) as error_logs:
            complaint_data = _get_complaint_data(message)
        assert complaint_data.from_addresses == []

        (err_log,) = error_logs.records
        assert err_log.msg == "_get_complaint_data: Unexpected message format"
        assert getattr(err_log, "missing_key") == "mail"
        assert getattr(err_log, "found_keys") == "complaint"

    def test_no_common_headers_error_logged(self):
        """If the commonHeaders key is missing, an error is logged."""
        message = {
            "complaint": {
                "complainedRecipients": [{"emailAddress": "complainer@example.com"}],
            },
            "mail": {},
        }
        with self.assertLogs(ERROR_LOG) as error_logs:
            complaint_data = _get_complaint_data(message)
        assert complaint_data.from_addresses == []

        (err_log,) = error_logs.records
        assert err_log.msg == "_get_complaint_data: Unexpected message format"
        assert getattr(err_log, "missing_key") == "commonHeaders"
        assert getattr(err_log, "found_keys") == ""

    def test_no_from_header_error_logged(self):
        """If the From header entry is missing, an error is logged."""
        message = {
            "complaint": {
                "complainedRecipients": [{"emailAddress": "complainer@example.com"}],
            },
            "mail": {"commonHeaders": {}},
        }
        with self.assertLogs(ERROR_LOG) as error_logs:
            complaint_data = _get_complaint_data(message)
        assert complaint_data.from_addresses == []

        (err_log,) = error_logs.records
        assert err_log.msg == "_get_complaint_data: Unexpected message format"
        assert getattr(err_log, "missing_key") == "from"
        assert getattr(err_log, "found_keys") == ""

    def test_no_feedback_type_not_an_error(self):
        """If the feedback type is missing, no error is logged"""
        message = {
            "complaint": {
                "complainedRecipients": [{"emailAddress": "complainer@example.com"}],
            },
            "mail": {"commonHeaders": {"from": ["relay-mask@test.com"]}},
        }
        with self.assertNoLogs(ERROR_LOG):
            complaint_data = _get_complaint_data(message)
        assert complaint_data.feedback_type == ""


class GatherComplainersTest(TestCase):
    """
    Test _gather_complainers(), merging complaint data with the Relay database.

    This function is also tested by ComplaintHandlingTest. This case adds
    tests for corner cases of weird complaint data.
    """

    def setUp(self) -> None:
        self.user = baker.make(User, email="relayuser@test.com")
        self.user_domain = self.user.email.split("@")[1]
        self.relay_address = baker.make(RelayAddress, user=self.user, domain=2)

    def test_known_relay_user(self) -> None:
        data = RawComplaintData(
            complained_recipients=[(self.user.email, {})],
            from_addresses=[self.relay_address.full_address],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "all",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address],
            }
        ]
        assert unknown_count == 0

    def test_unknown_address(self) -> None:
        """If no Relay users match, return nothing."""
        data = RawComplaintData(
            complained_recipients=[("receiver@stranger.example.com", {})],
            from_addresses=["sender@stranger.example.com"],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == []
        assert unknown_count == 2
        (err_log1, err_log2) = error_logs.records
        assert err_log1.msg == "_gather_complainers: unknown complainedRecipient"
        assert err_log2.msg == "_gather_complainers: unknown mask, maybe deleted?"

    def test_complaint_simulator_developer_mode(self) -> None:
        """If the complainer is the AWS complaint simulator, swap in the user"""
        data = RawComplaintData(
            complained_recipients=[
                (
                    f"complaint+{self.relay_address.metrics_id}@simulator.amazonses.com",
                    {},
                ),
            ],
            from_addresses=[self.relay_address.full_address],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "all",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address],
            }
        ]
        assert unknown_count == 0

    def test_complaint_simulator_developer_mode_domain_address(self) -> None:
        """The AWS complaint simulator swap works with a domain address"""
        premium_user = make_premium_test_user()
        premium_user.profile.subdomain = "subdomain"
        premium_user.profile.save()

        domain_address = DomainAddress.objects.create(
            address="complainer",
            user=premium_user,
            description="DEV:simulate_complaint",
        )
        data = RawComplaintData(
            complained_recipients=[
                (f"complaint+{domain_address.metrics_id}@simulator.amazonses.com", {})
            ],
            from_addresses=[domain_address.full_address],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": premium_user,
                "found_in": "all",
                "domain": premium_user.email.split("@")[1],
                "extra": None,
                "masks": [domain_address],
            }
        ]
        assert unknown_count == 0

    def test_complaint_simulator_embedded_mask_not_found(self) -> None:
        """
        If the complainer is the AWS complaint simulator, but the embedded mask ID
        is not found, then it is returns as an unknown user. If the mask is in the
        From: header, then a user can still be returned, with
        "found_in": "from_header" instead of "all".
        """
        assert not RelayAddress.objects.filter(id=2024).exists()
        data = RawComplaintData(
            complained_recipients=[("complaint+R2024@simulator.amazonses.com", {})],
            from_addresses=[self.relay_address.full_address],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "from_header",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address],
            }
        ]
        assert unknown_count == 1
        (err_log,) = error_logs.records
        assert err_log.msg == "_gather_complainers: unknown complainedRecipient"

    def test_unknown_complained_recipient_logs_error(self) -> None:
        """
        If the complainer is not a known Relay user, log an error.
        The Relay user can still be returned with a From: header match.
        """
        data = RawComplaintData(
            complained_recipients=[("unknown@somewhere.example.com", {})],
            from_addresses=[self.relay_address.full_address],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "from_header",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address],
            }
        ]
        assert unknown_count == 1
        (err_log,) = error_logs.records
        assert err_log.msg == "_gather_complainers: unknown complainedRecipient"

    def test_unknown_complained_recipient_two_masks_logs_errors(self) -> None:
        """
        If the complainer is unknown but two masks match the same user, log
        the weirdness.

        Also, this should _never_ happen, but there's a branch instead of
        raising an exception and losing data, so there's also a test.
        """
        second_address = RelayAddress.objects.create(user=self.user)
        data = RawComplaintData(
            complained_recipients=[("unknown@somewhere.example.com", {})],
            from_addresses=[
                self.relay_address.full_address,
                second_address.full_address,
            ],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "from_header",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address, second_address],
            }
        ]
        assert unknown_count == 1
        (err_log1, err_log2) = error_logs.records
        assert err_log1.msg == "_gather_complainers: unknown complainedRecipient"
        assert err_log2.msg == "_gather_complainers: no complainer, multi-mask"

    def test_unknown_from_header_logs_error(self) -> None:
        """
        If the From: header does not match a known Relay user, log an error.
        The Relay user can still be returned with a complainedRecipients match.
        """
        data = RawComplaintData(
            complained_recipients=[(self.user.email, {})],
            from_addresses=["unknown@somwhere.example.com"],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "complained_recipients",
                "domain": self.user_domain,
                "extra": None,
                "masks": [],
            }
        ]
        assert unknown_count == 1
        (err_log,) = error_logs.records
        assert err_log.msg == "_gather_complainers: unknown mask, maybe deleted?"

    def test_duplicate_complained_recipients_logs_error(self) -> None:
        """If a complainer appears twice in complainedRecipieints, log the weirdness."""
        data = RawComplaintData(
            complained_recipients=[(self.user.email, {}), (self.user.email, {})],
            from_addresses=[self.relay_address.full_address],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "all",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address],
            }
        ]
        assert unknown_count == 0
        (err_log,) = error_logs.records
        assert err_log.msg == "_gather_complainers: complainer appears twice"

    def test_duplicate_from_header_logs_error(self) -> None:
        """If a mask appears twice in commonHeaders["from"], log the weirdness."""
        data = RawComplaintData(
            complained_recipients=[(self.user.email, {})],
            from_addresses=[
                self.relay_address.full_address,
                self.relay_address.full_address,
            ],
            subtype="",
            user_agent="agent",
            feedback_type="abuse",
        )
        with self.assertLogs(ERROR_LOG) as error_logs:
            complainers, unknown_count = _gather_complainers(data)
        assert complainers == [
            {
                "user": self.user,
                "found_in": "all",
                "domain": self.user_domain,
                "extra": None,
                "masks": [self.relay_address],
            }
        ]
        assert unknown_count == 0
        (err_log,) = error_logs.records
        assert err_log.msg == "_gather_complainers: mask appears twice"


class GetMaskByMetricsIdTest(TestCase):
    """Tests for _get_mask_by_metrics_id"""

    def test_get_relay_address(self) -> None:
        relay_address = baker.make(RelayAddress)
        assert relay_address.metrics_id.startswith("R")
        assert _get_mask_by_metrics_id(relay_address.metrics_id) == relay_address

    def test_get_domain_address(self) -> None:
        premium_user = make_premium_test_user()
        premium_user.profile.subdomain = "subdomain"
        premium_user.profile.save()
        domain_address = baker.make(DomainAddress, user=premium_user, address="baker")
        assert domain_address.metrics_id.startswith("D")
        assert _get_mask_by_metrics_id(domain_address.metrics_id) == domain_address

    def test_empty_mask_id(self) -> None:
        assert _get_mask_by_metrics_id("") is None

    def test_not_mask_id_by_prefix(self) -> None:
        assert _get_mask_by_metrics_id("ABC") is None

    def test_not_mask_id_by_id(self) -> None:
        assert _get_mask_by_metrics_id("Dude") is None

    def test_relay_address_not_found(self) -> None:
        assert not RelayAddress.objects.filter(id=1999).exists()
        assert _get_mask_by_metrics_id("R1999") is None

    def test_domain_address_not_found(self) -> None:
        assert not DomainAddress.objects.filter(id=1999).exists()
        assert _get_mask_by_metrics_id("D1999") is None


class SNSNotificationRemoveEmailsInS3Test(TestCase):
    def setUp(self) -> None:
        self.bucket = "test-bucket"
        self.key = "/emails/objectkey123"

        self.patcher = patch(
            "emails.views._get_address", side_effect=ObjectDoesNotExist()
        )
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

        remove_s3_patcher = patch("emails.views.remove_message_from_s3")
        self.mock_remove_message_from_s3 = remove_s3_patcher.start()
        self.addCleanup(remove_s3_patcher.stop)

    @patch("emails.views._handle_reply")
    def test_reply_email_in_s3_deleted(self, mocked_handle_reply: Mock) -> None:
        expected_status_code = 200
        mocked_handle_reply.return_value = HttpResponse(
            "Email Relayed", status=expected_status_code
        )

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mocked_handle_reply.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == expected_status_code

    @patch("emails.views._handle_reply")
    def test_reply_email_not_in_s3_deleted_ignored(
        self, mocked_handle_reply: Mock
    ) -> None:
        expected_status_code = 200
        mocked_handle_reply.return_value = HttpResponse(
            "Email Relayed", status=expected_status_code
        )

        response = _sns_notification(EMAIL_SNS_BODIES["replies"])
        mocked_handle_reply.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once_with(None, None)
        assert response.status_code == expected_status_code

    @patch("emails.views._handle_reply")
    def test_reply_email_in_s3_ses_client_error_not_deleted(
        self, mocked_handle_reply: Mock
    ) -> None:
        # SES Client Error caught in _handle_reply responds with 503
        expected_status_code = 503
        mocked_handle_reply.return_value = HttpResponse(
            "SES Client Error", status=expected_status_code
        )

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mocked_handle_reply.assert_called_once()
        self.mock_remove_message_from_s3.assert_not_called()
        assert response.status_code == expected_status_code

    def test_address_does_not_exist_email_not_in_s3_deleted_ignored(self) -> None:
        response = _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])
        self.mock_remove_message_from_s3.assert_called_once_with(None, None)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    def test_address_does_not_exist_email_in_s3_deleted(self) -> None:
        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    def test_bounce_notification_not_in_s3_deleted_ignored(self) -> None:
        response = _sns_notification(BOUNCE_SNS_BODIES["soft"])
        self.mock_remove_message_from_s3.assert_called_once_with(None, None)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    def test_email_without_commonheaders_in_s3_deleted(self) -> None:
        message_wo_commonheaders = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "commonHeaders", "invalidHeaders"
        )
        notification_wo_commonheaders = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_wo_commonheaders["Message"] = message_wo_commonheaders
        response = _sns_notification(notification_wo_commonheaders)
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400
        assert response.content == b"Received SNS notification without commonHeaders."

    def test_email_to_non_relay_domain_in_s3_deleted(self) -> None:
        message_w_non_relay_as_recipient = EMAIL_SNS_BODIES["s3_stored"][
            "Message"
        ].replace("sender@test.com", "to@not-relay.com")
        notification_w_non_relay_domain = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_non_relay_domain["Message"] = message_w_non_relay_as_recipient
        response = _sns_notification(notification_w_non_relay_domain)
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    def test_malformed_to_field_email_in_s3_deleted(self) -> None:
        message_w_malformed_to_field = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "sender@test.com", "not-relay-test.com"
        )
        notification_w_malformed_to_field = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_malformed_to_field["Message"] = message_w_malformed_to_field
        response = _sns_notification(notification_w_malformed_to_field)
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400
        assert response.content == b"Malformed to field."

    def test_noreply_email_in_s3_deleted(self) -> None:
        message_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "sender@test.com", "noreply@default.com"
        )
        notification_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_email_to_noreply["Message"] = message_w_email_to_noreply
        response = _sns_notification(notification_w_email_to_noreply)
        self.mock_remove_message_from_s3(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"noreply address is not supported."

    def test_noreply_mixed_case_email_in_s3_deleted(self) -> None:
        message_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "sender@test.com", "NoReply@default.com"
        )
        notification_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_email_to_noreply["Message"] = message_w_email_to_noreply
        response = _sns_notification(notification_w_email_to_noreply)
        self.mock_remove_message_from_s3(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"noreply address is not supported."

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views._get_keys_from_headers")
    def test_noreply_headers_reply_email_in_s3_deleted(
        self, mocked_get_keys: Mock
    ) -> None:
        """
        If replies@... email has no "In-Reply-To" header, delete email, return 400.
        """
        mocked_get_keys.side_effect = ReplyHeadersNotFound()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mm.assert_incr_once("reply_email_header_error", tags=["detail:no-header"])
        mocked_get_keys.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400

    @override_settings(STATSD_ENABLED=True)
    def test_no_header_reply_email_not_in_s3_deleted_ignored(self) -> None:
        """If replies@... email has no "In-Reply-To" header, return 400"""
        sns_msg = EMAIL_SNS_BODIES["replies"]
        email_data = json.loads(sns_msg["Message"])
        header_names = [
            entry["name"].lower() for entry in email_data["mail"]["headers"]
        ]
        assert "in-reply-to" not in header_names

        with MetricsMock() as mm:
            response = _sns_notification(sns_msg)
        mm.assert_incr_once("reply_email_header_error", tags=["detail:no-header"])
        self.mock_remove_message_from_s3.assert_called_once_with(None, None)
        assert response.status_code == 400

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views._get_reply_record_from_lookup_key")
    def test_no_reply_record_reply_email_in_s3_deleted(
        self, mocked_get_record: Mock
    ) -> None:
        """If no DB match for In-Reply-To header, delete email, return 404."""
        mocked_get_record.side_effect = Reply.DoesNotExist()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mm.assert_incr_once("reply_email_header_error", tags=["detail:no-reply-record"])
        mocked_get_record.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 404

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views._get_keys_from_headers")
    @patch("emails.views._get_reply_record_from_lookup_key")
    def test_no_reply_record_reply_email_not_in_s3_deleted_ignored(
        self, mocked_get_record: Mock, mocked_get_keys: Mock
    ) -> None:
        """If no DB match for In-Reply-To header, return 404."""
        mocked_get_keys.return_value = ("lookup", "encryption")
        mocked_get_record.side_effect = Reply.DoesNotExist()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["replies"])
        mm.assert_incr_once("reply_email_header_error", tags=["detail:no-reply-record"])
        mocked_get_record.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once_with(None, None)
        assert response.status_code == 404


class SNSNotificationInvalidMessageTest(TestCase):
    def test_no_message(self):
        """An empty message returns a 400 error"""
        json_body = {"Message": "{}"}
        response = _sns_notification(json_body)
        assert response.status_code == 400

    def test_subscription_confirmation(self):
        """A subscription confirmation returns a 400 error"""
        json_body = INVALID_SNS_BODIES["subscription_confirmation"]
        response = _sns_notification(json_body)
        assert response.status_code == 400

    def test_notification_type_delivery(self):
        """
        A notificationType of delivery returns a 400 error.

        Test JSON derived from:
        https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
        """
        notification = {
            "notificationType": "Delivery",
            "delivery": {
                "timestamp": "2014-05-28T22:41:01.184Z",
                "processingTimeMillis": 546,
                "recipients": ["success@simulator.amazonses.com"],
                "smtpResponse": "250 ok:  Message 64111812 accepted",
                "reportingMTA": "a8-70.smtp-out.amazonses.com",
                "remoteMtaIp": "127.0.2.0",
            },
        }
        json_body = {"Message": json.dumps(notification)}
        response = _sns_notification(json_body)
        assert response.status_code == 400


@override_settings(STATSD_ENABLED=True)
class SNSNotificationValidUserEmailsInS3Test(TestCase):
    def setUp(self) -> None:
        self.bucket = "test-bucket"
        self.key = "/emails/objectkey123"
        self.user = baker.make(User, email="sender@test.com", make_m2m=True)
        self.profile = self.user.profile
        assert self.profile is not None
        self.address = baker.make(
            RelayAddress, user=self.user, address="sender", domain=2
        )

        remove_s3_patcher = patch("emails.views.remove_message_from_s3")
        self.mock_remove_message_from_s3 = remove_s3_patcher.start()
        self.addCleanup(remove_s3_patcher.stop)

    def expected_glean_event(
        self,
        timestamp: str,
        reason: str | None = None,
        is_reply: bool = False,
    ) -> dict[str, Any]:
        extra_items = {
            "n_random_masks": "1",
            "is_random_mask": "true",
            "is_reply": "true" if is_reply else "false",
        }
        if reason:
            extra_items["reason"] = reason
        return create_expected_glean_event(
            category="email",
            name="blocked" if reason else "forwarded",
            user=self.user,
            extra_items=extra_items,
            event_time=timestamp,
        )

    def assert_log_incoming_email_dropped(
        self,
        caplog: _LoggingWatcher,
        reason: EmailDroppedReason,
        can_retry: bool = False,
    ) -> None:
        assert_log_email_dropped(caplog, reason, self.address, can_retry=can_retry)

    def test_auto_block_spam_true_email_in_s3_deleted(self) -> None:
        self.profile.auto_block_spam = True
        self.profile.save()
        message_spamverdict_failed = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            '"spamVerdict":{"status":"PASS"}', '"spamVerdict":{"status":"FAIL"}'
        )
        notification_w_spamverdict_failed = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_spamverdict_failed["Message"] = message_spamverdict_failed

        with self.assertLogs(INFO_LOG) as caplog, MetricsMock() as mm:
            response = _sns_notification(notification_w_spamverdict_failed)
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address rejects spam."
        self.assert_log_incoming_email_dropped(caplog, "auto_block_spam")
        mm.assert_incr_once("email_auto_suppressed_for_spam")

    def test_user_bounce_soft_paused_email_in_s3_deleted(self) -> None:
        self.profile.last_soft_bounce = datetime.now(UTC)
        self.profile.save()

        with self.assertLogs(INFO_LOG) as caplog, MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        self.assert_log_incoming_email_dropped(caplog, "soft_bounce_pause")
        mm.assert_incr_once("email_suppressed_for_soft_bounce")

    def test_user_bounce_hard_paused_email_in_s3_deleted(self) -> None:
        self.profile.last_hard_bounce = datetime.now(UTC)
        self.profile.save()

        with self.assertLogs(INFO_LOG) as caplog, MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        self.assert_log_incoming_email_dropped(caplog, "hard_bounce_pause")
        mm.assert_incr_once("email_suppressed_for_hard_bounce")

    def test_user_deactivated_email_in_s3_deleted(self) -> None:
        self.profile.user.is_active = False
        self.profile.user.save()

        with self.assertLogs(INFO_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Account is deactivated."
        self.assert_log_incoming_email_dropped(caplog, "user_deactivated")

    @patch("emails.views._reply_allowed")
    @patch("emails.views._get_reply_record_from_lookup_key")
    def test_reply_not_allowed_email_in_s3_deleted(
        self, mocked_reply_record: Mock, mocked_reply_allowed: Mock
    ) -> None:
        # external user sending a reply to Relay user
        # where the replies were being exchanged but now the user
        # no longer has the premium subscription
        mocked_reply_allowed.return_value = False

        with self.assertLogs(INFO_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 403
        assert response.content == b"Relay replies require a premium account"
        self.assert_log_incoming_email_dropped(caplog, "reply_requires_premium")

    def test_flagged_user_email_in_s3_deleted(self) -> None:
        profile = self.address.user.profile
        profile.last_account_flagged = datetime.now(UTC)
        profile.last_engagement = datetime.now(UTC)
        profile.save()
        pre_flagged_last_engagement = profile.last_engagement

        with self.assertLogs(INFO_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        profile.refresh_from_db()
        assert profile.last_engagement == pre_flagged_last_engagement
        self.assert_log_incoming_email_dropped(caplog, "abuse_flag")

    def test_relay_address_disabled_email_in_s3_deleted(self) -> None:
        self.address.enabled = False
        self.address.save()
        profile = self.address.user.profile
        profile.last_engagement = datetime.now(UTC)
        profile.save()
        pre_blocked_email_last_engagement = profile.last_engagement

        with self.assertLogs(GLEAN_LOG) as caplog, MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        profile.refresh_from_db()
        assert profile.last_engagement > pre_blocked_email_last_engagement

        assert (event := get_glean_event(caplog)) is not None
        expected = self.expected_glean_event(event["timestamp"], "block_all")
        assert event == expected
        mm.assert_incr_once("email_for_disabled_address")

    @patch("emails.views._check_email_from_list")
    def test_blocked_list_email_in_s3_deleted(
        self, mocked_email_is_from_list: Mock
    ) -> None:
        upgrade_test_user_to_premium(self.user)
        self.address.block_list_emails = True
        self.address.save()
        profile = self.address.user.profile
        profile.last_engagement = datetime.now(UTC)
        profile.save()
        pre_blocked_email_last_engagement = profile.last_engagement
        mocked_email_is_from_list.return_value = True

        with self.assertLogs(GLEAN_LOG) as caplog, MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is not accepting list emails."
        profile.refresh_from_db()
        assert profile.last_engagement > pre_blocked_email_last_engagement

        assert (event := get_glean_event(caplog)) is not None
        expected = self.expected_glean_event(event["timestamp"], "block_promotional")
        assert event == expected
        mm.assert_incr_once("list_email_for_address_blocking_lists")

    @patch("emails.views.get_message_content_from_s3")
    def test_get_text_html_s3_client_error_email_in_s3_not_deleted(
        self, mocked_get_content: Mock
    ) -> None:
        mocked_get_content.side_effect = ClientError(
            {"Error": {"Code": "SomeErrorCode", "Message": "Details"}}, ""
        )

        with (
            self.assertLogs(INFO_LOG) as info_caplog,
            self.assertLogs(ERROR_LOG, "ERROR") as error_caplog,
        ):
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"Cannot fetch the message content from S3"

        self.assert_log_incoming_email_dropped(
            info_caplog, "error_storage", can_retry=True
        )
        assert len(error_caplog.records) == 1
        error_log = error_caplog.records[0]
        assert error_log.message == "s3_client_error_get_email"
        assert log_extra(error_log) == {"Code": "SomeErrorCode", "Message": "Details"}

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_ses_client_error_email_in_s3_not_deleted(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        mocked_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored"], text="text_content"
        )
        mocked_ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED

        with self.assertLogs(INFO_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"SES client error on Raw Email"
        self.assert_log_incoming_email_dropped(caplog, "error_sending", can_retry=True)

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_successful_email_in_s3_deleted(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        mocked_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored"], "text_content"
        )
        mocked_ses_client.send_raw_email.return_value = {"MessageId": "NICE"}

        with self.assertLogs(GLEAN_LOG) as caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Sent email to final recipient."

        assert (event := get_glean_event(caplog)) is not None
        expected = self.expected_glean_event(event["timestamp"])
        assert event == expected

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_successful_email_in_s3_deleted_with_punycode(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        test_email = "user@münchen.de"
        punycode_email = "user@xn--mnchen-3ya.de"
        self.user.email = test_email
        self.user.save()

        notification = EMAIL_SNS_BODIES["s3_stored"].copy()
        mocked_get_content.return_value = create_email_from_notification(
            notification, "text_content"
        )
        mocked_ses_client.send_raw_email.return_value = {"MessageId": "NICE"}

        _sns_notification(notification)

        # Verify the email was sent with punycode address
        mocked_ses_client.send_raw_email.assert_called_once()
        call_args = mocked_ses_client.send_raw_email.call_args[1]
        assert call_args["Destinations"] == [punycode_email]

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_dmarc_failure_s3_deleted(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        """A message with a failing DMARC and a "reject" policy is rejected."""
        mocked_get_content.side_effect = FAIL_TEST_IF_CALLED
        mocked_ses_client.send_raw_email.side_effect = FAIL_TEST_IF_CALLED

        with self.assertLogs(INFO_LOG) as caplog, MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["dmarc_failed"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400
        assert response.content == b"DMARC failure, policy is reject"
        assert_log_email_dropped(caplog, "dmarc_reject_failed", self.address)
        mm.assert_incr_once(
            "email_suppressed_for_dmarc_failure",
            tags=["dmarcPolicy:reject", "dmarcVerdict:FAIL"],
        )


class SnsMessageTest(TestCase):
    def setUp(self) -> None:
        self.message_json = json.loads(EMAIL_SNS_BODIES["s3_stored"]["Message"])
        assert self.message_json["mail"]["destination"] == ["sender@test.com"]

        # Create a matching user and address for the recipients "sender@test.com"
        user = baker.make(User)
        baker.make(SocialAccount, user=user, provider="fxa")
        # test.com is the second domain listed and has the numerical value 2
        self.ra = baker.make(RelayAddress, user=user, address="sender", domain=2)

        get_content_patcher = patch(
            "emails.views.get_message_content_from_s3",
            return_value=create_email_from_notification(
                EMAIL_SNS_BODIES["s3_stored"], "text"
            ),
        )
        self.mock_get_content = get_content_patcher.start()
        self.addCleanup(get_content_patcher.stop)

        ses_client_patcher = patch(
            "emails.apps.EmailsConfig.ses_client",
            spec_set=["send_raw_email"],
        )
        self.mock_ses_client = ses_client_patcher.start()
        self.addCleanup(ses_client_patcher.stop)

    def test_get_message_content_from_s3_not_found(self) -> None:
        self.mock_get_content.side_effect = ClientError(
            operation_name="S3.something",
            error_response={"Error": {"Code": "NoSuchKey", "Message": "the message"}},
        )
        with (
            self.assertLogs(INFO_LOG) as info_caplog,
            self.assertLogs(ERROR_LOG, "ERROR") as error_caplog,
        ):
            response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_not_called()
        assert response.status_code == 404
        assert response.content == b"Email not in S3"

        assert_log_email_dropped(info_caplog, "content_missing", self.ra)
        assert len(error_caplog.records) == 1
        error_log = error_caplog.records[0]
        assert error_log.message == "s3_object_does_not_exist"
        assert log_extra(error_log) == {"Code": "NoSuchKey", "Message": "the message"}

    def test_ses_send_raw_email_has_client_error_early_exits(self) -> None:
        self.mock_ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED
        with (
            self.assertLogs(INFO_LOG) as info_caplog,
            self.assertLogs(ERROR_LOG, "ERROR") as error_caplog,
        ):
            response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_called_once()
        assert response.status_code == 503

        assert_log_email_dropped(info_caplog, "error_sending", self.ra, can_retry=True)
        assert len(error_caplog.records) == 1
        error_log = error_caplog.records[0]
        assert error_log.message == "ses_client_error_raw_email"
        assert log_extra(error_log) == {"Code": "the code", "Message": "the message"}

    def test_ses_send_raw_email_email_relayed_email_deleted_from_s3(self):
        self.mock_ses_client.send_raw_email.return_value = {"MessageId": str(uuid4())}
        with self.assertLogs(GLEAN_LOG) as caplog:
            response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_called_once()
        assert response.status_code == 200

        assert (event := get_glean_event(caplog)) is not None
        assert event["category"] == "email"
        assert event["name"] == "forwarded"


@override_settings(SITE_ORIGIN="https://test.com", STATSD_ENABLED=True)
class GetAddressTest(TestCase):
    def setUp(self):
        self.user = make_premium_test_user()
        self.user.profile.subdomain = "subdomain"
        self.user.profile.save()
        self.relay_address = baker.make(
            RelayAddress, user=self.user, address="relay123"
        )
        self.deleted_relay_address = baker.make(
            DeletedAddress, address_hash=address_hash("deleted456", domain="test.com")
        )
        self.domain_address = baker.make(
            DomainAddress, user=self.user, address="domain"
        )

    def test_existing_relay_address(self):
        assert _get_address("relay123@test.com") == self.relay_address

    def test_uppercase_local_part_of_existing_relay_address(self):
        """Case-insensitive matching is used for the local part of relay addresses."""
        assert _get_address("Relay123@test.com") == self.relay_address

    def test_uppercase_domain_part_of_existing_relay_address(self):
        """Case-insensitive matching is used for the domain part of relay addresses."""
        assert _get_address("relay123@Test.Com") == self.relay_address

    def test_unknown_relay_address_raises(self):
        with pytest.raises(RelayAddress.DoesNotExist), MetricsMock() as mm:
            _get_address("unknown@test.com")
        mm.assert_incr_once("email_for_unknown_address")

    def test_deleted_relay_address_raises(self):
        with pytest.raises(RelayAddress.DoesNotExist), MetricsMock() as mm:
            _get_address("deleted456@test.com")
        mm.assert_incr_once("email_for_deleted_address")

    def test_multiple_deleted_relay_addresses_raises_same_as_one(self):
        """Multiple DeletedAddress records can have the same hash."""
        baker.make(DeletedAddress, address_hash=self.deleted_relay_address.address_hash)
        with pytest.raises(RelayAddress.DoesNotExist), MetricsMock() as mm:
            _get_address("deleted456@test.com")
        mm.assert_incr_once("email_for_deleted_address_multiple")

    def test_existing_domain_address(self) -> None:
        with self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert _get_address("domain@subdomain.test.com") == self.domain_address

    def test_uppercase_local_part_of_existing_domain_address(self) -> None:
        """Case-insensitive matching is used in the local part of a domain address."""
        with self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert _get_address("Domain@subdomain.test.com") == self.domain_address

    def test_uppercase_subdomain_part_of_existing_domain_address(self) -> None:
        """Case-insensitive matching is used in the subdomain of a domain address."""
        with self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert _get_address("domain@SubDomain.test.com") == self.domain_address

    def test_uppercase_domain_part_of_existing_domain_address(self) -> None:
        """Case-insensitive matching is used in the domain part of a domain address."""
        with self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert _get_address("domain@subdomain.Test.Com") == self.domain_address

    def test_subdomain_for_wrong_domain_raises(self) -> None:
        with (
            pytest.raises(ObjectDoesNotExist) as exc_info,
            MetricsMock() as mm,
            self.assertNoLogs(GLEAN_LOG, "INFO"),
        ):
            _get_address("unknown@subdomain.example.com")
        assert str(exc_info.value) == "Address does not exist"
        mm.assert_incr_once("email_for_not_supported_domain")

    def test_unknown_subdomain_raises(self) -> None:
        with (
            pytest.raises(Profile.DoesNotExist),
            MetricsMock() as mm,
            self.assertNoLogs(GLEAN_LOG, "INFO"),
        ):
            _get_address("domain@unknown.test.com")
        mm.assert_incr_once("email_for_dne_subdomain")

    def test_unknown_domain_address_is_created(self) -> None:
        """
        An unknown but valid domain address is created.

        This supports creating domain addresses on third-party sites, when
        emailing a checkout receipt, or other situations when the email
        cannot be pre-created.
        """
        assert DomainAddress.objects.filter(user=self.user).count() == 1
        with self.assertLogs(GLEAN_LOG, "INFO") as caplog:
            address = _get_address("unknown@subdomain.test.com")
        assert address.user == self.user
        assert address.address == "unknown"
        assert DomainAddress.objects.filter(user=self.user).count() == 2

        assert (event := get_glean_event(caplog)) is not None
        expected_event = create_expected_glean_event(
            category="email_mask",
            name="created",
            user=self.user,
            extra_items={
                "n_random_masks": "1",
                "n_domain_masks": "2",
                "is_random_mask": "false",
                "has_website": "false",
                "created_by_api": "false",
            },
            event_time=event["timestamp"],
        )
        assert event == expected_event

    def test_unknown_domain_address_is_not_created(self) -> None:
        """An unknown but valid domain address raises with create=False"""
        assert DomainAddress.objects.filter(user=self.user).count() == 1
        with pytest.raises(DomainAddress.DoesNotExist):
            _get_address("unknown@subdomain.test.com", create=False)
        assert DomainAddress.objects.filter(user=self.user).count() == 1

    def test_uppercase_local_part_of_unknown_domain_address(self) -> None:
        """
        Uppercase letters are allowed in the local part of a new domain address.

        This creates a new domain address with lower-cased letters. It supports
        creating domain addresses by third-parties that would not be allowed
        on the relay dashboard due to the upper-case characters, but are still
        consistent with dashboard-created domain addresses.
        """
        assert DomainAddress.objects.filter(user=self.user).count() == 1
        with self.assertLogs(GLEAN_LOG, "INFO") as caplog:
            address = _get_address("Unknown@subdomain.test.com")
        assert address.user == self.user
        assert address.address == "unknown"
        assert DomainAddress.objects.filter(user=self.user).count() == 2

        assert (event := get_glean_event(caplog)) is not None
        expected_event = create_expected_glean_event(
            category="email_mask",
            name="created",
            user=self.user,
            extra_items={
                "n_random_masks": "1",
                "n_domain_masks": "2",
                "is_random_mask": "false",
                "has_website": "false",
                "created_by_api": "false",
            },
            event_time=event["timestamp"],
        )
        assert event == expected_event

    def test_uppercase_local_part_of_unknown_domain_address_not_created(self) -> None:
        """
        Uppercase letters are allowed, but still do not create the domain address.
        """
        assert DomainAddress.objects.filter(user=self.user).count() == 1
        with pytest.raises(DomainAddress.DoesNotExist):
            _get_address("Unknown@subdomain.test.com", create=False)
        assert DomainAddress.objects.filter(user=self.user).count() == 1


@override_settings(SITE_ORIGIN="https://test.com", STATSD_ENABLED=True)
class GetAddressIfExistsTest(TestCase):
    def setUp(self):
        self.user = make_premium_test_user()
        self.user.profile.subdomain = "subdomain"
        self.user.profile.save()
        self.relay_address = baker.make(
            RelayAddress, user=self.user, address="relay123"
        )
        self.deleted_relay_address = baker.make(
            DeletedAddress, address_hash=address_hash("deleted456", domain="test.com")
        )
        self.domain_address = baker.make(
            DomainAddress, user=self.user, address="domain"
        )

    def test_existing_relay_address(self):
        assert _get_address_if_exists("relay123@test.com") == self.relay_address

    def test_unknown_relay_address(self):
        with MetricsMock() as mm:
            assert _get_address_if_exists("unknown@test.com") is None
        mm.assert_not_incr("email_for_unknown_address")

    def test_deleted_relay_address(self):
        with MetricsMock() as mm:
            assert _get_address_if_exists("deleted456@test.com") is None
        mm.assert_not_incr("email_for_deleted_address")

    def test_multiple_deleted_relay_addresses_same_as_one(self):
        """Multiple DeletedAddress records can have the same hash."""
        baker.make(DeletedAddress, address_hash=self.deleted_relay_address.address_hash)
        with MetricsMock() as mm:
            assert _get_address_if_exists("deleted456@test.com") is None
        mm.assert_not_incr("email_for_deleted_address_multiple")

    def test_existing_domain_address(self) -> None:
        with self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert (
                _get_address_if_exists("domain@subdomain.test.com")
                == self.domain_address
            )

    def test_subdomain_for_wrong_domain(self) -> None:
        with MetricsMock() as mm, self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert _get_address_if_exists("unknown@subdomain.example.com") is None
        mm.assert_not_incr("email_for_not_supported_domain")

    def test_unknown_subdomain(self) -> None:
        with MetricsMock() as mm, self.assertNoLogs(GLEAN_LOG, "INFO"):
            assert _get_address_if_exists("domain@unknown.test.com") is None
        mm.assert_not_incr("email_for_dne_subdomain")

    def test_unknown_domain_address(self) -> None:
        """An unknown but valid domain address raises with create=False"""
        assert _get_address_if_exists("unknown@subdomain.test.com") is None

    def test_uppercase_local_part_of_unknown_domain_address(self) -> None:
        assert _get_address_if_exists("Unknown@subdomain.test.com") is None


TEST_AWS_SNS_TOPIC = "arn:aws:sns:us-east-1:111222333:relay"
TEST_AWS_SNS_TOPIC2 = TEST_AWS_SNS_TOPIC + "-alt"


@override_settings(AWS_SNS_TOPIC={TEST_AWS_SNS_TOPIC, TEST_AWS_SNS_TOPIC2})
class ValidateSnsArnTypeTests(SimpleTestCase):
    def test_valid_arn_and_type(self) -> None:
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC, "SubscriptionConfirmation")
        assert ret is None

    def test_no_topic_arn(self) -> None:
        ret = validate_sns_arn_and_type(None, "Notification")
        assert ret == {
            "error": "Received SNS request without Topic ARN.",
            "received_topic_arn": None,
            "supported_topic_arn": [TEST_AWS_SNS_TOPIC, TEST_AWS_SNS_TOPIC2],
            "received_sns_type": "Notification",
            "supported_sns_types": ["SubscriptionConfirmation", "Notification"],
        }

    def test_wrong_topic_arn(self) -> None:
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC + "-new", "Notification")
        assert ret is not None
        assert ret["error"] == "Received SNS message for wrong topic."

    def test_no_message_type(self) -> None:
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC2, None)
        assert ret is not None
        assert ret["error"] == "Received SNS request without Message Type."

    def test_unsupported_message_type(self) -> None:
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC, "UnsubscribeConfirmation")
        assert ret is not None
        assert ret["error"] == "Received SNS message for unsupported Type."


@override_settings(AWS_SNS_TOPIC={EMAIL_SNS_BODIES["s3_stored"]["TopicArn"]})
class SnsInboundViewSimpleTests(SimpleTestCase):
    """Tests for /emails/sns_inbound that do not require database access."""

    def setUp(self):
        self.valid_message = EMAIL_SNS_BODIES["s3_stored"]
        self.client = Client(
            headers={
                "x-amz-sns-topic-arn": self.valid_message["TopicArn"],
                "x-amz-sns-message-type": self.valid_message["Type"],
            }
        )
        self.url = "/emails/sns-inbound"
        patcher1 = patch(
            "emails.views.verify_from_sns", side_effect=self._verify_from_sns_pass
        )
        self.mock_verify_from_sns = patcher1.start()
        self.addCleanup(patcher1.stop)

        patcher2 = patch(
            "emails.views._sns_inbound_logic", side_effect=self._sns_inbound_logic_ok
        )
        self.mock_sns_inbound_logic = patcher2.start()
        self.addCleanup(patcher2.stop)

    def _verify_from_sns_pass(self, json_body):
        """A verify_from_sns that passes content"""
        return json_body

    def _sns_inbound_logic_ok(self, topic_arn, message_type, verified_json_body):
        """A _sns_inbound_logic that returns a 200 OK"""
        return HttpResponse("Looks good to me.")

    def test_valid_message(self):
        ret = self.client.post(
            self.url,
            data=self.valid_message,
            content_type="application/json",
        )
        assert ret.status_code == 200

    def test_no_topic_arn(self):
        invalid_message = deepcopy(self.valid_message)
        invalid_message["TopicArn"] = None
        ret = self.client.post(
            self.url,
            data=invalid_message,
            content_type="application/json",
            headers={"x-amz-sns-topic-arn": None},
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS request without Topic ARN."

    def test_wrong_topic_arn(self):
        invalid_message = deepcopy(self.valid_message)
        invalid_message["TopicArn"] = "wrong_arn"
        ret = self.client.post(
            self.url,
            data=invalid_message,
            content_type="application/json",
            headers={"x-amz-sns-topic-arn": "wrong_arn"},
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS message for wrong topic."

    def test_no_message_type(self):
        invalid_message = deepcopy(self.valid_message)
        invalid_message["Type"] = None
        ret = self.client.post(
            self.url,
            data=invalid_message,
            content_type="application/json",
            headers={"x-amz-sns-message-type": None},
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS request without Message Type."

    def test_unsupported_message_type(self):
        invalid_message = deepcopy(self.valid_message)
        invalid_message["Type"] = "UnsubscribeConfirmation"
        ret = self.client.post(
            self.url,
            data=invalid_message,
            content_type="application/json",
            headers={"x-amz-sns-message-type": "UnsubscribeConfirmation"},
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS message for unsupported Type."


@override_settings(STATSD_ENABLED=True)
class RecordReceiptVerdictsTests(SimpleTestCase):
    """Test the metrics emitter _record_receipt_verdicts."""

    def expected_records(self, state, receipt_overrides=None):
        """Return the expected metrics emitted by calling _record_receipt_verdicts."""
        verdicts = ["dkim", "dmarc", "spam", "spf", "virus"]

        # Five counters for each verdict type
        verdict_metrics = [
            MetricsRecord(
                stat_type="incr",
                key=f"relay.emails.verdicts.{verdict}Verdict",
                value=1,
                tags=[f"state:{state}"],
            )
            for verdict in verdicts
        ]

        # One counter for this email processing state, with tags
        receipt_overrides = receipt_overrides or {}
        status = {
            verdict: receipt_overrides.get(f"{verdict}Verdict", "PASS")
            for verdict in verdicts
        }
        state_tags = [f"{verdict}Verdict:{status[verdict]}" for verdict in verdicts]
        if "dmarcPolicy" in receipt_overrides:
            state_tags.append(f"dmarcPolicy:{receipt_overrides['dmarcPolicy']}")
            state_tags.sort()
        state_metric = MetricsRecord(
            stat_type="incr",
            key=f"relay.emails.state.{state}",
            value=1,
            tags=state_tags,
        )

        return verdict_metrics + [state_metric]

    def test_s3_stored_email(self):
        """The s3_stored fixture passes all checks."""
        body = json.loads(EMAIL_SNS_BODIES["s3_stored"]["Message"])
        receipt = body["receipt"]
        with MetricsMock() as mm:
            _record_receipt_verdicts(receipt, "a_state")
        assert mm.get_records() == self.expected_records("a_state")

    def test_dmarc_failed_email(self):
        body = json.loads(EMAIL_SNS_BODIES["dmarc_failed"]["Message"])
        receipt = body["receipt"]
        with MetricsMock() as mm:
            _record_receipt_verdicts(receipt, "a_state")
        overrides = {
            "spfVerdict": "FAIL",
            "dmarcVerdict": "FAIL",
            "dmarcPolicy": "reject",
        }
        assert mm.get_records() == self.expected_records("a_state", overrides)


@pytest.mark.django_db
def test_wrapped_email_test_from_profile(rf):
    user = baker.make(User)
    baker.make(
        SocialAccount,
        user=user,
        provider="fxa",
        extra_data={"locale": "de,en-US;q=0.9,en;q=0.8"},
    )
    request = rf.get("/emails/wrapped_email_test")
    request.user = user
    response = wrapped_email_test(request)
    assert response.status_code == 200
    no_space_html = re.sub(r"\s+", "", response.content.decode())
    assert "<li><strong>language</strong>:de" in no_space_html
    assert "<li><strong>has_premium</strong>:No" in no_space_html
    assert "<li><strong>has_tracker_report_link</strong>:No" in no_space_html
    assert (
        "<li><strong>num_level_one_email_trackers_removed</strong>:0" in no_space_html
    )


@pytest.mark.parametrize("language", ("en", "fy-NL", "ja"))
@pytest.mark.parametrize("has_premium", ("Yes", "No"))
@pytest.mark.parametrize("has_tracker_report_link", ("Yes", "No"))
@pytest.mark.parametrize("num_level_one_email_trackers_removed", ("0", "1", "2"))
@pytest.mark.django_db
def test_wrapped_email_test(
    rf,
    caplog,
    language,
    has_premium,
    has_tracker_report_link,
    num_level_one_email_trackers_removed,
):
    # Reload Fluent files to regenerate errors
    if language == "en":
        main.reload()

    data = {
        "language": language,
        "has_premium": has_premium,
        "has_tracker_report_link": has_tracker_report_link,
        "num_level_one_email_trackers_removed": num_level_one_email_trackers_removed,
    }
    request = rf.get("/emails/wrapped_email_test", data=data)
    response = wrapped_email_test(request)
    assert response.status_code == 200

    # Check that all Fluent IDs were in the English corpus
    if language == "en" and caplog.record_tuples:  # pragma: no cover
        for log_name, log_level, message in caplog.record_tuples:
            if log_name == "django_ftl.message_errors":
                pytest.fail(message)

    no_space_html = re.sub(r"\s+", "", response.content.decode())
    assert f"<li><strong>language</strong>:{language}" in no_space_html
    assert f"<li><strong>has_premium</strong>:{has_premium}" in no_space_html
    assert (
        f"<li><strong>has_tracker_report_link</strong>:{has_tracker_report_link}"
    ) in no_space_html
    assert (
        "<li><strong>num_level_one_email_trackers_removed</strong>:"
        f"{num_level_one_email_trackers_removed}"
    ) in no_space_html
    if has_tracker_report_link == "Yes" and num_level_one_email_trackers_removed != "0":
        assert "/tracker-report/#" in no_space_html
    else:
        assert "/tracker-report/#" not in no_space_html


@pytest.mark.parametrize("forwarded", ("False", "True"))
@pytest.mark.parametrize("content_type", ("text/plain", "text/html"))
@pytest.mark.django_db
def test_reply_requires_premium_test(rf, forwarded, content_type, caplog):
    main.reload()  # Reload Fluent files to regenerate errors
    url = (
        "/emails/reply_requires_premium_test"
        f"?forwarded={forwarded}&content-type={content_type}"
    )
    request = rf.get(url)
    response = reply_requires_premium_test(request)
    assert response.status_code == 200
    html = response.content.decode()
    assert (
        "/premium/?utm_campaign=email_replies&amp;utm_source=email&amp;utm_medium=email"
        in html
    )
    assert "Upgrade for more protection" in html
    if forwarded == "True":
        assert "We’ve sent this reply" in html
    else:
        assert "Your reply was not sent" in html

    # Check that all Fluent IDs were in the English corpus
    if caplog.record_tuples:  # pragma: no cover
        for log_name, log_level, message in caplog.record_tuples:
            if log_name == "django_ftl.message_errors":
                pytest.fail(message)


def get_text_and_html_content(msg: EmailMessage) -> tuple[str, str]:
    """
    Return the plain text and HTML content of an email message.

    This replaces the legacy function msg.get_payload(). Another
    option is get_body(), which will return the first match.
    """
    text_content: str | None = None
    html_content: str | None = None
    for part in msg.walk():
        content_type = part.get_content_type()
        if content_type == "text/plain":
            if text_content is None:
                text_content = part.get_content()
            else:
                raise Exception("Second plain text section found.")
        elif content_type == "text/html":
            if html_content is None:
                html_content = part.get_content()
            else:
                raise Exception("Second HTML section found.")
        elif content_type.startswith("multipart/"):
            pass
        else:
            raise ValueError(f"Unexpected content type {content_type}")
    assert text_content is not None, "Plain text not found"
    assert html_content is not None, "HTML not found"
    return text_content, html_content


@pytest.mark.django_db
def test_build_reply_requires_premium_email_first_time_includes_forward_text():
    # First create a valid reply record from an external sender to a free Relay user
    free_user = make_free_test_user()
    relay_address = baker.make(
        RelayAddress, user=free_user, address="w41fwbt4q", domain=2
    )

    original_sender = "external_sender@test.com"
    original_msg_id = "<external-msg-id-123@test.com>"
    original_msg_id_bytes = get_message_id_bytes(original_msg_id)
    (lookup_key, encryption_key) = derive_reply_keys(original_msg_id_bytes)
    original_metadata = {
        "message-id": original_msg_id,
        "from": original_sender,
        "reply-to": original_sender,
    }
    original_encrypted_metadata = encrypt_reply_metadata(
        encryption_key, original_metadata
    )
    reply_record = Reply.objects.create(
        lookup=b64_lookup_key(lookup_key),
        encrypted_metadata=original_encrypted_metadata,
        relay_address=relay_address,
    )

    # Now send a reply from the free Relay user to the external sender
    test_from = relay_address.full_address
    test_msg_id = "<relay-user-msg-id-456@usersemail.com>"
    decrypted_metadata = json.loads(
        decrypt_reply_metadata(encryption_key, reply_record.encrypted_metadata)
    )
    msg = _build_reply_requires_premium_email(
        test_from, reply_record, test_msg_id, decrypted_metadata
    )

    domain = get_domains_from_settings().get("RELAY_FIREFOX_DOMAIN")
    expected_From = f"replies@{domain}"
    assert msg["Subject"] == "Replies are not included with your free account"
    assert msg["From"] == expected_From
    assert msg["To"] == relay_address.full_address

    text_content, html_content = get_text_and_html_content(msg)
    assert "sent this reply" in text_content
    assert "sent this reply" in html_content

    assert_email_equals_fixture(
        msg.as_string(), "reply_requires_premium_first", replace_mime_boundaries=True
    )


@pytest.mark.django_db
def test_build_reply_requires_premium_email_after_forward():
    # First create a valid reply record from an external sender to a free Relay user
    free_user = make_free_test_user()
    relay_address = baker.make(
        RelayAddress, user=free_user, address="w41fwbt4q", domain=2
    )
    _set_forwarded_first_reply(free_user.profile)

    original_sender = "external_sender@test.com"
    original_msg_id = "<external-msg-id-123@test.com>"
    original_msg_id_bytes = get_message_id_bytes(original_msg_id)
    (lookup_key, encryption_key) = derive_reply_keys(original_msg_id_bytes)
    original_metadata = {
        "message-id": original_msg_id,
        "from": original_sender,
        "reply-to": original_sender,
    }
    original_encrypted_metadata = encrypt_reply_metadata(
        encryption_key, original_metadata
    )
    reply_record = Reply.objects.create(
        lookup=b64_lookup_key(lookup_key),
        encrypted_metadata=original_encrypted_metadata,
        relay_address=relay_address,
    )

    # Now send a reply from the free Relay user to the external sender
    test_from = relay_address.full_address
    test_msg_id = "<relay-user-msg-id-456@usersemail.com>"
    decrypted_metadata = json.loads(
        decrypt_reply_metadata(encryption_key, reply_record.encrypted_metadata)
    )
    msg = _build_reply_requires_premium_email(
        test_from, reply_record, test_msg_id, decrypted_metadata
    )

    domain = get_domains_from_settings().get("RELAY_FIREFOX_DOMAIN")
    expected_From = f"replies@{domain}"
    assert msg["Subject"] == "Replies are not included with your free account"
    assert msg["From"] == expected_From
    assert msg["To"] == relay_address.full_address

    text_content, html_content = get_text_and_html_content(msg)
    assert "Your reply was not sent" in text_content
    assert "Your reply was not sent" in html_content

    assert_email_equals_fixture(
        msg.as_string(), "reply_requires_premium_second", replace_mime_boundaries=True
    )


def test_get_keys_from_headers_no_reply_headers(settings):
    """If no reply headers, raise ReplyHeadersNotFound."""
    msg_id = "<msg-id-123@email.com>"
    headers = [{"name": "Message-Id", "value": msg_id}]
    settings.STATSD_ENABLED = True
    with MetricsMock() as mm, pytest.raises(ReplyHeadersNotFound):
        _get_keys_from_headers(headers)
    mm.assert_incr_once("mail_to_replies_without_reply_headers")


def test_get_keys_from_headers_in_reply_to():
    """If In-Reply-To header, get keys from it."""
    msg_id = "<msg-id-123@email.com>"
    msg_id_bytes = get_message_id_bytes(msg_id)
    lookup_key, encryption_key = derive_reply_keys(msg_id_bytes)
    headers = [{"name": "In-Reply-To", "value": msg_id}]
    (lookup_key_from_header, encryption_key_from_header) = _get_keys_from_headers(
        headers
    )
    assert lookup_key == lookup_key_from_header
    assert encryption_key == encryption_key_from_header


@pytest.mark.django_db
def test_get_keys_from_headers_references_reply():
    """
    If no In-Reply-To header, get keys from References header.
    """
    msg_id = "<msg-id-456@email.com"
    msg_id_bytes = get_message_id_bytes(msg_id)
    lookup_key, encryption_key = derive_reply_keys(msg_id_bytes)
    baker.make(Reply, lookup=b64_lookup_key(lookup_key))
    msg_ids = f"<msg-id-123@email.com> {msg_id} <msg-id-789@email.com>"
    headers = [{"name": "References", "value": msg_ids}]
    (lookup_key_from_header, encryption_key_from_header) = _get_keys_from_headers(
        headers
    )
    assert lookup_key == lookup_key_from_header
    assert encryption_key == encryption_key_from_header


@pytest.mark.django_db
def test_get_keys_from_headers_references_reply_dne():
    """
    If no In-Reply-To header,
    and no Reply record for any values in the References header,
    raise Reply.DoesNotExist.
    """
    msg_ids = "<msg-id-123@email.com> <msg-id-456@email.com> <msg-id-789@email.com>"
    headers = [{"name": "References", "value": msg_ids}]
    with pytest.raises(Reply.DoesNotExist):
        _get_keys_from_headers(headers)


def test_replace_headers_read_error_is_handled() -> None:
    """
    A header that errors on read is added to issues.

    We can't create a test fixture with a header that raises an exception, because we
    don't know what that header looks like, but we know they exist, because a small
    minority of emails fail when reading the header. Once the exception-catching code is
    in production, we'll know what a failing header looks like, but then we'll probably
    handle it like we did with RelayMessageIDHeader, and we'll be back to not knowing
    what headers raise exceptions.

    So, instead, use the plain_text fixture, add a testing header, and then patch
    EmailMessage so that reading that header (and not the other ones) raises an
    exception.
    """

    email_text = EMAIL_INCOMING["plain_text"]
    email = message_from_string(email_text, policy=relay_policy)
    assert isinstance(email, EmailMessage)

    # Verify that the next headers are different than the existing headers
    new_headers: OutgoingHeaders = {
        "Subject": "Error Handling Test",
        "From": "from@example.com",
        "To": "to@example.com",
    }
    for name, value in new_headers.items():
        assert email[name] != value

    # Add a header that will raise an exception when read.
    # The header itself is OK, but we mock  Message.__getitem__ (called when you use
    # value = email[name]) to raise an error when the test header is accessed.
    email["X-Fail"] = "I am for testing read exceptions"

    def getitem_raise_on_x_fail(self, name):
        """
        Message.__getitem__ that raises for X-Fail header

        https://github.com/python/cpython/blob/babb787047e0f7807c8238d3b1a3128dac30bd5c/Lib/email/message.py#L409-L418
        """
        if name == "X-Fail":
            raise RuntimeError("I failed.")
        return self.get(name)

    # Activate our testing mock and run _replace_headers
    with patch.object(EmailMessage, "__getitem__", getitem_raise_on_x_fail):
        issues = _replace_headers(email, new_headers)

    # The mocked exception was handled and logged
    assert issues == [
        {
            "header": "X-Fail",
            "direction": "in",
            "exception_on_read": "RuntimeError('I failed.')",
        }
    ]

    # _replace_headers continued working with the remaining data, the headers are now
    # set to the desired new values.
    for name, value in new_headers.items():
        assert email[name] == value


@pytest.mark.django_db
def test_opt_out_user_has_minimal_email_dropped_log(caplog):
    user = baker.make(User, email="opt-out@example.com")
    address = user.relayaddress_set.create()
    SocialAccount.objects.create(
        user=user,
        provider="fxa",
        uid=str(uuid4()),
        extra_data={
            "avatar": "image.png",
            "subscriptions": [],
            "metricsEnabled": False,
        },
    )
    log_email_dropped("abuse_flag", address)
    assert len(caplog.records) == 1
    assert log_extra(caplog.records[0]) == {
        "reason": "abuse_flag",
        "is_random_mask": True,
        "is_reply": False,
        "can_retry": False,
    }
