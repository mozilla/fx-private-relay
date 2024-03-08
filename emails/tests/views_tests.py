from copy import deepcopy
from datetime import datetime, timedelta, timezone
from email import message_from_string
from email.message import EmailMessage
from typing import cast
from unittest.mock import patch, Mock
from uuid import uuid4
import glob
import json
import os
import re

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse
from django.test import override_settings, Client, SimpleTestCase, TestCase

from allauth.socialaccount.models import SocialAccount
from botocore.exceptions import ClientError
from markus.main import MetricsRecord
from markus.testing import MetricsMock
from model_bakery import baker
import pytest

from privaterelay.ftl_bundles import main
from emails.models import (
    DeletedAddress,
    DomainAddress,
    Profile,
    RelayAddress,
    Reply,
    address_hash,
)
from emails.types import AWS_SNSMessageJSON, OutgoingHeaders
from emails.utils import (
    b64_lookup_key,
    decrypt_reply_metadata,
    derive_reply_keys,
    encrypt_reply_metadata,
    get_domains_from_settings,
    get_message_id_bytes,
    InvalidFromHeader,
)
from emails.views import (
    ReplyHeadersNotFound,
    _build_reply_requires_premium_email,
    _get_address,
    _get_keys_from_headers,
    _record_receipt_verdicts,
    _replace_headers,
    _set_forwarded_first_reply,
    _sns_message,
    _sns_notification,
    reply_requires_premium_test,
    validate_sns_arn_and_type,
    wrapped_email_test,
)
from emails.policy import relay_policy

from .models_tests import (
    make_free_test_user,
    make_premium_test_user,
    upgrade_test_user_to_premium,
)

# Load the sns json fixtures from files
real_abs_cwd = os.path.realpath(os.path.join(os.getcwd(), os.path.dirname(__file__)))
single_rec_file = os.path.join(
    real_abs_cwd, "fixtures", "single_recipient_sns_body.json"
)


def load_fixtures(file_suffix: str) -> dict[str, AWS_SNSMessageJSON | str]:
    """Load all fixtures with a particular suffix."""
    path = os.path.join(real_abs_cwd, "fixtures", "*" + file_suffix)
    ext = os.path.splitext(file_suffix)[1]
    fixtures: dict[str, AWS_SNSMessageJSON | str] = {}
    for fixture_file in glob.glob(path):
        file_name = os.path.basename(fixture_file)
        key = file_name[: -len(file_suffix)]
        assert key not in fixtures
        with open(fixture_file, "r") as f:
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
        message_id = email["Message-ID"].as_unstructured
    else:
        message_id = None
    # This function cannot handle malformed To: addresses
    assert not email["To"].defects

    sns_message = {
        "notificationType": "Received",
        "mail": {
            "timestamp": email["Date"].datetime.isoformat(),
            # To handle invalid From address, find 'first' address with what looks like
            # an email portion and use that email, or fallback to invalid@example.com
            "source": next(
                (
                    addr.addr_spec
                    for addr in email["From"].addresses
                    if "@" in addr.addr_spec
                ),
                "invalid@example.com",
            ),
            "messageId": message_id,
            "destination": [addr.addr_spec for addr in email["To"].addresses],
            "headersTruncated": False,
            "headers": [
                {"name": _h, "value": str(_v.as_unstructured)}
                for _h, _v in email.items()
            ],
            "commonHeaders": {
                "from": [email["From"].as_unstructured],
                "date": email["Date"],
                "to": [str(addr) for addr in email["To"].addresses],
                "messageId": message_id,
                "subject": email["Subject"].as_unstructured,
            },
        },
        "receipt": {
            "timestamp": (email["Date"].datetime + timedelta(seconds=1)).isoformat(),
            "processingTimeMillis": 1001,
            "recipients": [addr.addr_spec for addr in email["To"].addresses],
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
        "Subject": str(email["Subject"].as_unstructured),
        "Message": json.dumps(sns_message),
        "Timestamp": (email["Date"].datetime + timedelta(seconds=2)).isoformat(),
        "SignatureVersion": "1",
        "Signature": "invalid-signature",
        "SigningCertURL": f"{base_url}/SimpleNotificationService-abcd1234.pem",
        "UnsubscribeURL": (
            f"{base_url}/?Action=Unsubscribe&SubscriptionArn={topic_arn}:{uuid4()}"
        ),
    }
    return sns_notification


def assert_email_equals_fixture(
    output_email: str, fixture_name: str, replace_mime_boundaries: bool = False
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

    if test_output_email != expected:
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
        if "" not in raw_message.splitlines():
            raise Exception("Never found message body!")
        if expected_source is not None:
            assert source == expected_source
        if expected_destination is not None:
            assert destinations[0] == expected_destination
        assert_email_equals_fixture(raw_message, fixture_name, replace_mime_boundaries)


class SNSNotificationIncomingTest(SNSNotificationTestBase):
    """Tests for _sns_notification for incoming emails to Relay users"""

    def setUp(self) -> None:
        super().setUp()
        self.user = baker.make(User, email="user@example.com")
        self.profile = self.user.profile
        self.profile.last_engagement = datetime.now(timezone.utc)
        self.profile.save()
        self.sa: SocialAccount = baker.make(
            SocialAccount, user=self.user, provider="fxa"
        )
        self.ra = baker.make(
            RelayAddress, user=self.user, address="ebsbdsan7", domain=2
        )
        self.premium_user = make_premium_test_user()
        self.premium_profile = Profile.objects.get(user=self.premium_user)
        self.premium_profile.subdomain = "subdomain"
        self.premium_profile.last_engagement = datetime.now(timezone.utc)
        self.premium_profile.save()

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
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0
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
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

    def test_list_email_sns_notification(self) -> None:
        """By default, list emails should still forward."""
        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        self.check_sent_email_matches_fixture("single_recipient_list")
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

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
        _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])

        self.mock_send_raw_email.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1

    @override_settings(STATSD_ENABLED=True)
    def test_spamVerdict_FAIL_auto_block_doesnt_relay(self) -> None:
        """When a user has auto_block_spam=True, spam will not relay."""
        self.profile.auto_block_spam = True
        self.profile.save()

        with MetricsMock() as mm:
            _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])
        mm.assert_incr_once("fx.private.relay.email_auto_suppressed_for_spam")

        self.mock_send_raw_email.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0

    def test_domain_recipient(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])

        self.check_sent_email_matches_fixture(
            "domain_recipient", expected_destination="premium@email.com"
        )
        da = DomainAddress.objects.get(user=self.premium_user, address="wildcard")
        assert da.num_forwarded == 1
        assert da.last_used_at
        assert (datetime.now(tz=timezone.utc) - da.last_used_at).seconds < 2.0

    def test_successful_email_relay_message_removed_from_s3(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        self.mock_send_raw_email.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at is not None
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

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
        with self.assertLogs("eventsinfo", "ERROR") as event_caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["single_recipient"])
        assert response.status_code == 503

        assert len(event_caplog.records) == 1
        event_log = event_caplog.records[0]
        assert getattr(event_log, "from_address") == "fxastage@protonmail.com"
        assert getattr(event_log, "source") == "fxastage@protonmail.com"
        assert getattr(event_log, "common_headers_from") == [
            "fxastage <fxastage@protonmail.com>"
        ]
        assert getattr(event_log, "headers_from") == [
            {"name": "From", "value": "fxastage <fxastage@protonmail.com>"}
        ]

        self.mock_send_raw_email.assert_not_called()
        self.mock_remove_message_from_s3.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0
        assert self.ra.last_used_at is None

    def test_inline_image(self) -> None:
        email_text = EMAIL_INCOMING["inline_image"]
        test_sns_notification = create_notification_from_email(email_text)
        _sns_notification(test_sns_notification)

        self.check_sent_email_matches_fixture("inline_image")
        self.mock_remove_message_from_s3.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

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
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

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
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0
        mock_logger.warning.assert_not_called()

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
        expected_header_errors = {
            "incoming": [
                (
                    "From",
                    {
                        "defect_count": 4,
                        "parsed_value": (
                            '"Norton I.", Emperor of the United States'
                            " <norton@sf.us.example.com>"
                        ),
                        "unstructured_value": (
                            "Norton I., Emperor of the United States"
                            " <norton@sf.us.example.com>"
                        ),
                    },
                )
            ]
        }
        mock_logger.warning.assert_called_once_with(
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
        mock_logger.warning.assert_not_called()

    @patch("emails.views.info_logger")
    def test_invalid_message_id_is_forwarded(self, mock_logger: Mock) -> None:
        email_text = EMAIL_INCOMING["message_id_in_brackets"]
        test_sns_notification = create_notification_from_email(email_text)

        result = _sns_notification(test_sns_notification)
        assert result.status_code == 200
        self.check_sent_email_matches_fixture(
            "message_id_in_brackets", replace_mime_boundaries=True
        )
        expected_header_errors = {
            "incoming": [
                (
                    "Message-ID",
                    {
                        "defect_count": 1,
                        "parsed_value": (
                            "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>"
                        ),
                        "unstructured_value": (
                            "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>"
                        ),
                    },
                )
            ]
        }
        mock_logger.warning.assert_called_once_with(
            "_handle_received: forwarding issues",
            extra={"issues": {"headers": expected_header_errors}},
        )


class SNSNotificationRepliesTest(SNSNotificationTestBase):
    """Tests for _sns_notification for replies from Relay users"""

    def setUp(self) -> None:
        super().setUp()

        # Create a premium user matching the s3_stored_replies sender
        self.user = baker.make(User, email="source@sender.com")
        self.user.profile.server_storage = True
        self.user.profile.date_subscribed = datetime.now(tz=timezone.utc)
        self.user.profile.last_engagement = datetime.now(tz=timezone.utc)
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
        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 200

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
        assert (datetime.now(tz=timezone.utc) - last_used_at).seconds < 2.0
        assert (last_en := self.relay_address.user.profile.last_engagement) is not None
        assert last_en > self.pre_reply_last_engagement

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
        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 403
        assert response.content == b"Relay replies require a premium account"

    def test_get_message_content_from_s3_not_found(self) -> None:
        self.mock_get_content.side_effect = ClientError(
            operation_name="S3.something",
            error_response={"Error": {"Code": "NoSuchKey", "Message": "the message"}},
        )
        with self.assertLogs("events", "ERROR") as events_caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        self.mock_send_raw_email.assert_not_called()
        assert response.status_code == 404
        assert response.content == b"Email not in S3"

        assert len(events_caplog.records) == 1
        events_log = events_caplog.records[0]
        assert events_log.message == "s3_object_does_not_exist"
        assert getattr(events_log, "Code") == "NoSuchKey"
        assert getattr(events_log, "Message") == "the message"

    def test_get_message_content_from_s3_other_error(self) -> None:
        self.mock_get_content.side_effect = ClientError(
            operation_name="S3.something",
            error_response={"Error": {"Code": "IsNapping", "Message": "snooze"}},
        )
        with self.assertLogs("events", "ERROR") as events_caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        self.mock_send_raw_email.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"Cannot fetch the message content from S3"

        assert len(events_caplog.records) == 1
        events_log = events_caplog.records[0]
        assert events_log.message == "s3_client_error_get_email"
        assert getattr(events_log, "Code") == "IsNapping"
        assert getattr(events_log, "Message") == "snooze"

    def test_ses_client_error(self) -> None:
        self.mock_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored_replies"], text="text content"
        )
        self.mock_send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED
        with self.assertLogs("events", "ERROR") as events_caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 400
        assert response.content == b"SES client error"

        assert len(events_caplog.records) == 1
        events_log = events_caplog.records[0]
        assert events_log.message == "ses_client_error_raw_email"
        assert getattr(events_log, "Code") == "the code"
        assert getattr(events_log, "Message") == "the message"


class BounceHandlingTest(TestCase):
    def setUp(self):
        self.user = baker.make(User, email="relayuser@test.com")

    def test_sns_message_with_hard_bounce(self) -> None:
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES["hard"])

        self.user.refresh_from_db()
        assert self.user.profile.last_hard_bounce is not None
        assert self.user.profile.last_hard_bounce >= pre_request_datetime

    def test_sns_message_with_soft_bounce(self) -> None:
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES["soft"])

        self.user.refresh_from_db()
        assert self.user.profile.last_soft_bounce is not None
        assert self.user.profile.last_soft_bounce >= pre_request_datetime

    def test_sns_message_with_spam_bounce_sets_auto_block_spam(self):
        _sns_notification(BOUNCE_SNS_BODIES["spam"])
        self.user.refresh_from_db()
        assert self.user.profile.auto_block_spam


class ComplaintHandlingTest(TestCase):
    """Test Complaint notifications and events."""

    def setUp(self):
        self.user = baker.make(User, email="relayuser@test.com")

    @pytest.fixture(autouse=True)
    def use_caplog(self, caplog):
        self.caplog = caplog

    @override_settings(STATSD_ENABLED=True)
    def test_notification_type_complaint(self):
        """
        A notificationType of complaint increments a counter, logs details, and
        returns 200.

        Example derived from:
        https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object
        """
        assert self.user.profile.auto_block_spam is False

        complaint = {
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
        }
        json_body = {"Message": json.dumps(complaint)}
        with MetricsMock() as mm:
            response = _sns_notification(json_body)
        assert response.status_code == 200

        self.user.profile.refresh_from_db()
        assert self.user.profile.auto_block_spam is True

        mm.assert_incr_once(
            "fx.private.relay.email_complaint",
            tags=[
                "complaint_subtype:none",
                "complaint_feedback:abuse",
                "user_match:found",
                "relay_action:auto_block_spam",
            ],
        )
        assert len(self.caplog.records) == 2
        record1, record2 = self.caplog.records
        assert record1.msg == "complaint_notification"
        assert record1.complaint_subtype is None
        assert record1.complaint_user_agent == "ExampleCorp Feedback Loop (V0.01)"
        assert record1.complaint_feedback == "abuse"
        assert record1.user_match == "found"
        assert record1.relay_action == "auto_block_spam"
        assert record1.domain == "test.com"

        assert record2.msg == "complaint_received"
        assert record2.recipient_domains == ["test.com"]
        assert record2.subtype is None
        assert record2.feedback == "abuse"


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
        mm.assert_incr_once(
            "fx.private.relay.reply_email_header_error", tags=["detail:no-header"]
        )
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
        mm.assert_incr_once(
            "fx.private.relay.reply_email_header_error", tags=["detail:no-header"]
        )
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
        mm.assert_incr_once(
            "fx.private.relay.reply_email_header_error", tags=["detail:no-reply-record"]
        )
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
        mm.assert_incr_once(
            "fx.private.relay.reply_email_header_error", tags=["detail:no-reply-record"]
        )
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

    def test_auto_block_spam_true_email_in_s3_deleted(self) -> None:
        self.profile.auto_block_spam = True
        self.profile.save()
        message_spamverdict_failed = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            '"spamVerdict":{"status":"PASS"}', '"spamVerdict":{"status":"FAIL"}'
        )
        notification_w_spamverdict_failed = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_spamverdict_failed["Message"] = message_spamverdict_failed

        with MetricsMock() as mm:
            response = _sns_notification(notification_w_spamverdict_failed)
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address rejects spam."
        mm.assert_incr_once("fx.private.relay.email_auto_suppressed_for_spam")

    def test_user_bounce_soft_paused_email_in_s3_deleted(self) -> None:
        self.profile.last_soft_bounce = datetime.now(timezone.utc)
        self.profile.save()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        mm.assert_incr_once("fx.private.relay.email_suppressed_for_soft_bounce")

    def test_user_bounce_hard_paused_email_in_s3_deleted(self) -> None:
        self.profile.last_hard_bounce = datetime.now(timezone.utc)
        self.profile.save()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        mm.assert_incr_once("fx.private.relay.email_suppressed_for_hard_bounce")

    @patch("emails.views._reply_allowed")
    @patch("emails.views._get_reply_record_from_lookup_key")
    def test_reply_not_allowed_email_in_s3_deleted(
        self, mocked_reply_record: Mock, mocked_reply_allowed: Mock
    ) -> None:
        # external user sending a reply to Relay user
        # where the replies were being exchanged but now the user
        # no longer has the premium subscription
        mocked_reply_allowed.return_value = False

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 403
        assert response.content == b"Relay replies require a premium account"

    def test_flagged_user_email_in_s3_deleted(self) -> None:
        profile = self.address.user.profile
        profile.last_account_flagged = datetime.now(timezone.utc)
        profile.last_engagement = datetime.now(timezone.utc)
        profile.save()
        pre_flagged_last_engagement = profile.last_engagement

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        profile.refresh_from_db()
        assert profile.last_engagement == pre_flagged_last_engagement

    def test_relay_address_disabled_email_in_s3_deleted(self) -> None:
        self.address.enabled = False
        self.address.save()
        profile = self.address.user.profile
        profile.last_engagement = datetime.now(timezone.utc)
        profile.save()
        pre_blocked_email_last_engagement = profile.last_engagement

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."
        profile.refresh_from_db()
        assert profile.last_engagement > pre_blocked_email_last_engagement
        mm.assert_incr_once("fx.private.relay.email_for_disabled_address")

    @patch("emails.views._check_email_from_list")
    def test_blocked_list_email_in_s3_deleted(
        self, mocked_email_is_from_list: Mock
    ) -> None:
        upgrade_test_user_to_premium(self.user)
        self.address.block_list_emails = True
        self.address.save()
        profile = self.address.user.profile
        profile.last_engagement = datetime.now(timezone.utc)
        profile.save()
        pre_blocked_email_last_engagement = profile.last_engagement
        mocked_email_is_from_list.return_value = True

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is not accepting list emails."
        profile.refresh_from_db()
        assert profile.last_engagement > pre_blocked_email_last_engagement
        mm.assert_incr_once("fx.private.relay.list_email_for_address_blocking_lists")

    @patch("emails.views.get_message_content_from_s3")
    def test_get_text_html_s3_client_error_email_in_s3_not_deleted(
        self, mocked_get_content: Mock
    ) -> None:
        mocked_get_content.side_effect = ClientError(
            {"Error": {"Code": "SomeErrorCode", "Message": "Details"}}, ""
        )

        with self.assertLogs("events", "ERROR") as event_caplog:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"Cannot fetch the message content from S3"

        assert len(event_caplog.records) == 1
        event_log = event_caplog.records[0]
        assert event_log.message == "s3_client_error_get_email"
        assert getattr(event_log, "Code") == "SomeErrorCode"
        assert getattr(event_log, "Message") == "Details"

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_ses_client_error_email_in_s3_not_deleted(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        mocked_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored"], text="text_content"
        )
        mocked_ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"SES client error on Raw Email"

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_successful_email_in_s3_deleted(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        mocked_get_content.return_value = create_email_from_notification(
            EMAIL_SNS_BODIES["s3_stored"], "text_content"
        )
        mocked_ses_client.send_raw_email.return_value = {"MessageId": "NICE"}

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Sent email to final recipient."

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views.get_message_content_from_s3")
    def test_dmarc_failure_s3_deleted(
        self, mocked_get_content: Mock, mocked_ses_client: Mock
    ) -> None:
        """A message with a failing DMARC and a "reject" policy is rejected."""
        mocked_get_content.side_effect = FAIL_TEST_IF_CALLED
        mocked_ses_client.send_raw_email.side_effect = FAIL_TEST_IF_CALLED

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["dmarc_failed"])
        self.mock_remove_message_from_s3.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400
        assert response.content == b"DMARC failure, policy is reject"
        mm.assert_incr_once(
            "fx.private.relay.email_suppressed_for_dmarc_failure",
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
        with self.assertLogs("events", "ERROR") as events_caplog:
            response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_not_called()
        assert response.status_code == 404
        assert response.content == b"Email not in S3"

        assert len(events_caplog.records) == 1
        events_log = events_caplog.records[0]
        assert events_log.message == "s3_object_does_not_exist"
        assert getattr(events_log, "Code") == "NoSuchKey"
        assert getattr(events_log, "Message") == "the message"

    def test_ses_send_raw_email_has_client_error_early_exits(self) -> None:
        self.mock_ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED
        with self.assertLogs("events", "ERROR") as events_caplog:
            response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_called_once()
        assert response.status_code == 503

        assert len(events_caplog.records) == 1
        events_log = events_caplog.records[0]
        assert events_log.message == "ses_client_error_raw_email"
        assert getattr(events_log, "Code") == "the code"
        assert getattr(events_log, "Message") == "the message"

    def test_ses_send_raw_email_email_relayed_email_deleted_from_s3(self):
        self.mock_ses_client.send_raw_email.return_value = {"MessageId": str(uuid4())}
        response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_called_once()
        assert response.status_code == 200


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
        mm.assert_incr_once("fx.private.relay.email_for_unknown_address")

    def test_deleted_relay_address_raises(self):
        with pytest.raises(RelayAddress.DoesNotExist), MetricsMock() as mm:
            _get_address("deleted456@test.com")
        mm.assert_incr_once("fx.private.relay.email_for_deleted_address")

    def test_multiple_deleted_relay_addresses_raises_same_as_one(self):
        """Multiple DeletedAddress records can have the same hash."""
        baker.make(DeletedAddress, address_hash=self.deleted_relay_address.address_hash)
        with pytest.raises(RelayAddress.DoesNotExist), MetricsMock() as mm:
            _get_address("deleted456@test.com")
        mm.assert_incr_once("fx.private.relay.email_for_deleted_address_multiple")

    def test_existing_domain_address(self):
        assert _get_address("domain@subdomain.test.com") == self.domain_address

    def test_uppercase_local_part_of_existing_domain_address(self):
        """Case-insensitive matching is used in the local part of a domain address."""
        assert _get_address("Domain@subdomain.test.com") == self.domain_address

    def test_uppercase_subdomain_part_of_existing_domain_address(self):
        """Case-insensitive matching is used in the subdomain of a domain address."""
        assert _get_address("domain@SubDomain.test.com") == self.domain_address

    def test_uppercase_domain_part_of_existing_domain_address(self):
        """Case-insensitive matching is used in the domain part of a domain address."""
        assert _get_address("domain@subdomain.Test.Com") == self.domain_address

    def test_subdomain_for_wrong_domain_raises(self):
        with pytest.raises(ObjectDoesNotExist) as exc_info, MetricsMock() as mm:
            _get_address("unknown@subdomain.example.com")
        assert str(exc_info.value) == "Address does not exist"
        mm.assert_incr_once("fx.private.relay.email_for_not_supported_domain")

    def test_unknown_subdomain_raises(self):
        with pytest.raises(Profile.DoesNotExist), MetricsMock() as mm:
            _get_address("domain@unknown.test.com")
        mm.assert_incr_once("fx.private.relay.email_for_dne_subdomain")

    def test_unknown_domain_address_is_created(self):
        """
        An unknown but valid domain address is created.

        This supports creating domain addresses on third-party sites, when
        emailing a checkout reciept, or other situations when the email
        cannot be pre-created.
        """
        assert DomainAddress.objects.filter(user=self.user).count() == 1
        address = _get_address("unknown@subdomain.test.com")
        assert address.user == self.user
        assert address.address == "unknown"
        assert DomainAddress.objects.filter(user=self.user).count() == 2

    def test_uppercase_local_part_of_unknown_domain_address(self):
        """
        Uppercase letters are allowed in the local part of a new domain address.

        This creates a new domain address with lower-cased letters. It supports
        creating domain addresses by third-parties that would not be allowed
        on the relay dashboard due to the upper-case characters, but are still
        consistent with dashboard-created domain adddresses.
        """
        assert DomainAddress.objects.filter(user=self.user).count() == 1
        address = _get_address("Unknown@subdomain.test.com")
        assert address.user == self.user
        assert address.address == "unknown"
        assert DomainAddress.objects.filter(user=self.user).count() == 2


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
                key=f"fx.private.relay.relay.emails.verdicts.{verdict}Verdict",
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
            key=f"fx.private.relay.relay.emails.state.{state}",
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
    if language == "en":
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
    for log_name, log_level, message in caplog.record_tuples:
        if log_name == "django_ftl.message_errors":
            pytest.fail(message)


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

    text_part, html_part = msg.get_payload()
    text_content = text_part.get_payload()
    html_content = html_part.get_payload()
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

    text_part, html_part = msg.get_payload()
    text_content = text_part.get_payload()
    html_content = html_part.get_payload()
    assert "Your reply was not sent" in text_content
    assert "Your reply was not sent" in html_content

    assert_email_equals_fixture(
        msg.as_string(), "reply_requires_premium_second", replace_mime_boundaries=True
    )


def test_get_keys_from_headers_no_reply_headers():
    """If no reply headers, raise ReplyHeadersNotFound."""
    msg_id = "<msg-id-123@email.com>"
    headers = [{"name": "Message-Id", "value": msg_id}]
    with pytest.raises(ReplyHeadersNotFound):
        with MetricsMock() as mm:
            _get_keys_from_headers(headers)
        mm.assert_incr_once("fx.private.relay.email_complaint")


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
    assert issues == {
        "incoming": [("X-Fail", {"exception_on_read": "RuntimeError('I failed.')"})]
    }

    # _replace_headers continued working with the remaining data, the headers are now
    # set to the desired new values.
    for name, value in new_headers.items():
        assert email[name] == value
