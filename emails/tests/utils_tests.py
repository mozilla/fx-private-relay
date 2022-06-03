from email.utils import parseaddr

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from unittest.mock import patch
from model_bakery import baker
from waffle.testutils import override_sample
from waffle.models import Flag

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
        premium_profile = premium_user.profile_set.first()
        original_from_address = '"foo bar" <foo@bar.com>'
        formatted_from_address = generate_relay_From(
            original_from_address, premium_profile
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
            original_from_address, free_user.profile_set.first()
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
            original_from_address, free_user.profile_set.first()
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
            original_from_address, free_user.profile_set.first()
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
@override_sample("foxfood-tracker-removal-sample", active=True)
@patch("emails.utils.GENERAL_TRACKERS", ["open.tracker.com"])
@patch("emails.utils.STRICT_TRACKERS", ["strict.tracker.com"])
class RemoveTrackers(TestCase):
    def setUp(self):
        self.expected_content = (
            '<a href="https://test.com/faq">A link</a>\n'
            + '<img src="https://test.com/faq">An image</img>'
        )

    def test_simple_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, control, study_details = remove_trackers(content)
        general_removed = study_details["tracker_removed"]
        general_count = study_details["general"]["count"]
        strict_count = study_details["strict"]["count"]

        assert changed_content == self.expected_content
        assert general_removed == 2
        assert general_count == 2
        assert strict_count == 0
        assert control == False

    def test_complex_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://foo.open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://bar.open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, control, study_details = remove_trackers(content)
        general_removed = study_details["tracker_removed"]
        general_count = study_details["general"]["count"]
        strict_count = study_details["strict"]["count"]

        assert changed_content == self.expected_content
        assert general_removed == 2
        assert general_count == 2
        assert strict_count == 0
        assert control == False

    def test_complex_single_quote_general_tracker_replaced_with_relay_content(self):
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html'>A link</a>\n"
            + "<img src='https://bar.open.tracker.com/foo/bar.jpg'>An image</img>"
        )
        changed_content, control, study_details = remove_trackers(content)
        general_removed = study_details["tracker_removed"]
        general_count = study_details["general"]["count"]
        strict_count = study_details["strict"]["count"]

        assert changed_content == self.expected_content.replace('"', "'")
        assert general_removed == 2
        assert general_count == 2
        assert strict_count == 0
        assert control == False

    def test_no_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://fooopen.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://baropen.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, control, study_details = remove_trackers(content)
        general_removed = study_details["tracker_removed"]
        general_count = study_details["general"]["count"]
        strict_count = study_details["strict"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert (
            general_count == 2
        )  # this is because the count uses search and not regex pattern
        assert strict_count == 0
        assert control == False

    def test_simple_strict_tracker_found(self):
        content = (
            '<a href="https://strict.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://strict.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, control, study_details = remove_trackers(content)
        general_removed = study_details["tracker_removed"]
        general_count = study_details["general"]["count"]
        strict_count = study_details["strict"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert general_count == 0
        assert strict_count == 2
        assert control == False

    @override_sample("foxfood-tracker-removal-sample", active=False)
    def test_simple_general_strict_tracker_found_no_tracker_removed(self):
        content = (
            '<a href="https://foo.open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://strict.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, control, study_details = remove_trackers(content)
        general_removed = study_details["tracker_removed"]
        general_count = study_details["general"]["count"]
        strict_count = study_details["strict"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert general_count == 1
        assert strict_count == 1
        assert control == True
