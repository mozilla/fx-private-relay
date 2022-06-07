from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any
from unittest.mock import patch, Mock
import glob
import io
import json
import logging
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

from emails.models import (
    address_hash,
    DeletedAddress,
    DomainAddress,
    Profile,
    RelayAddress,
    Reply,
)
from emails.ses import ComplaintNotification
from emails.views import (
    _get_address,
    _get_attachment,
    _record_receipt_verdicts,
    _sns_message,
    _sns_notification,
    validate_sns_header,
    wrapped_email_test,
    InReplyToNotFound,
)

from .models_tests import make_premium_test_user, upgrade_test_user_to_premium

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


class SNSNotificationTest(TestCase):
    def setUp(self):
        # FIXME: this should make an object so that the test passes
        self.user = baker.make(User)
        self.profile = self.user.profile_set.first()
        self.sa = baker.make(SocialAccount, user=self.user, provider="fxa")
        self.ra = baker.make(
            RelayAddress, user=self.user, address="ebsbdsan7", domain=2
        )
        self.premium_user = make_premium_test_user()
        self.premium_profile = Profile.objects.get(user=self.premium_user)
        self.premium_profile.subdomain = "subdomain"
        self.premium_profile.save()

        self.patcher = patch("emails.views.remove_message_from_s3")
        self.mock_remove_message_from_s3 = self.patcher.start()
        self.addCleanup(self.patcher.stop)

    @patch("emails.views.ses_relay_email")
    def test_single_recipient_sns_notification(self, mock_ses_relay_email):
        mock_ses_relay_email.return_value = HttpResponse(
            "Successfully relayed emails", status=200
        )
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        mock_ses_relay_email.assert_called_once()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at.date() == datetime.today().date()

    @patch("emails.views.ses_relay_email")
    def test_list_email_sns_notification(self, mock_ses_relay_email):
        mock_ses_relay_email.return_value = HttpResponse(
            "Successfully relayed emails", status=200
        )
        # by default, list emails should still forward
        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        mock_ses_relay_email.assert_called_once()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at.date() == datetime.today().date()

    @patch("emails.views.ses_relay_email")
    def test_block_list_email_sns_notification(self, mock_ses_relay_email):
        # when an alias is blocking list emails, list emails should not forward
        self.ra.user = self.premium_user
        self.ra.save()
        self.ra.block_list_emails = True
        self.ra.save()

        _sns_notification(EMAIL_SNS_BODIES["single_recipient_list"])

        mock_ses_relay_email.assert_not_called()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0
        assert self.ra.num_blocked == 1

    @patch("emails.views.ses_relay_email")
    def test_spamVerdict_FAIL_default_still_relays(self, mock_ses_relay_email):
        mock_ses_relay_email.return_value = HttpResponse(
            "Successfully relayed emails", status=200
        )
        # for a default user, spam email will still relay
        _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])

        mock_ses_relay_email.assert_called_once()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1

    @patch("emails.views.ses_relay_email")
    def test_spamVerdict_FAIL_auto_block_doesnt_relay(self, mock_ses_relay_email):
        # when user has auto_block_spam=True, spam will not relay
        self.profile.auto_block_spam = True
        self.profile.save()

        _sns_notification(EMAIL_SNS_BODIES["spamVerdict_FAIL"])

        mock_ses_relay_email.assert_not_called()
        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 0

    @patch("emails.views.ses_relay_email")
    def test_domain_recipient(self, mock_ses_relay_email):
        mock_ses_relay_email.return_value = HttpResponse(
            "Successfully relayed emails", status=200
        )
        _sns_notification(EMAIL_SNS_BODIES["domain_recipient"])

        mock_ses_relay_email.assert_called_once()
        da = DomainAddress.objects.get(user=self.premium_user, address="wildcard")
        assert da.num_forwarded == 1
        assert da.last_used_at.date() == datetime.today().date()

    @patch("emails.views.ses_relay_email")
    def test_successful_email_relay_message_removed_from_s3(self, mock_ses_relay_email):
        mock_ses_relay_email.return_value = HttpResponse("Relayed email", status=200)
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        mock_ses_relay_email.assert_called_once()
        self.mock_remove_message_from_s3.assert_called_once()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at.date() == datetime.today().date()

    @patch("emails.views.ses_relay_email")
    def test_unsuccessful_email_relay_message_not_removed_from_s3(
        self, mock_ses_relay_email
    ):
        mock_ses_relay_email.return_value = HttpResponse(
            "Failed to relay email", status=500
        )
        _sns_notification(EMAIL_SNS_BODIES["single_recipient"])

        mock_ses_relay_email.assert_called_once()
        self.mock_remove_message_from_s3.assert_not_called()

        self.ra.refresh_from_db()
        assert self.ra.num_forwarded == 1
        assert self.ra.last_used_at.date() == datetime.today().date()


class BounceHandlingTest(TestCase):
    def setUp(self):
        self.user = baker.make(User, email="relayuser@test.com", make_m2m=True)

    def test_sns_message_with_hard_bounce(self):
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES["hard"])

        profile = self.user.profile_set.first()
        assert profile.last_hard_bounce >= pre_request_datetime

    def test_sns_message_with_soft_bounce(self):
        pre_request_datetime = datetime.now(timezone.utc)

        _sns_notification(BOUNCE_SNS_BODIES["soft"])

        profile = self.user.profile_set.first()
        assert profile.last_soft_bounce >= pre_request_datetime

    def test_sns_message_with_spam_bounce_sets_auto_block_spam(self):
        _sns_notification(BOUNCE_SNS_BODIES["spam"])
        profile = self.user.profile_set.first()
        assert profile.auto_block_spam == True


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

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views.remove_message_from_s3")
    @patch("emails.views._get_keys_from_headers")
    def test_no_header_reply_email_in_s3_deleted(
        self, mocked_get_keys, mocked_message_removed
    ):
        """If replies@... email has no "In-Reply-To" header, delete email, return 400."""
        mocked_get_keys.side_effect = InReplyToNotFound()

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


class SNSNotificationValidUserEmailsInS3Test(TestCase):
    def setUp(self) -> None:
        self.bucket = "test-bucket"
        self.key = "/emails/objectkey123"
        self.user = baker.make(User, email="sender@test.com", make_m2m=True)
        self.profile = self.user.profile_set.first()
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
    def test_get_text_hteml_s3_client_error_email_in_s3_not_deleted(
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

    @patch("emails.views.ses_relay_email")
    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_ses_client_error_email_in_s3_not_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
        mocked_relay_email,
    ):
        mocked_get_text_html.return_value = ("text_content", None, ["attachments"])
        mocked_relay_email.return_value = HttpResponse("SES client failed", status=503)

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.assert_not_called()
        assert response.status_code == 503
        assert response.content == b"SES client failed"

    @patch("emails.views.ses_relay_email")
    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_successful_email_in_s3_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
        mocked_relay_email,
    ):
        mocked_get_text_html.return_value = ("text_content", None, ["attachments"])
        mocked_relay_email.return_value = HttpResponse("Email relayed", status=200)

        response = _sns_notification(EMAIL_SNS_BODIES["s3_stored"])
        mocked_message_removed.called_once_with(self.bucket, self.key)
        assert response.status_code == 200
        assert response.content == b"Email relayed"

    @override_settings(STATSD_ENABLED=True)
    @patch("emails.views.ses_relay_email")
    @patch("emails.views._get_text_html_attachments")
    @patch("emails.views.remove_message_from_s3")
    def test_dmarc_failure_s3_deleted(
        self,
        mocked_message_removed,
        mocked_get_text_html,
        mocked_relay_email,
    ):
        """A message with a failing DMARC and a "reject" policy is rejected."""
        mocked_get_text_html.return_value = ("text_content", None, ["attachments"])
        mocked_relay_email.side_effect = FAIL_TEST_IF_CALLED

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
        self.user = baker.make(User)
        self.profile = self.user.profile_set.first()
        assert self.profile is not None
        self.sa: SocialAccount = baker.make(
            SocialAccount, user=self.user, provider="fxa"
        )
        # test.com is the second domain listed and has the numerical value 2
        self.address = baker.make(
            RelayAddress, user=self.user, address="sender", domain=2
        )

        self.bucket = "test-bucket"
        self.key = "/emails/objectkey123"

        patcher = patch(
            "emails.views._get_text_html_attachments",
            return_value=("text", "html", "attachments"),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    @patch("emails.views.ses_relay_email")
    def test_ses_relay_email_has_client_error_early_exits(self, mocked_ses_relay_email):
        message_json = json.loads(EMAIL_SNS_BODIES["s3_stored"]["Message"])
        mocked_ses_relay_email.return_value = HttpResponse(status=503)

        response = _sns_message(message_json)
        mocked_ses_relay_email.assert_called_once()
        assert response.status_code == 503

    @patch("emails.views.ses_relay_email")
    def test_ses_relay_email_email_relayed_email_deleted_from_s3(
        self, mocked_ses_relay_email
    ):
        message_json = json.loads(EMAIL_SNS_BODIES["s3_stored"]["Message"])
        mocked_ses_relay_email.return_value = HttpResponse(status=200)

        response = _sns_message(message_json)
        mocked_ses_relay_email.assert_called_once()
        assert response.status_code == 200


@override_settings(SITE_ORIGIN="https://test.com", RELAY_CHANNEL="test")
class GetAddressTest(TestCase):
    def setUp(self):
        self.service_domain = "test.com"
        self.local_portion = "foo"

    @patch("emails.views._get_domain_address")
    def test_get_address_with_domain_address(self, _get_domain_address_mocked):
        expected = "DomainAddress"
        _get_domain_address_mocked.return_value = expected
        # email_domain_mocked.return_value = service_domain

        actual = _get_address(
            to_address=f"{self.local_portion}@subdomain.{self.service_domain}",
            local_portion=self.local_portion,
            domain_portion=f"subdomain.{self.service_domain}",
        )
        assert actual == expected

    def test_get_address_with_relay_address(self):
        local_portion = "foo"
        relay_address = baker.make(RelayAddress, address=local_portion)

        actual = _get_address(
            to_address=f"{self.local_portion}@{self.service_domain}",
            local_portion=f"{self.local_portion}",
            domain_portion=f"{self.service_domain}",
        )
        assert actual == relay_address

    @patch("emails.views.incr_if_enabled")
    def test_get_address_with_deleted_relay_address(self, incr_mocked):
        hashed_address = address_hash(self.local_portion, domain=self.service_domain)
        baker.make(DeletedAddress, address_hash=hashed_address)

        try:
            _get_address(
                to_address=f"{self.local_portion}@{self.service_domain}",
                local_portion=self.local_portion,
                domain_portion=self.service_domain,
            )
        except Exception as e:
            assert e.args[0] == "RelayAddress matching query does not exist."
            incr_mocked.assert_called_once_with("email_for_deleted_address", 1)

    @patch("emails.views.incr_if_enabled")
    @patch("emails.views.logger")
    def test_get_address_with_relay_address_does_not_exist(
        self, logging_mocked, incr_mocked
    ):
        try:
            _get_address(
                to_address=f"{self.local_portion}@{self.service_domain}",
                local_portion={self.local_portion},
                domain_portion=f"{self.service_domain}",
            )
        except Exception as e:
            assert e.args[0] == "RelayAddress matching query does not exist."
            incr_mocked.assert_called_once_with("email_for_unknown_address", 1)

    @patch("emails.views.incr_if_enabled")
    def test_get_address_with_deleted_relay_address_multiple(self, incr_mocked):
        hashed_address = address_hash(self.local_portion, domain=self.service_domain)
        baker.make(DeletedAddress, address_hash=hashed_address)
        baker.make(DeletedAddress, address_hash=hashed_address)

        try:
            _get_address(
                to_address=f"{self.local_portion}@{self.service_domain}",
                local_portion=self.local_portion,
                domain_portion=f"{self.service_domain}",
            )
        except Exception as e:
            assert e.args[0] == "RelayAddress matching query does not exist."
            incr_mocked.assert_called_once_with("email_for_deleted_address_multiple", 1)


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
class ValidateSnsHeaderTests(SimpleTestCase):
    def test_valid_headers(self):
        ret = validate_sns_header(TEST_AWS_SNS_TOPIC, "SubscriptionConfirmation")
        assert ret is None

    def test_no_topic_arn(self):
        ret = validate_sns_header(None, "Notification")
        assert ret == {
            "error": "Received SNS request without Topic ARN.",
            "received_topic_arn": "''",
            "supported_topic_arn": [TEST_AWS_SNS_TOPIC, TEST_AWS_SNS_TOPIC2],
            "received_sns_type": "Notification",
            "supported_sns_types": ["SubscriptionConfirmation", "Notification"],
        }

    def test_wrong_topic_arn(self):
        ret = validate_sns_header(TEST_AWS_SNS_TOPIC + "-new", "Notification")
        assert ret["error"] == "Received SNS message for wrong topic."

    def test_no_message_type(self):
        ret = validate_sns_header(TEST_AWS_SNS_TOPIC2, None)
        assert ret["error"] == "Received SNS request without Message Type."

    def test_unsupported_message_type(self):
        ret = validate_sns_header(TEST_AWS_SNS_TOPIC, "UnsubscribeConfirmation")
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

    def test_no_topic_arn_header(self):
        self.mock_verify_from_sns.side_effect = FAIL_TEST_IF_CALLED
        ret = self.client.post(
            self.url,
            data=self.valid_message,
            content_type="application/json",
            HTTP_X_AMZ_SNS_TOPIC_ARN=None,
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS request without Topic ARN."

    def test_wrong_topic_arn_header(self):
        self.mock_verify_from_sns.side_effect = FAIL_TEST_IF_CALLED
        ret = self.client.post(
            self.url,
            data=self.valid_message,
            content_type="application/json",
            HTTP_X_AMZ_SNS_TOPIC_ARN="wrong_arn",
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS message for wrong topic."

    def test_no_message_type_header(self):
        self.mock_verify_from_sns.side_effect = FAIL_TEST_IF_CALLED
        ret = self.client.post(
            self.url,
            data=self.valid_message,
            content_type="application/json",
            HTTP_X_AMZ_SNS_MESSAGE_TYPE=None,
        )
        assert ret.status_code == 400
        assert ret.content == b"Received SNS request without Message Type."

    def test_unsupported_message_type_header(self):
        self.mock_verify_from_sns.side_effect = FAIL_TEST_IF_CALLED
        ret = self.client.post(
            self.url,
            data=self.valid_message,
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
    assert "<dt>language</dt><dd>de</dd>" in no_space_html
    assert "<dt>has_premium</dt><dd>No</dd>" in no_space_html
    assert "<dt>in_premium_country</dt><dd>Yes</dd>" in no_space_html
    assert "<dt>has_attachment</dt><dd>Yes</dd>" in no_space_html
    assert "<dt>has_tracker_report_link</dt><dd>No</dd>" in no_space_html
    assert (
        "<dt>has_num_level_one_email_trackers_removed</dt><dd>No</dd>" in no_space_html
    )


@pytest.mark.parametrize("language", ("en", "fy-NL", "ja"))
@pytest.mark.parametrize("has_premium", ("Yes", "No"))
@pytest.mark.parametrize("in_premium_country", ("Yes", "No"))
@pytest.mark.parametrize("has_attachment", ("Yes", "No"))
@pytest.mark.parametrize("has_tracker_report_link", ("Yes", "No"))
@pytest.mark.parametrize("num_level_one_email_trackers_removed", ("1", "0"))
def test_wrapped_email_test(
    rf,
    language,
    has_premium,
    in_premium_country,
    has_attachment,
    has_tracker_report_link,
    num_level_one_email_trackers_removed,
):
    data = {
        "language": language,
        "has_premium": has_premium,
        "in_premium_country": in_premium_country,
        "has_attachment": has_attachment,
        "has_tracker_report_link": has_tracker_report_link,
        "num_level_one_email_trackers_removed": num_level_one_email_trackers_removed,
    }
    request = rf.get("/emails/wrapped_email_test", data=data)
    response = wrapped_email_test(request)
    assert response.status_code == 200
    no_space_html = re.sub(r"\s+", "", response.content.decode())
    assert f"<dt>language</dt><dd>{language}</dd>" in no_space_html
    assert f"<dt>has_premium</dt><dd>{has_premium}</dd>" in no_space_html
    assert (
        f"<dt>in_premium_country</dt><dd>{in_premium_country}</dd>"
    ) in no_space_html
    assert f"<dt>has_attachment</dt><dd>{has_attachment}</dd>" in no_space_html
    assert f"<dt>has_attachment</dt><dd>{has_attachment}</dd>" in no_space_html
    assert (
        "<dt>has_tracker_report_link</dt>" f"<dd>{has_tracker_report_link}</dd>"
    ) in no_space_html
    has_num_level_one_email_trackers_removed = (
        "Yes" if int(num_level_one_email_trackers_removed) else "No"
    )
    assert (
        f"<dt>has_num_level_one_email_trackers_removed</dt><dd>{has_num_level_one_email_trackers_removed}</dd>"
    ) in no_space_html


def _base_complaint() -> dict[str, Any]:
    """Return a Complaint object"""
    return {
        "notificationType": "Complaint",
        "complaint": {
            "feedbackId": "010001810261be75-1a423a20-9d2f-4dcd-83a3-3193deec7c05-000000",
            "complaintSubType": None,
            "complainedRecipients": [
                {"emailAddress": "complaint@simulator.amazonses.com"}
            ],
            "timestamp": "2022-05-26T21:59:29.000Z",
            "userAgent": "Amazon SES Mailbox Simulator",
            "complaintFeedbackType": "abuse",
            "arrivalDate": "2022-05-26T21:59:29.288Z",
        },
        "mail": {
            "timestamp": "2022-05-26T21:59:28.484Z",
            "source": "sender@relay.example.com",
            "sourceArn": "arn:aws:ses:us-east-1:111122223333:identity/relay.example.com",
            "sourceIp": "130.211.19.131",
            "callerIdentity": "test-relay",
            "sendingAccountId": "111122223333",
            "messageId": "010001810261bbe4-48c395ab-8280-4e9f-83c7-3424d43d77f1-000000",
            "destination": ["complaint@simulator.amazonses.com"],
        },
    }


def test_sns_notifications_complaint(caplog) -> None:
    """_sns_notifications can handle an SNS complaint."""
    complaint = _base_complaint()
    sns_wrapper = {
        "Type": "Notification",
        "Message": json.dumps(complaint),
    }
    response = _sns_notification(sns_wrapper)
    assert response.status_code == 200
    assert caplog.record_tuples == [("eventsinfo", logging.INFO, "Complaint received.")]
    record = caplog.records[0]
    assert record.complaint_type == "abuse"
    assert record.sender == "sender@relay.example.com"
    assert record.recipients == "complaint@simulator.amazonses.com"
    assert (
        record.message_id
        == "010001810261bbe4-48c395ab-8280-4e9f-83c7-3424d43d77f1-000000"
    )
    assert record.complaint_subtype == None
    assert (
        record.feedback_id
        == "010001810261be75-1a423a20-9d2f-4dcd-83a3-3193deec7c05-000000"
    )
    assert record.user_agent == "Amazon SES Mailbox Simulator"
    assert record.reply_to is None


def test_sns_notifications_complaint_with_headers(caplog):
    """_sns_notifications can handle an SNS complaint with headers."""
    complaint = _base_complaint()
    complaint["mail"]["headersTruncated"] = False
    complaint["mail"]["headers"] = [
        {"name": "From", "value": "sender@relay.example.com"},
        {"name": "To", "value": "complaint@simulator.amazonses.com"},
        {
            "name": "Message-ID",
            "value": "010001810261bbe4-48c395ab-8280-4e9f-83c7-3424d43d77f1-000000",
        },
        {"name": "Subject", "value": "Hello"},
        {"name": "Content-Type", "value": 'text/plain; charset="UTF-8"'},
        {"name": "Content-Transfer-Encoding", "value": "base64"},
        {"name": "Date", "value": "Thu, 26 May 2022 21:59:28 +0000"},
    ]
    complaint["mail"]["commonHeaders"] = {
        "from": ["sender@relay.example.com"],
        "date": "Thu, 26 May 2022 21:59:28 +0000",
        "to": ["complaint@simulator.amazonses.com"],
        "subject": "Test message",
        "replyTo": ["replies@relay.example.com"],
    }
    sns_wrapper = {
        "Type": "Notification",
        "Message": json.dumps(complaint),
    }
    response = _sns_notification(sns_wrapper)
    assert response.status_code == 200
    assert caplog.record_tuples == [("eventsinfo", logging.INFO, "Complaint received.")]
    record = caplog.records[0]
    assert record.reply_to == "replies@relay.example.com"


def test_sns_notifications_delivery_report(caplog) -> None:
    """_sns_notifications can handle an SNS delivery report."""
    delivery = {
        "notificationType": "Delivery",
        "delivery": {
            "timestamp": "2022-05-26T21:59:29.009Z",
            "processingTimeMillis": 525,
            "recipients": ["complaint@simulator.amazonses.com"],
            "smtpResponse": "250 2.6.0 Message received",
            "remoteMtaIp": "34.232.130.241",
            "reportingMTA": "a48-112.smtp-out.amazonses.com",
        },
        "mail": {
            "timestamp": "2022-05-26T21:59:28.484Z",
            "source": "sender@relay.example.com",
            "sourceArn": "arn:aws:ses:us-east-1:111122223333:identity/relay.example.com",
            "sourceIp": "130.211.19.131",
            "callerIdentity": "test-relay",
            "sendingAccountId": "111122223333",
            "messageId": "010001810261bbe4-48c395ab-8280-4e9f-83c7-3424d43d77f1-000000",
            "destination": ["complaint@simulator.amazonses.com"],
        },
    }
    sns_wrapper = {
        "Type": "Notification",
        "Message": json.dumps(delivery),
    }
    response = _sns_notification(sns_wrapper)
    assert response.status_code == 200
    assert caplog.record_tuples == [
        ("eventsinfo", logging.INFO, "Delivery report received.")
    ]
    record = caplog.records[0]
    assert record.recipients == "complaint@simulator.amazonses.com"
    assert record.reporting_mta == "a48-112.smtp-out.amazonses.com"
    assert record.smtp_response == "250 2.6.0 Message received"
    assert record.processing_time_s == 0.525
