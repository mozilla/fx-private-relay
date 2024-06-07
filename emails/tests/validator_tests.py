"""Tests for field validators."""

from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from waffle.testutils import override_flag

from privaterelay.tests.utils import make_free_test_user, make_premium_test_user

from ..exceptions import CannotMakeSubdomainException
from ..models import (
    DomainAddress,
    Profile,
    RegisteredSubdomain,
    RelayAddress,
    hash_subdomain,
)
from ..validators import (
    has_bad_words,
    is_blocklisted,
    valid_address,
    valid_address_pattern,
    valid_available_subdomain,
)


class HasBadWordsTest(TestCase):
    def test_has_bad_words_with_bad_words(self) -> None:
        assert has_bad_words("angry")

    def test_has_bad_words_without_bad_words(self) -> None:
        assert not has_bad_words("happy")

    def test_has_bad_words_exact_match_on_small_words(self) -> None:
        assert has_bad_words("ho")
        assert not has_bad_words("horse")
        assert has_bad_words("ass")
        assert not has_bad_words("cassandra")
        assert has_bad_words("hell")
        assert not has_bad_words("shell")
        assert has_bad_words("bra")
        assert not has_bad_words("brain")
        assert has_bad_words("fart")
        assert not has_bad_words("farther")
        assert has_bad_words("fu")
        assert not has_bad_words("funny")
        assert has_bad_words("poo")
        assert not has_bad_words("pools")


class IsBlocklistedTest(TestCase):
    def test_is_blocklisted_with_blocked_word(self) -> None:
        assert is_blocklisted("mozilla")

    def test_is_blocklisted_with_custom_blocked_word(self) -> None:
        # custom blocked word
        # see MPP-2077 for more details
        assert is_blocklisted("customdomain")

    def test_is_blocklisted_without_blocked_words(self) -> None:
        assert not is_blocklisted("non-blocked-word")

    @patch("emails.validators.blocklist", return_value=["blocked-word"])
    def test_is_blocklisted_with_mocked_blocked_words(self, mock_config: Mock) -> None:
        assert is_blocklisted("blocked-word")


class ValidAvailableSubdomainTest(TestCase):
    """Tests for valid_available_subdomain()"""

    ERR_NOT_AVAIL = "error-subdomain-not-available"
    ERR_EMPTY_OR_NULL = "error-subdomain-cannot-be-empty-or-null"

    def reserve_subdomain_for_new_user(self, subdomain: str) -> User:
        user = make_premium_test_user()
        user.profile.add_subdomain(subdomain)
        return user

    def test_bad_word_raises(self) -> None:
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("angry")

    def test_blocked_word_raises(self) -> None:
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("mozilla")

    def test_taken_subdomain_raises(self) -> None:
        subdomain = "thisisfine"
        self.reserve_subdomain_for_new_user(subdomain)
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain(subdomain)

    def test_taken_subdomain_different_case_raises(self) -> None:
        self.reserve_subdomain_for_new_user("thIsIsfInE")
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("THiSiSFiNe")

    def test_inactive_subdomain_raises(self) -> None:
        """subdomains registered by now deleted profiles are not available."""
        subdomain = "thisisfine"
        user = self.reserve_subdomain_for_new_user(subdomain)
        user.delete()

        registered_subdomain_count = RegisteredSubdomain.objects.filter(
            subdomain_hash=hash_subdomain(subdomain)
        ).count()
        assert Profile.objects.filter(subdomain=subdomain).count() == 0
        assert registered_subdomain_count == 1
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain(subdomain)

    def test_subdomain_with_space_raises(self) -> None:
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("my domain")

    def test_subdomain_with_special_char_raises(self) -> None:
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("my@domain")

    def test_subdomain_with_dash_succeeds(self) -> None:
        valid_available_subdomain("my-domain")

    def test_subdomain_with_dash_at_front_raises(self) -> None:
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("-mydomain")

    def test_empty_subdomain_raises(self) -> None:
        with self.assertRaisesMessage(
            CannotMakeSubdomainException, self.ERR_EMPTY_OR_NULL
        ):
            valid_available_subdomain("")

    def test_null_subdomain_raises(self) -> None:
        with self.assertRaisesMessage(
            CannotMakeSubdomainException, self.ERR_EMPTY_OR_NULL
        ):
            valid_available_subdomain(None)

    def test_subdomain_with_space_at_end_raises(self) -> None:
        with self.assertRaisesMessage(CannotMakeSubdomainException, self.ERR_NOT_AVAIL):
            valid_available_subdomain("mydomain ")


class ValidAddressPatternTest(TestCase):
    def test_valid_address_pattern_is_valid(self) -> None:
        assert valid_address_pattern("foo")
        assert valid_address_pattern("foo-bar")
        assert valid_address_pattern("foo.bar")
        assert valid_address_pattern("f00bar")
        assert valid_address_pattern("123foo")
        assert valid_address_pattern("123")

    def test_valid_address_pattern_is_not_valid(self) -> None:
        assert not valid_address_pattern("-")
        assert not valid_address_pattern("-foo")
        assert not valid_address_pattern("foo-")
        assert not valid_address_pattern(".foo")
        assert not valid_address_pattern("foo.")
        assert not valid_address_pattern("foo bar")
        assert not valid_address_pattern("Foo")


class ValidAddressTest(TestCase):
    def test_valid_address_dupe_of_deleted_invalid(self) -> None:
        user = make_free_test_user()
        relay_address = RelayAddress.objects.create(user=user)
        relay_address.delete()
        assert not valid_address(relay_address.address, relay_address.domain_value)

    @override_flag("custom_domain_management_redesign", active=True)
    def test_valid_address_dupe_domain_address_of_deleted_is_not_valid(self) -> None:
        user = make_premium_test_user()
        user.profile.subdomain = "mysubdomain"
        user.profile.save()
        address = "same-address"
        domain_address = DomainAddress.make_domain_address(user, address=address)
        domain_address.delete()
        assert not valid_address(
            address, domain_address.domain_value, user.profile.subdomain
        )
