from django.contrib.auth.models import User
from django.test import TestCase

from privaterelay.tests.utils import make_premium_test_user

from ..exceptions import CannotMakeSubdomainException
from ..models import Profile, RegisteredSubdomain, hash_subdomain
from ..validators import valid_available_subdomain


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
