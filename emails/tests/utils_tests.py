from datetime import datetime, timezone
from unittest.mock import patch

from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from waffle.models import Flag
import pytest

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from emails.models import (
    ACCOUNT_PAUSED_ERR_MSG,
    CannotMakeAddressException,
    DOMAIN_CHOICES,
    DeletedAddress,
    DomainAddress,
    RelayAddress,
    get_domains_from_settings,
)
from emails.utils import (
    EmailAddressInfo,
    EmailAddressType,
    NEW_FROM_ADDRESS_FLAG_NAME,
    generate_relay_From,
    get_email_domain_from_settings,
    lookup_email_address,
    parseaddr,
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
@patch("emails.utils.GENERAL_TRACKERS", ["trckr.com", "open.tracker.com"])
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
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content
        assert general_removed == 2
        assert general_count == 2

    def test_complex_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://foo.open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://bar.open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content
        assert general_removed == 2
        assert general_count == 2

    def test_complex_single_quote_general_tracker_replaced_with_relay_content(self):
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html'>A link</a>\n"
            + "<img src='https://bar.open.tracker.com/foo/bar.jpg'>An image</img>"
        )
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content.replace('"', "'")
        assert general_removed == 2
        assert general_count == 2

    def test_no_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://fooopen.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://baropen.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert (
            general_count == general_removed
        )  # count uses the same regex pattern as removing trackers

    def test_general_tracker_embedded_in_another_tracker_replaced_only_once_with_relay_content(
        self,
    ):
        content = "<a href='https://foo.open.tracker.com/foo/bar.html?src=trckr.com'>A link</a>"
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == "<a href='https://test.com/faq'>A link</a>"
        assert general_removed == 1
        assert general_count == 1

    def test_general_tracker_also_in_text_tracker_replaced_only_once_with_relay_content(
        self,
    ):
        content = "<a href='https://foo.open.tracker.com/foo/bar.html?src=trckr.com'>trckr.com</a>"
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == "<a href='https://test.com/faq'>trckr.com</a>"
        assert general_removed == 1
        assert general_count == 1

    def test_simple_strict_tracker_found(self):
        content = (
            '<a href="https://strict.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://strict.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(content)
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert general_count == 0


#
# email.utils.lookup_email_address tests
#


@pytest.fixture
def free_user(db) -> User:
    free_user = make_free_test_user()
    free_user.email = "a_user@mail.example.com"
    free_user.save()
    return free_user


@pytest.fixture
def relay_address(free_user) -> RelayAddress:
    return RelayAddress.objects.create(user=free_user, domain=2)


@pytest.fixture
def premium_user(db) -> User:
    premium_user = make_premium_test_user()
    profile = premium_user.profile_set.get()
    profile.subdomain = "subdomain"
    profile.save()
    return premium_user


@pytest.fixture
def domain_address(premium_user) -> DomainAddress:
    return DomainAddress.objects.create(user=premium_user, address="my-alias", domain=2)


@pytest.mark.parametrize("email_address", ["a_string", "too@many@address@signs"])
def test_lookup_email_address_malformed(email_address: str) -> None:
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(email_address, EmailAddressType.MALFORMED_ADDRESS)


def test_lookup_email_address_relay_address(relay_address) -> None:
    email_address = relay_address.full_address
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.RELAY_ADDRESS, address_object=relay_address
    )


@pytest.mark.parametrize("domain_number, setting_name", DOMAIN_CHOICES)
def test_lookup_email_address_relay_address_with_domain(
    free_user, domain_number: int, setting_name: str
) -> None:
    address = RelayAddress.objects.create(user=free_user, domain=domain_number)
    email_address = address.full_address
    domain = get_domains_from_settings()[setting_name]
    assert email_address.endswith(f"@{domain}")

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.RELAY_ADDRESS, address_object=address
    )


def test_lookup_email_address_deleted_relay_address(relay_address) -> None:
    email_address = relay_address.full_address
    relay_address.delete()
    deleted_addresses = list(DeletedAddress.objects.all())
    assert len(deleted_addresses) == 1

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.DELETED_RELAY_ADDRESS,
        deleted_address_objects=deleted_addresses,
    )


def test_lookup_email_address_multiple_deleted_relay_address(relay_address) -> None:
    email_address = relay_address.full_address
    relay_address.delete()
    deleted_address1 = DeletedAddress.objects.get()
    deleted_address2 = DeletedAddress.objects.create(
        address_hash=deleted_address1.address_hash
    )

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.DELETED_RELAY_ADDRESS,
        deleted_address_objects=[deleted_address1, deleted_address2],
    )


@pytest.mark.django_db
@pytest.mark.parametrize("domain_number, setting_name", DOMAIN_CHOICES)
def test_lookup_email_address_unknown_relay_address(
    domain_number: int, setting_name: str
) -> None:
    domain = get_domains_from_settings()[setting_name]
    email_address = f"unused123@{domain}"

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.UNKNOWN_RELAY_ADDRESS
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "email_address",
    ("test@example.com", "test@email.example.com", "test@invalid_domain"),
)
def test_lookup_email_address_external_address(email_address: str) -> None:
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(email_address, EmailAddressType.EXTERNAL_ADDRESS)


@pytest.mark.django_db
def test_lookup_email_address_user_address(free_user) -> None:
    email_address = free_user.email
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.USER_ADDRESS, users=[free_user]
    )


@pytest.mark.django_db
def test_lookup_email_address_multi_user_address(free_user) -> None:
    email_address = free_user.email
    user2 = baker.make(User, email=email_address)

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.USER_ADDRESS, users=[free_user, user2]
    )


@pytest.mark.parametrize(
    "setting_name", ("RELAY_FROM_ADDRESS", "NEW_RELAY_FROM_ADDRESS")
)
def test_lookup_email_address_relay_reply_address(setting_name) -> None:
    setting_val = getattr(settings, setting_name)
    _, email_address = parseaddr(setting_val)
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(email_address, EmailAddressType.REPLY_ADDRESS)


def test_lookup_email_address_relay_premium_reply_address() -> None:
    email_address = "replies@default.com"
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.PREMIUM_REPLY_ADDRESS
    )


def test_lookup_email_address_domain_address(domain_address) -> None:
    email_address = domain_address.full_address
    assert email_address.endswith("@subdomain.test.com")

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.DOMAIN_ADDRESS, address_object=domain_address
    )


def test_lookup_email_address_deleted_domain_address(domain_address) -> None:
    email_address = domain_address.full_address
    domain_address.delete()
    deleted_address = DeletedAddress.objects.get()

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.DELETED_DOMAIN_ADDRESS,
        deleted_address_objects=[deleted_address],
    )


def test_lookup_email_address_invalid_domain_address(premium_user) -> None:
    """The old domain is not valid as a domain address."""
    address = DomainAddress.objects.create(user=premium_user, address="found", domain=1)
    email_address = address.full_address
    assert email_address.endswith("@subdomain.default.com")

    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.INVALID_DOMAIN_ADDRESS
    )


@pytest.mark.django_db
def test_lookup_email_address_unknown_domain_address() -> None:
    email_address = "unknown@subdomain.test.com"
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.UNKNOWN_DOMAIN_ADDRESS
    )


def test_lookup_email_address_reserved_domain_address(premium_user) -> None:
    email_address = "unknown@subdomain.test.com"
    info = lookup_email_address(email_address)
    assert info == EmailAddressInfo(
        email_address, EmailAddressType.RESERVED_DOMAIN_ADDRESS
    )


def test_lookup_email_address_create_domain_address(premium_user) -> None:
    email_address = "unknown@subdomain.test.com"
    info = lookup_email_address(email_address, create_domain_address=True)
    domain_address = DomainAddress.objects.get()
    assert domain_address.full_address == email_address
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.NEW_DOMAIN_ADDRESS,
        address_object=domain_address,
    )


def test_lookup_email_address_recreate_deleted_domain_address(domain_address) -> None:
    email_address = domain_address.full_address
    domain_address.delete()
    deleted_address = DeletedAddress.objects.get()

    info = lookup_email_address(email_address, create_domain_address=True)
    domain_address = DomainAddress.objects.get()
    assert domain_address.full_address == email_address
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.RECREATED_DOMAIN_ADDRESS,
        address_object=domain_address,
        deleted_address_objects=[deleted_address],
    )


def test_lookup_email_address_create_domain_address_without_premium(
    premium_user,
) -> None:
    fxa = SocialAccount.objects.get(user=premium_user, provider="fxa")
    fxa.extra_data["subscriptions"] = []
    fxa.save()
    email_address = "unknown@subdomain.test.com"

    info = lookup_email_address(email_address, create_domain_address=True)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.FAILED_TO_CREATE_DOMAIN_ADDRESS,
        creation_exception=info.creation_exception,
    )
    assert isinstance(info.creation_exception, CannotMakeAddressException)
    expected_err = "You must be a premium subscriber to create subdomain aliases."
    assert str(info.creation_exception) == expected_err


def test_lookup_email_address_create_domain_address_with_pause(premium_user) -> None:
    profile = premium_user.profile_set.get()
    profile.last_account_flagged = datetime.now(timezone.utc)
    profile.save()
    email_address = "unknown@subdomain.test.com"

    info = lookup_email_address(email_address, create_domain_address=True)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.FAILED_TO_CREATE_DOMAIN_ADDRESS,
        creation_exception=info.creation_exception,
    )
    assert str(info.creation_exception) == ACCOUNT_PAUSED_ERR_MSG


def test_lookup_email_address_create_domain_address_bad_words(premium_user) -> None:
    email_address = "attack@subdomain.test.com"
    info = lookup_email_address(email_address, create_domain_address=True)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.FAILED_TO_CREATE_DOMAIN_ADDRESS,
        creation_exception=info.creation_exception,
    )
    expected = (
        "Domain address attack could not be created, try using a different value."
    )
    assert str(info.creation_exception) == expected


def test_lookup_email_address_create_domain_address_bad_pattern(premium_user) -> None:
    email_address = "ungültig@subdomain.test.com"
    info = lookup_email_address(email_address, create_domain_address=True)
    assert info == EmailAddressInfo(
        email_address,
        EmailAddressType.FAILED_TO_CREATE_DOMAIN_ADDRESS,
        creation_exception=info.creation_exception,
    )
    expected = (
        "Domain address ungültig could not be created, try using a different value."
    )
    assert str(info.creation_exception) == expected
