from email.utils import parseaddr
from urllib.parse import quote_plus
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from unittest.mock import patch
from model_bakery import baker
from waffle.models import Flag
import json

from emails.models import get_domains_from_settings
from emails.utils import (
    NEW_FROM_ADDRESS_FLAG_NAME,
    generate_relay_From,
    get_email_domain_from_settings,
    remove_trackers,
)

from .models_tests import make_free_test_user, make_premium_test_user


class FormattingToolsTest(TestCase):
    def setUp(self):
        _, self.relay_from = parseaddr(settings.RELAY_FROM_ADDRESS)
        domain = get_domains_from_settings().get("RELAY_FIREFOX_DOMAIN")
        _, self.premium_from = parseaddr(f"replies@{domain}")

    def test_generate_relay_From_with_umlaut(self):
        original_from_address = '"foö bär" <foo@bar.com>'
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            "=?utf-8?b?IiJmb8O2IGLDpHIiIDxmb29AYmFyLmNvbT4gW3ZpYSBSZWxheV0i?="
        )
        expected_formatted_from = "%s %s" % (
            expected_encoded_display_name,
            "<%s>" % self.relay_from,
        )
        assert formatted_from_address == expected_formatted_from

    def test_generate_relay_From_with_realistic_address(self):
        original_from_address = "something real <somethingreal@protonmail.com>"
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            "=?utf-8?q?=22something_real_=3Csomethingreal=40protonmail=2Ecom"
            "=3E_=5Bvia_Relay=5D=22?="
        )
        expected_formatted_from = "%s %s" % (
            expected_encoded_display_name,
            "<%s>" % self.relay_from,
        )
        assert formatted_from_address == expected_formatted_from

    def test_generate_relay_From_with_rfc_2822_invalid_address(self):
        original_from_address = "l%sng <long@long.com>" % ("o" * 999)
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            "=?utf-8?q?=22l%s_=2E=2E=2E_=5Bvia_Relay=5D=22?=" % ("o" * 899)
        )
        expected_formatted_from = "%s %s" % (
            expected_encoded_display_name,
            "<%s>" % self.relay_from,
        )
        assert formatted_from_address == expected_formatted_from

    def test_generate_relay_From_with_linebreak_chars(self):
        original_from_address = '"Ter\ry \n ct\u2028" <info@a...t.org>'
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            "=?utf-8?b?IiJUZXJ5ICBjdCIgPGluZm9AYS4uLnQub3JnPiBbdmlhIFJlbGF5XSI" "=?="
        )
        expected_formatted_from = "%s %s" % (
            expected_encoded_display_name,
            "<%s>" % self.relay_from,
        )
        assert formatted_from_address == expected_formatted_from

    def test_generate_relay_From_with_premium_user(self):
        premium_user = make_premium_test_user()
        original_from_address = '"foo bar" <foo@bar.com>'
        formatted_from_address = generate_relay_From(
            original_from_address, premium_user.profile
        )

        expected_encoded_display_name = (
            "=?utf-8?b?IiJmb28gYmFyIiA8Zm9vQGJhci5jb20+IFt2aWEgUmVsYXldIg==?="
        )
        expected_formatted_from = "%s <%s>" % (
            expected_encoded_display_name,
            self.premium_from,
        )
        assert formatted_from_address == expected_formatted_from

    @override_settings(
        RELAY_FROM_ADDRESS="noreply@relaytests.com",
        NEW_RELAY_FROM_ADDRESS="new_from@relaytests.com",
    )
    def test_generate_relay_From_with_new_from_user(self):
        free_user = make_free_test_user()
        new_from_flag = Flag.objects.create(name=NEW_FROM_ADDRESS_FLAG_NAME)
        new_from_flag.users.add(free_user)
        original_from_address = '"foo bar" <foo@bar.com>'
        formatted_from_address = generate_relay_From(
            original_from_address, free_user.profile
        )
        expected_encoded_display_name = (
            "=?utf-8?b?IiJmb28gYmFyIiA8Zm9vQGJhci5jb20+IFt2aWEgUmVsYXldIg==?="
        )
        expected_formatted_from = "%s <%s>" % (
            expected_encoded_display_name,
            "new_from@relaytests.com",
        )
        assert formatted_from_address == expected_formatted_from
        # WTF? TestCase tearDown doesn't clear out this waffle flag?
        new_from_flag.users.remove(free_user)

    @override_settings(
        RELAY_FROM_ADDRESS="noreply@relaytests.com",
        NEW_RELAY_FROM_ADDRESS="new_from@relaytests.com",
    )
    def test_generate_relay_From_with_non_flagged_user(self):
        free_user = make_free_test_user()
        Flag.objects.create(name=NEW_FROM_ADDRESS_FLAG_NAME)
        original_from_address = '"foo bar" <foo@bar.com>'
        formatted_from_address = generate_relay_From(
            original_from_address, free_user.profile
        )
        expected_encoded_display_name = (
            "=?utf-8?b?IiJmb28gYmFyIiA8Zm9vQGJhci5jb20+IFt2aWEgUmVsYXldIg==?="
        )
        expected_formatted_from = "%s <%s>" % (
            expected_encoded_display_name,
            "noreply@relaytests.com",
        )
        assert formatted_from_address == expected_formatted_from

    @override_settings(
        RELAY_FROM_ADDRESS="noreply@relaytests.com",
        NEW_RELAY_FROM_ADDRESS="new_from@relaytests.com",
    )
    def test_generate_relay_From_with_no_user_profile_somehow(self):
        free_user = baker.make(User)
        Flag.objects.create(name=NEW_FROM_ADDRESS_FLAG_NAME)
        original_from_address = '"foo bar" <foo@bar.com>'
        formatted_from_address = generate_relay_From(
            original_from_address, free_user.profile
        )
        expected_encoded_display_name = (
            "=?utf-8?b?IiJmb28gYmFyIiA8Zm9vQGJhci5jb20+IFt2aWEgUmVsYXldIg==?="
        )
        expected_formatted_from = "%s <%s>" % (
            expected_encoded_display_name,
            "noreply@relaytests.com",
        )
        assert formatted_from_address == expected_formatted_from

    @override_settings(RELAY_CHANNEL="dev", SITE_ORIGIN="https://test.com")
    def test_get_email_domain_from_settings_on_dev(self):
        email_domain = get_email_domain_from_settings()
        assert "mail.test.com" == email_domain

    @override_settings(RELAY_CHANNEL="test", SITE_ORIGIN="https://test.com")
    def test_get_email_domain_from_settings_not_on_dev(self):
        email_domain = get_email_domain_from_settings()
        assert "test.com" == email_domain

    @override_settings(RELAY_FIREFOX_DOMAIN="firefox.com", MOZMAIL_DOMAIN="mozmail.com")
    def test_get_domains_from_settings(self):
        domains = get_domains_from_settings()
        assert domains == {
            "RELAY_FIREFOX_DOMAIN": "default.com",
            "MOZMAIL_DOMAIN": "test.com",
        }


@override_settings(SITE_ORIGIN="https://test.com")
class RemoveTrackers(TestCase):
    url = "https://test.com/contains-tracker-warning/#"
    hyperlink_simple = "https://open.tracker.com/foo/bar.html"
    imagelink_simple = "https://open.tracker.com/foo/bar.jpg"
    hyperlink_complex = "https://foo.open.tracker.com/foo/bar.html"
    imagelink_complex = "https://bar.open.tracker.com/foo/bar.jpg"
    hyperlink_tracker_in_tracker = (
        "https://foo.open.tracker.com/foo/bar.html?src=trckr.com"
    )
    from_address = "spammer@email.com"
    datetime_now = "1682472064"

    def url_trackerwarning_data(self, link):
        return quote_plus(
            json.dumps(
                {
                    "sender": "spammer@email.com",
                    "received_at": "1682472064",
                    "original_link": link,
                },
                separators=(",", ":"),
            )
        )

    def expected_content(self, hyperlink, imagelink):
        return (
            f'<a href="{self.url}{self.url_trackerwarning_data(hyperlink)}">'
            "A link</a>\n"
            f'<img src="{self.url}{self.url_trackerwarning_data(imagelink)}">'
            "An image</img>"
        )

    def setUp(self):
        self.patcher1 = patch(
            "emails.utils.general_trackers",
            return_value=["trckr.com", "open.tracker.com"],
        )
        self.patcher2 = patch(
            "emails.utils.strict_trackers", return_value=["strict.tracker.com"]
        )
        self.mock_general_trackers = self.patcher1.start()
        self.mock_strict_trackers = self.patcher2.start()
        self.addCleanup(self.patcher1.stop)
        self.addCleanup(self.patcher2.stop)

    def test_simple_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content(
            self.hyperlink_simple, self.imagelink_simple
        )
        assert general_removed == 2
        assert general_count == 2

    def test_complex_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://foo.open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://bar.open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content(
            self.hyperlink_complex, self.imagelink_complex
        )
        assert general_removed == 2
        assert general_count == 2

    def test_complex_single_quote_general_tracker_replaced_with_relay_content(self):
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html'>A link</a>\n"
            + "<img src='https://bar.open.tracker.com/foo/bar.jpg'>An image</img>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content(
            self.hyperlink_complex, self.imagelink_complex
        ).replace('"', "'")
        assert general_removed == 2
        assert general_count == 2

    def test_no_tracker_replaced_with_relay_content(self):
        content = (
            "<a href='https://fooopen.tracker.com/foo/bar.html'>A link</a>\n"
            + "<img src='https://baropen.tracker.com/foo/bar.jpg'>An image</img>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert (
            general_count == general_removed
        )  # count uses the same regex pattern as removing trackers

    def test_general_tracker_embedded_in_another_tracker_replaced_only_once(self):
        """
        Test that a general tracker embedded in the URL of another tracker is
        replaced only once with the relay content.
        """
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html?src=trckr.com'>"
            "A link</a>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        expected_content = (
            f"<a href='{self.url}"
            f"{self.url_trackerwarning_data(self.hyperlink_tracker_in_tracker)}'>"
            "A link</a>"
        )
        assert changed_content == expected_content
        assert general_removed == 1
        assert general_count == 1

    def test_general_tracker_also_in_text_tracker_replaced_only_once(self):
        """
        Test that a general tracker embedded in another tracker, and also in the text
        of the link, is replaced only once with the relay content.
        """
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html?src=trckr.com'>"
            "trckr.com</a>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        expected_content = (
            f"<a href='{self.url}"
            f"{self.url_trackerwarning_data(self.hyperlink_tracker_in_tracker)}'>"
            "trckr.com</a>"
        )
        assert changed_content == expected_content
        assert general_removed == 1
        assert general_count == 1

    def test_simple_strict_tracker_found(self):
        content = (
            '<a href="https://strict.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://strict.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert general_count == 0
