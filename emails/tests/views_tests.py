import glob
import io
import json
import os
import re
from base64 import b64decode
from copy import deepcopy
from datetime import datetime, timezone
from email.message import EmailMessage
from unittest.mock import Mock, patch
from uuid import uuid4

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
    Profile,
    RelayAddress,
    Reply,
    address_hash,
    get_domains_from_settings,
)
from emails.utils import (
    b64_lookup_key,
    decrypt_reply_metadata,
    derive_reply_keys,
    encrypt_reply_metadata,
    get_message_id_bytes,
)
from emails.views import (
    RESENDER_HEADERS_FLAG_NAME,
    ReplyHeadersNotFound,
    _build_reply_requires_premium_email,
    _get_address,
    _get_attachment,
    _get_keys_from_headers,
    _record_receipt_verdicts,
    _set_forwarded_first_reply,
    _sns_message,
    _sns_notification,
    reply_requires_premium_test,
    validate_sns_arn_and_type,
    wrapped_email_test,
)
from privaterelay.ftl_bundles import main

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

EMAIL_SNS_BODIES = {}
file_suffix = "_email_sns_body.json"
for email_file in glob.glob(os.path.join(real_abs_cwd, "fixtures", "*" + file_suffix)):
    file_name = os.path.basename(email_file)
    email_type = file_name[: -len(file_suffix)]
    with open(email_file, "r") as f:
        email_sns_body = json.load(f)
        EMAIL_SNS_BODIES[email_type] = email_sns_body

BOUNCE_SNS_BODIES = {}
for bounce_type in ["soft", "hard", "spam"]:
    bounce_file = os.path.join(
        real_abs_cwd, "fixtures", "%s_bounce_sns_body.json" % bounce_type
    )
    with open(bounce_file, "r") as f:
        bounce_sns_body = json.load(f)
        BOUNCE_SNS_BODIES[bounce_type] = bounce_sns_body

INVALID_SNS_BODIES = {}
inv_file_suffix = "_invalid_sns_body.json"
for email_file in glob.glob(
    os.path.join(real_abs_cwd, "fixtures", "*" + inv_file_suffix)
):
    file_name = os.path.basename(email_file)
    file_type = file_name[: -len(inv_file_suffix)]
    with open(email_file, "r") as f:
        sns_body = json.load(f)
        INVALID_SNS_BODIES[file_type] = sns_body


# Set mocked_function.side_effect = FAIL_TEST_IF_CALLED to safely disable a function
# for test and assert it was never called.
FAIL_TEST_IF_CALLED = Exception("This function should not have been called.")

# Set mocked ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED to
# simulate an error
SEND_RAW_EMAIL_FAILED = ClientError(
    operation_name="SES.send_raw_email",
    error_response={"Error": {"Code": "the code", "Message": "the message"}},
)


@override_settings(RELAY_FROM_ADDRESS="reply@relay.example.com")
class SNSNotificationTest(TestCase):
    def setUp(self):
        self.user = baker.make(User, email="user@example.com")
        self.profile = self.user.profile
        self.sa = baker.make(SocialAccount, user=self.user, provider="fxa")
        self.ra = baker.make(
            RelayAddress, user=self.user, address="ebsbdsan7", domain=2
        )
        self.premium_user = make_premium_test_user()
        self.premium_profile = Profile.objects.get(user=self.premium_user)
        self.premium_profile.subdomain = "subdomain"
        self.premium_profile.save()

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

    def get_details_from_mock_send_raw_email(self) -> tuple[str, str, dict[str, str]]:
        """
        Get sender, recipient, and headers from the message sent by mocked
        ses_client.send_raw_email
        """
        self.mock_send_raw_email.assert_called_once()
        source = self.mock_send_raw_email.call_args[1]["Source"]
        destinations = self.mock_send_raw_email.call_args[1]["Destinations"]
        assert len(destinations) == 1
        raw_message = self.mock_send_raw_email.call_args[1]["RawMessage"]["Data"]
        headers: dict[str, str] = {}
        for line in raw_message.splitlines():
            if not line:
                # Start of message body, done with headers
                return source, destinations[0], headers
            assert ": " in line
            key, val = line.split(": ", 1)
            assert key not in headers
            headers[key] = val
        raise Exception("Never found message body!")

    def test_single_recipient_sns_notification(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == (
            "=?utf-8?q?=22fxastage=40protonmail=2Ecom_=5Bvia_Relay=5D=22?="
            " <reply@relay.example.com>"
        )
        assert recipient == "user@example.com"
        content_type = headers.pop("Content-Type")
        assert content_type.startswith('multipart/mixed; boundary="========')
        assert headers == {
            "Subject": "localized email header + footer",
            "MIME-Version": "1.0",
            "From": sender,
            "To": recipient,
            "Reply-To": "replies@default.com",
        }

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

    @override_flag(RESENDER_HEADERS_FLAG_NAME, active=True)
    def test_single_recipient_sns_notification_resender_headers(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == "replies@default.com"
        assert recipient == "user@example.com"
        content_type = headers.pop("Content-Type")
        assert content_type.startswith('multipart/mixed; boundary="========')
        assert headers == {
            "Subject": "localized email header + footer",
            "MIME-Version": "1.0",
            "From": '"fxastage@protonmail.com [via Relay]" <ebsbdsan7@test.com>',
            "To": "user@example.com",
            "Reply-To": "replies@default.com",
            "Resent-From": "fxastage@protonmail.com",
        }

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

    def test_list_email_sns_notification(self) -> None:
        """By default, list emails should still forward."""
        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == (
            "=?utf-8?q?=22fxastage=40protonmail=2Ecom_=5Bvia_Relay=5D=22?="
            " <reply@relay.example.com>"
        )
        assert recipient == "user@example.com"
        assert headers == {
            "Content-Type": headers["Content-Type"],
            "Subject": "localized email header + footer",
            "MIME-Version": "1.0",
            "From": sender,
            "To": recipient,
            "Reply-To": "replies@default.com",
        }

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert (datetime.now(tz=timezone.utc) - self.ra.last_used_at).seconds < 2.0

    @override_flag(RESENDER_HEADERS_FLAG_NAME, active=True)
    def test_list_email_sns_notification_resender_headers(self) -> None:
        """By default, list emails should still forward."""
        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == "replies@default.com"
        assert recipient == "user@example.com"
        assert headers == {
            "Content-Type": headers["Content-Type"],
            "Subject": "localized email header + footer",
            "MIME-Version": "1.0",
            "From": '"fxastage@protonmail.com [via Relay]" <ebsbdsan7@test.com>',
            "To": "user@example.com",
            "Reply-To": "replies@default.com",
            "Resent-From": "fxastage@protonmail.com",
        }

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
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
        fxa_account = self.premium_user.profile.fxa
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

    def test_spamVerdict_FAIL_auto_block_doesnt_relay(self) -> None:
        """When a user has auto_block_spam=True, spam will not relay."""
        self.profile.auto_block_spam = True
        self.profile.save()

        _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])

        self.mock_send_raw_email.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0

    def test_domain_recipient(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == (
            "=?utf-8?q?=22fxastage=40protonmail=2Ecom_=5Bvia_Relay=5D=22?="
            " <replies@default.com>"
        )
        assert recipient == "premium@email.com"
        assert headers == {
            "Content-Type": headers["Content-Type"],
            "Subject": "localized email header + footer",
            "MIME-Version": "1.0",
            "From": sender,
            "To": recipient,
            "Reply-To": "replies@default.com",
        }

        da = DomainAddress.objects.get(user=self.premium_user, address="wildcard")
        assert da.num_forwarded == 1
        assert da.last_used_at
        assert (datetime.now(tz=timezone.utc) - da.last_used_at).seconds < 2.0

    @override_flag(RESENDER_HEADERS_FLAG_NAME, active=True)
    def test_domain_recipient_resender_headers(self) -> None:
        _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == "replies@default.com"
        assert recipient == "premium@email.com"
        assert headers == {
            "Content-Type": headers["Content-Type"],
            "Subject": "localized email header + footer",
            "MIME-Version": "1.0",
            "From": (
                '"fxastage@protonmail.com [via Relay]" <wildcard@subdomain.test.com>'
            ),
            "To": "premium@email.com",
            "Reply-To": "replies@default.com",
            "Resent-From": "fxastage@protonmail.com",
        }

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

    @patch("emails.views._get_text_html_attachments")
    def test_reply(self, mock_get_content, resender_headers=False) -> None:
        """The headers of a reply refer to the Relay mask."""

        # Create a premium user matching the s3_stored_replies sender
        user = baker.make(User, email="source@sender.com")
        user.profile.server_storage = True
        user.profile.date_subscribed = datetime.now(tz=timezone.utc)
        user.profile.save()
        upgrade_test_user_to_premium(user)

        # Create a Reply record matching the s3_stored_replies headers
        lookup_key, encryption_key = derive_reply_keys(
            get_message_id_bytes("CA+J4FJFw0TXCr63y9dGcauvCGaZ7pXxspzOjEDhRpg5Zh4ziWg")
        )
        metadata = {
            "message-id": str(uuid4()),
            "from": "sender@external.example.com",
        }
        encrypted_metadata = encrypt_reply_metadata(encryption_key, metadata)
        relay_address = baker.make(RelayAddress, user=user, address="a1b2c3d4")
        Reply.objects.create(
            lookup=b64_lookup_key(lookup_key),
            encrypted_metadata=encrypted_metadata,
            relay_address=relay_address,
        )

        # Mock loading a simple reply email message from S3
        mock_get_content.return_value = ("this is a text reply", None, [], None)

        # Successfully reply to a previous sender
        # Headers are the same before and after the resender change
        with override_flag(RESENDER_HEADERS_FLAG_NAME, active=resender_headers):
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        assert response.status_code == 200

        self.mock_remove_message_from_s3.assert_called_once()
        mock_get_content.assert_called_once()

        sender, recipient, headers = self.get_details_from_mock_send_raw_email()
        assert sender == "a1b2c3d4@test.com"
        assert recipient == "sender@external.example.com"
        assert headers == {
            "Content-Type": headers["Content-Type"],
            "Subject": "Re: Test Mozilla User New Domain Address",
            "MIME-Version": "1.0",
            "From": sender,
            "Reply-To": sender,
            "To": recipient,
        }

        relay_address.refresh_from_db()
        assert relay_address.num_replied == 1
        last_used_at = relay_address.last_used_at
        assert last_used_at
        assert (datetime.now(tz=timezone.utc) - last_used_at).seconds < 2.0

    def test_reply_resender_headers(self) -> None:
        self.test_reply(resender_headers=True)


class BounceHandlingTest(TestCase):
    def setUp(self):
        self.user = baker.make(User, email="relayuser@test.com")

    def test_sns_message_with_hard_bounce(self):
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES["hard"])

        self.user.refresh_from_db()
        assert self.user.profile.last_hard_bounce >= pre_request_datetime

    def test_sns_message_with_soft_bounce(self):
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES["soft"])

        self.user.refresh_from_db()
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

    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._handle_reply")
    def test_reply_email_in_s3_deleted(
        self, mocked_handle_reply, mocked_message_removed
    ):
        expected_status_code = 200
        mocked_handle_reply.return_value = HttpResponse(
            "Email Relayed", status=expected_status_code
        )

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mocked_handle_reply.assert_called_once()
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == expected_status_code

    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._handle_reply")
    def test_reply_email_not_in_s3_deleted_ignored(
        self, mocked_handle_reply, mocked_message_removed
    ):
        expected_status_code = 200
        mocked_handle_reply.return_value = HttpResponse(
            "Email Relayed", status=expected_status_code
        )

        response = _sns_notification(EMAIL_SNS_BODIES["replies"])
        mocked_handle_reply.assert_called_once()
        mocked_message_removed.assert_called_once_with(None, None)
        assert response.status_code == expected_status_code

    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._handle_reply")
    def test_reply_email_in_s3_ses_client_error_not_deleted(
        self, mocked_handle_reply, mocked_message_removed
    ):
        # SES Client Error caught in _handle_reply responds with 503
        expected_status_code = 503
        mocked_handle_reply.return_value = HttpResponse(
            "SES Client Error", status=expected_status_code
        )

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mocked_handle_reply.assert_called_once()
        mocked_message_removed.assert_not_called()
        assert response.status_code == expected_status_code

    @patch("emails.views.remove_message_from_s3")
    def test_address_does_not_exist_email_not_in_s3_deleted_ignored(
        self, mocked_message_removed
    ):
        response = _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])
        mocked_message_removed.assert_called_once_with(None, None)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    @patch("emails.views.remove_message_from_s3")
    def test_address_does_not_exist_email_in_s3_deleted(self, mocked_message_removed):
        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    @patch("emails.views.remove_message_from_s3")
    def test_bounce_notification_not_in_s3_deleted_ignored(
        self, mocked_message_removed
    ):
        response = _sns_notification(BOUNCE_SNS_BODIES["soft"])
        mocked_message_removed.assert_called_once_with(None, None)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    @patch("emails.views.remove_message_from_s3")
    def test_email_without_commonheaders_in_s3_deleted(self, mocked_message_removed):
        message_wo_commonheaders = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "commonHeaders", "invalidHeaders"
        )
        notification_wo_commonheaders = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_wo_commonheaders["Message"] = message_wo_commonheaders
        response = _sns_notification(notification_wo_commonheaders)
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400
        assert response.content == b"Received SNS notification without commonHeaders."

    @patch("emails.views.remove_message_from_s3")
    def test_email_to_non_relay_domain_in_s3_deleted(self, mocked_message_removed):
        message_w_non_relay_as_recipient = EMAIL_SNS_BODIES["s3_stored"][
            "Message"
        ].replace("sender@test.com", "to@not-relay.com")
        notification_w_non_relay_domain = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_non_relay_domain["Message"] = message_w_non_relay_as_recipient
        response = _sns_notification(notification_w_non_relay_domain)
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 404
        assert response.content == b"Address does not exist"

    @patch("emails.views.remove_message_from_s3")
    def test_malformed_to_field_email_in_s3_deleted(self, mocked_message_removed):
        message_w_malformed_to_field = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "sender@test.com", "not-relay-test.com"
        )
        notification_w_malformed_to_field = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_malformed_to_field["Message"] = message_w_malformed_to_field
        response = _sns_notification(notification_w_malformed_to_field)
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400
        assert response.content == b"Malformed to field."

    @patch("emails.views.remove_message_from_s3")
    def test_noreply_email_in_s3_deleted(self, mocked_message_removed):
        message_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "sender@test.com", "noreply@default.com"
        )
        notification_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_email_to_noreply["Message"] = message_w_email_to_noreply
        response = _sns_notification(notification_w_email_to_noreply)
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"noreply address is not supported."

    @patch("emails.views.remove_message_from_s3")
    def test_noreply_mixed_case_email_in_s3_deleted(self, mocked_message_removed):
        message_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            "sender@test.com", "NoReply@default.com"
        )
        notification_w_email_to_noreply = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_email_to_noreply["Message"] = message_w_email_to_noreply
        response = _sns_notification(notification_w_email_to_noreply)
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"noreply address is not supported."

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._get_keys_from_headers")
    def test_noreply_headers_reply_email_in_s3_deleted(
        self, mocked_get_keys, mocked_message_removed
    ):
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
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 400

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views.remove_message_from_s3")
    def test_no_header_reply_email_not_in_s3_deleted_ignored(
        self, mocked_message_removed
    ):
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
        mocked_message_removed.assert_called_once_with(None, None)
        assert response.status_code == 400

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._get_reply_record_from_lookup_key")
    def test_no_reply_record_reply_email_in_s3_deleted(
        self, mocked_get_record, mocked_message_removed
    ):
        """If no DB match for In-Reply-To header, delete email, return 404."""
        mocked_get_record.side_effect = Reply.DoesNotExist()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["s3_stored_replies"])
        mm.assert_incr_once(
            "fx.private.relay.reply_email_header_error", tags=["detail:no-reply-record"]
        )
        mocked_get_record.assert_called_once()
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 404

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._get_keys_from_headers")
    @patch("emails.views._get_reply_record_from_lookup_key")
    def test_no_reply_record_reply_email_not_in_s3_deleted_ignored(
        self, mocked_get_record, mocked_get_keys, mocked_message_removed
    ):
        """If no DB match for In-Reply-To header, return 404."""
        mocked_get_keys.return_value = ("lookup", "encryption")
        mocked_get_record.side_effect = Reply.DoesNotExist()

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["replies"])
        mm.assert_incr_once(
            "fx.private.relay.reply_email_header_error", tags=["detail:no-reply-record"]
        )
        mocked_get_record.assert_called_once()
        mocked_message_removed.assert_called_once_with(None, None)
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

    @patch("emails.views.remove_message_from_s3")
    def test_auto_block_spam_true_email_in_s3_deleted(self, mocked_message_removed):
        self.profile.auto_block_spam = True
        self.profile.save()
        message_spamverdict_failed = EMAIL_SNS_BODIES["s3_stored"]["Message"].replace(
            '"spamVerdict":{"status":"PASS"}', '"spamVerdict":{"status":"FAIL"}'
        )
        notification_w_spamverdict_failed = EMAIL_SNS_BODIES["s3_stored"].copy()
        notification_w_spamverdict_failed["Message"] = message_spamverdict_failed

        response = _sns_notification(notification_w_spamverdict_failed)
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address rejects spam."

    @patch("emails.views.remove_message_from_s3")
    def test_user_bounce_paused_email_in_s3_deleted(self, mocked_message_removed):
        self.profile.last_soft_bounce = datetime.now(timezone.utc)
        self.profile.save()

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."

    @patch("emails.views._reply_allowed")
    @patch("emails.views._get_reply_record_from_lookup_key")
    @patch("emails.views.remove_message_from_s3")
    def test_reply_not_allowed_email_in_s3_deleted(
        self,
        mocked_message_removed,
        mocked_reply_record,
        mocked_reply_allowed,
    ):
        # external user sending a reply to Relay user
        # where the replies were being exchanged but now the user
        # no longer has the premium subscription
        mocked_reply_allowed.return_value = False

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 403
        assert response.content == b"Relay replies require a premium account"

    @patch("emails.views.remove_message_from_s3")
    def test_relay_address_disabled_email_in_s3_deleted(self, mocked_message_removed):
        self.address.enabled = False
        self.address.save()

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is temporarily disabled."

    @patch("emails.views._check_email_from_list")
    @patch("emails.views.remove_message_from_s3")
    def test_blocked_list_email_in_s3_deleted(
        self, mocked_message_removed, mocked_email_is_from_list
    ):
        upgrade_test_user_to_premium(self.user)
        self.address.block_list_emails = True
        self.address.save()
        mocked_email_is_from_list.return_value = True

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Address is not accepting list emails."

    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_get_text_html_s3_client_error_email_in_s3_not_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
    ):
        mocked_get_text_html.side_effect = ClientError(
            {"Error": {"error": "message"}}, ""
        )

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"Cannot fetch the message content from S3"

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_ses_client_error_email_in_s3_not_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
        mocked_ses_client,
    ):
        mocked_get_text_html.return_value = ("text_content", None, [], 50)
        mocked_ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"SES client error on Raw Email"

    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_successful_email_in_s3_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
        mocked_ses_client,
    ):
        mocked_get_text_html.return_value = ("text_content", None, [], 50)
        mocked_ses_client.send_raw_email.return_value = {"MessageId": "NICE"}

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Sent email to final recipient."

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.apps.EmailsConfig.ses_client", spec_set=["send_raw_email"])
    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_dmarc_failure_s3_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
        mocked_ses_client,
    ):
        """A message with a failing DMARC and a "reject" policy is rejected."""
        mocked_get_text_html.return_value.side_effect = FAIL_TEST_IF_CALLED
        mocked_ses_client.send_raw_email.side_effect = FAIL_TEST_IF_CALLED

        with MetricsMock() as mm:
            response = _sns_notification(EMAIL_SNS_BODIES["dmarc_failed"])
        mocked_message_removed.called_once_with(self.bucket, self.key)
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
        baker.make(RelayAddress, user=user, address="sender", domain=2)

        get_text_html_attachments_patcher = patch(
            "emails.views._get_text_html_attachments",
            return_value=("text", "html", [], 50),
        )
        get_text_html_attachments_patcher.start()
        self.addCleanup(get_text_html_attachments_patcher.stop)

        ses_client_patcher = patch(
            "emails.apps.EmailsConfig.ses_client",
            spec_set=["send_raw_email"],
        )
        self.mock_ses_client = ses_client_patcher.start()
        self.addCleanup(ses_client_patcher.stop)

    def test_ses_send_raw_email_has_client_error_early_exits(self):
        self.mock_ses_client.send_raw_email.side_effect = SEND_RAW_EMAIL_FAILED
        response = _sns_message(self.message_json)
        self.mock_ses_client.send_raw_email.assert_called_once()
        assert response.status_code == 503

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


class GetAttachmentTests(TestCase):
    def setUp(self):
        # Binary string of 10 chars * 16,000 = 160,000 byte string, longer than
        # 150k max size of SpooledTemporaryFile, so it is written to disk
        self.long_data = b"0123456789" * 16_000

    def create_message(self, data, mimetype, filename):
        """Create an EmailMessage with an attachment."""
        message = EmailMessage()
        message["Subject"] = "A Test Message"
        message["From"] = "test sender <sender@example.com>"
        message["To"] = "test receiver <receiver@example.com>"
        message.preamble = "This email has attachments.\n"

        assert isinstance(data, bytes)
        maintype, subtype = mimetype.split("/", 1)
        assert maintype
        assert subtype
        message.add_attachment(
            data, maintype=maintype, subtype=subtype, filename=filename
        )
        return message

    def get_name_and_stream(self, message):
        """Get the first attachment's filename and data stream from a message."""
        for part in message.walk():
            if part.is_attachment():
                name, stream = _get_attachment(part)
                self.addCleanup(stream.close)
                return name, stream
        return None, None

    def test_short_attachment(self):
        """A short attachment is stored in memory"""
        message = self.create_message(b"A short attachment", "text/plain", "short.txt")
        name, stream = self.get_name_and_stream(message)
        assert name == "short.txt"
        assert isinstance(stream._file, io.BytesIO)

    def test_long_attachment(self):
        """A long attachment is stored on disk"""
        message = self.create_message(
            self.long_data, "application/octet-stream", "long.txt"
        )
        name, stream = self.get_name_and_stream(message)
        assert name == "long.txt"
        assert isinstance(stream._file, io.BufferedRandom)

    def test_attachment_unicode_filename(self):
        """A unicode filename can be stored on disk"""
        filename = "Some Binary data 😀.bin"
        message = self.create_message(
            self.long_data, "application/octet-stream", filename
        )
        name, stream = self.get_name_and_stream(message)
        assert name == filename
        assert isinstance(stream._file, io.BufferedRandom)

    def test_attachment_url_filename(self):
        """A URL filename can be stored on disk"""
        filename = "https://example.com/data.bin"
        message = self.create_message(
            self.long_data, "application/octet-stream", filename
        )
        name, stream = self.get_name_and_stream(message)
        assert name == filename
        assert isinstance(stream._file, io.BufferedRandom)

    def test_attachment_no_filename(self):
        """An attachment without a filename can be stored on disk"""
        message = self.create_message(self.long_data, "application/octet-stream", None)
        name, stream = self.get_name_and_stream(message)
        assert name is None
        assert isinstance(stream._file, io.BufferedRandom)


TEST_AWS_SNS_TOPIC = "arn:aws:sns:us-east-1:111222333:relay"
TEST_AWS_SNS_TOPIC2 = TEST_AWS_SNS_TOPIC + "-alt"


@override_settings(AWS_SNS_TOPIC={TEST_AWS_SNS_TOPIC, TEST_AWS_SNS_TOPIC2})
class ValidateSnsArnTypeTests(SimpleTestCase):
    def test_valid_arn_and_type(self):
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC, "SubscriptionConfirmation")
        assert ret is None

    def test_no_topic_arn(self):
        ret = validate_sns_arn_and_type(None, "Notification")
        assert ret == {
            "error": "Received SNS request without Topic ARN.",
            "received_topic_arn": "''",
            "supported_topic_arn": [TEST_AWS_SNS_TOPIC, TEST_AWS_SNS_TOPIC2],
            "received_sns_type": "Notification",
            "supported_sns_types": ["SubscriptionConfirmation", "Notification"],
        }

    def test_wrong_topic_arn(self):
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC + "-new", "Notification")
        assert ret["error"] == "Received SNS message for wrong topic."

    def test_no_message_type(self):
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC2, None)
        assert ret["error"] == "Received SNS request without Message Type."

    def test_unsupported_message_type(self):
        ret = validate_sns_arn_and_type(TEST_AWS_SNS_TOPIC, "UnsubscribeConfirmation")
        assert ret["error"] == "Received SNS message for unsupported Type."


@override_settings(AWS_SNS_TOPIC={EMAIL_SNS_BODIES["s3_stored"]["TopicArn"]})
class SnsInboundViewSimpleTests(SimpleTestCase):
    """Tests for /emails/sns_inbound that do not require database access."""

    def setUp(self):
        self.valid_message = EMAIL_SNS_BODIES["s3_stored"]
        self.client = Client(
            HTTP_X_AMZ_SNS_TOPIC_ARN=self.valid_message["TopicArn"],
            HTTP_X_AMZ_SNS_MESSAGE_TYPE=self.valid_message["Type"],
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
            HTTP_X_AMZ_SNS_TOPIC_ARN=None,
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
            HTTP_X_AMZ_SNS_TOPIC_ARN="wrong_arn",
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
            HTTP_X_AMZ_SNS_MESSAGE_TYPE=None,
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
            HTTP_X_AMZ_SNS_MESSAGE_TYPE="UnsubscribeConfirmation",
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
    relay_address = baker.make(RelayAddress, user=free_user)

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
    test_from = relay_address.address
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
    assert msg["To"] == relay_address.address

    multipart_payload = msg.get_payload()[0]
    first_part = multipart_payload.get_payload()[0]
    second_part = multipart_payload.get_payload()[1]
    text_content = b64decode(first_part.get_payload()).decode()
    html_content = b64decode(second_part.get_payload()).decode()
    assert "sent this reply" in text_content
    assert "sent this reply" in html_content


@pytest.mark.django_db
def test_build_reply_requires_premium_email_after_forward():
    # First create a valid reply record from an external sender to a free Relay user
    free_user = make_free_test_user()
    relay_address = baker.make(RelayAddress, user=free_user)
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
    test_from = relay_address.address
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
    assert msg["To"] == relay_address.address

    multipart_payload = msg.get_payload()[0]
    first_part = multipart_payload.get_payload()[0]
    second_part = multipart_payload.get_payload()[1]
    text_content = b64decode(first_part.get_payload()).decode()
    html_content = b64decode(second_part.get_payload()).decode()
    assert "Your reply was not sent" in text_content
    assert "Your reply was not sent" in html_content


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
