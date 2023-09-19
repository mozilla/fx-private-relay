from datetime import datetime, timedelta, timezone
from hashlib import sha256
import random
from unittest import skip
from unittest.mock import patch
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import User
from django.test import override_settings, TestCase

from allauth.socialaccount.models import SocialAccount
import pytest

from model_bakery import baker

from ..models import (
    AbuseMetrics,
    address_hash,
    CannotMakeAddressException,
    CannotMakeSubdomainException,
    DeletedAddress,
    DomainAddress,
    get_domains_from_settings,
    get_domain_numerical,
    has_bad_words,
    hash_subdomain,
    is_blocklisted,
    Profile,
    RegisteredSubdomain,
    RelayAddress,
    valid_available_subdomain,
    valid_address,
    valid_address_pattern,
)


def make_free_test_user(email: str = "") -> User:
    if email:
        user = baker.make(User, email=email)
    else:
        user = baker.make(User)
    user_profile = Profile.objects.get(user=user)
    user_profile.server_storage = True
    user_profile.save()
    baker.make(
        SocialAccount, user=user, provider="fxa", extra_data={"avatar": "avatar.png"}
    )
    return user


def make_premium_test_user() -> User:
    # premium user
    premium_user = baker.make(User, email="premium@email.com")
    premium_user_profile = Profile.objects.get(user=premium_user)
    premium_user_profile.server_storage = True
    premium_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    premium_user_profile.save()
    upgrade_test_user_to_premium(premium_user)
    return premium_user


def make_storageless_test_user():
    storageless_user = baker.make(User)
    storageless_user_profile = storageless_user.profile
    storageless_user_profile.server_storage = False
    storageless_user_profile.subdomain = "mydomain"
    storageless_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    storageless_user_profile.save()
    upgrade_test_user_to_premium(storageless_user)
    return storageless_user


def unlimited_subscription() -> str:
    return random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED)


def upgrade_test_user_to_premium(user):
    random_sub = unlimited_subscription()
    baker.make(
        SocialAccount,
        user=user,
        provider="fxa",
        extra_data={"avatar": "avatar.png", "subscriptions": [random_sub]},
    )
    return user


class MiscEmailModelsTest(TestCase):
    def test_has_bad_words_with_bad_words(self):
        assert has_bad_words("angry")

    def test_has_bad_words_without_bad_words(self):
        assert not has_bad_words("happy")

    def test_has_bad_words_exact_match_on_small_words(self):
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

    def test_is_blocklisted_with_blocked_word(self):
        assert is_blocklisted("mozilla")

    def test_is_blocklisted_with_custom_blocked_word(self):
        # custom blocked word
        # see MPP-2077 for more details
        assert is_blocklisted("customdomain")

    def test_is_blocklisted_without_blocked_words(self):
        assert not is_blocklisted("non-blocked-word")

    @override_settings(RELAY_FIREFOX_DOMAIN="firefox.com")
    def test_address_hash_without_subdomain_domain_firefox(self):
        address = "aaaaaaaaa"
        expected_hash = sha256(f"{address}".encode("utf-8")).hexdigest()
        assert address_hash(address, domain="firefox.com") == expected_hash

    @override_settings(RELAY_FIREFOX_DOMAIN="firefox.com")
    def test_address_hash_without_subdomain_domain_not_firefoxz(self):
        non_default = "test.com"
        address = "aaaaaaaaa"
        expected_hash = sha256(f"{address}@{non_default}".encode("utf-8")).hexdigest()
        assert address_hash(address, domain=non_default) == expected_hash

    def test_address_hash_with_subdomain(self):
        address = "aaaaaaaaa"
        subdomain = "test"
        domain = get_domains_from_settings().get("MOZMAIL_DOMAIN")
        expected_hash = sha256(
            f"{address}@{subdomain}.{domain}".encode("utf-8")
        ).hexdigest()
        assert address_hash(address, subdomain, domain) == expected_hash

    def test_address_hash_with_additional_domain(self):
        address = "aaaaaaaaa"
        test_domain = "test.com"
        expected_hash = sha256(f"{address}@{test_domain}".encode("utf-8")).hexdigest()
        assert address_hash(address, domain=test_domain) == expected_hash

    def test_get_domain_numerical(self):
        assert get_domain_numerical("default.com") == 1
        assert get_domain_numerical("test.com") == 2

    def test_valid_address_pattern_is_valid(self):
        assert valid_address_pattern("foo")
        assert valid_address_pattern("foo-bar")
        assert valid_address_pattern("foo.bar")
        assert valid_address_pattern("f00bar")
        assert valid_address_pattern("123foo")
        assert valid_address_pattern("123")

    def test_valid_address_pattern_is_not_valid(self):
        assert not valid_address_pattern("-")
        assert not valid_address_pattern("-foo")
        assert not valid_address_pattern("foo-")
        assert not valid_address_pattern(".foo")
        assert not valid_address_pattern("foo.")
        assert not valid_address_pattern("foo bar")
        assert not valid_address_pattern("Foo")


class RelayAddressTest(TestCase):
    def setUp(self):
        self.user = make_free_test_user()
        self.user_profile = self.user.profile
        self.premium_user = make_premium_test_user()
        self.premium_user_profile = self.premium_user.profile
        self.storageless_user = make_storageless_test_user()

    def test_create_assigns_to_user(self):
        relay_address = RelayAddress.objects.create(user=self.user_profile.user)
        assert relay_address.user == self.user_profile.user

    @override_settings(MAX_NUM_FREE_ALIASES=5, MAX_ADDRESS_CREATION_PER_DAY=10)
    def test_create_has_limit(self) -> None:
        baker.make(
            RelayAddress,
            user=self.premium_user,
            _quantity=settings.MAX_ADDRESS_CREATION_PER_DAY,
        )
        with pytest.raises(CannotMakeAddressException) as exc_info:
            RelayAddress.objects.create(user=self.premium_user)
        assert exc_info.value.get_codes() == "account_is_paused"
        relay_address_count = RelayAddress.objects.filter(
            user=self.premium_user_profile.user
        ).count()
        assert relay_address_count == 10

    def test_create_premium_user_can_exceed_free_limit(self):
        baker.make(
            RelayAddress,
            user=self.premium_user,
            _quantity=settings.MAX_NUM_FREE_ALIASES + 1,
        )
        relay_addresses = RelayAddress.objects.filter(
            user=self.premium_user
        ).values_list("address", flat=True)
        assert len(relay_addresses) == settings.MAX_NUM_FREE_ALIASES + 1

    def test_create_non_premium_user_cannot_pass_free_limit(self) -> None:
        baker.make(
            RelayAddress, user=self.user, _quantity=settings.MAX_NUM_FREE_ALIASES
        )
        with pytest.raises(CannotMakeAddressException) as exc_info:
            RelayAddress.objects.create(user=self.user_profile.user)
        assert exc_info.value.get_codes() == "free_tier_limit"
        relay_addresses = RelayAddress.objects.filter(
            user=self.user_profile.user
        ).values_list("address", flat=True)
        assert len(relay_addresses) == settings.MAX_NUM_FREE_ALIASES

    @skip(reason="ignore test for code path that we don't actually use")
    def test_create_with_specified_domain(self):
        relay_address = RelayAddress.objects.create(
            user=self.user_profile.user, domain=2
        )
        assert relay_address.domain == 2
        assert relay_address.get_domain_display() == "MOZMAIL_DOMAIN"
        assert relay_address.domain_value == "test.com"

    def test_delete_adds_deleted_address_object(self):
        relay_address = baker.make(RelayAddress, user=self.user)
        address_hash = sha256(relay_address.full_address.encode("utf-8")).hexdigest()
        relay_address.delete()
        deleted_count = DeletedAddress.objects.filter(address_hash=address_hash).count()
        assert deleted_count == 1

    def test_delete_mozmail_deleted_address_object(self):
        relay_address = baker.make(RelayAddress, domain=2, user=self.user)
        address_hash = sha256(
            f"{relay_address.address}@{relay_address.domain_value}".encode("utf-8")
        ).hexdigest()
        relay_address.delete()
        deleted_count = DeletedAddress.objects.filter(address_hash=address_hash).count()
        assert deleted_count == 1

    def test_valid_address_dupe_of_deleted_invalid(self):
        relay_address = RelayAddress.objects.create(user=baker.make(User))
        relay_address.delete()
        assert not valid_address(relay_address.address, relay_address.domain_value)

    def test_free_user_cant_set_block_list_emails(self):
        relay_address = RelayAddress.objects.create(user=self.user)
        relay_address.block_list_emails = True
        relay_address.save()
        relay_address.refresh_from_db()
        assert relay_address.block_list_emails is False

    def test_premium_user_can_set_block_list_emails(self):
        relay_address = RelayAddress.objects.create(user=self.premium_user)
        assert relay_address.block_list_emails is False
        relay_address.block_list_emails = True
        relay_address.save()
        relay_address.refresh_from_db()
        assert relay_address.block_list_emails is True

    def test_formerly_premium_user_clears_block_list_emails(self):
        relay_address = RelayAddress.objects.create(
            user=self.premium_user, block_list_emails=True
        )
        relay_address.refresh_from_db()
        assert relay_address.block_list_emails is True

        # Remove premium from user
        fxa_account = self.premium_user.profile.fxa
        fxa_account.extra_data["subscriptions"] = []
        fxa_account.save()
        assert not self.premium_user.profile.has_premium

        relay_address.save()
        assert relay_address.block_list_emails is False

    def test_storageless_user_cant_set_label(self):
        relay_address = RelayAddress.objects.create(user=self.storageless_user)
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on == ""
        relay_address.description = "Arbitrary description"
        relay_address.generated_for = "https://example.com"
        relay_address.used_on = "https://example.com"
        relay_address.save()
        relay_address.refresh_from_db()
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on == ""


class ProfileTestCase(TestCase):
    """Base class for Profile tests."""

    def setUp(self) -> None:
        user = baker.make(User)
        self.profile = user.profile
        assert self.profile.server_storage is True

    def get_or_create_social_account(self) -> SocialAccount:
        """Get the test user's social account, creating if needed."""
        social_account, _ = SocialAccount.objects.get_or_create(
            user=self.profile.user,
            provider="fxa",
            uid=str(uuid4()),
            defaults={"extra_data": {"avatar": "image.png", "subscriptions": []}},
        )
        return social_account

    def upgrade_to_premium(self) -> None:
        """Add a unlimited subscription to the user."""
        social_account = self.get_or_create_social_account()
        social_account.extra_data["subscriptions"].append(unlimited_subscription())
        social_account.save()


class ProfileBounceTestCase(ProfileTestCase):
    """Base class for Profile tests that check for bounces."""

    def set_hard_bounce(self) -> datetime:
        """
        Set a hard bounce pause for the profile, return the bounce time.

        This happens when the user's email server reports a hard bounce, such as
        saying the email does not exist.
        """
        self.profile.last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.save()
        return self.profile.last_hard_bounce

    def set_soft_bounce(self) -> datetime:
        """
        Set a soft bounce for the profile, return the bounce time.

        This happens when the user's email server reports a soft bounce, such as
        saying the user's mailbox is full.
        """
        self.profile.last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.save()
        return self.profile.last_soft_bounce


class ProfileCheckBouncePause(ProfileBounceTestCase):
    """Tests for Profile.check_bounce_pause()"""

    def test_no_bounces(self) -> None:
        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""

    def test_hard_bounce_pending(self) -> None:
        self.set_hard_bounce()
        bounce_paused, bounce_type = self.profile.check_bounce_pause()
        assert bounce_paused is True
        assert bounce_type == "hard"

    def test_soft_bounce_pending(self) -> None:
        self.set_soft_bounce()
        bounce_paused, bounce_type = self.profile.check_bounce_pause()
        assert bounce_paused is True
        assert bounce_type == "soft"

    def test_hard_and_soft_bounce_pending_shows_hard(self) -> None:
        self.set_hard_bounce()
        self.set_soft_bounce()
        bounce_paused, bounce_type = self.profile.check_bounce_pause()
        assert bounce_paused is True
        assert bounce_type == "hard"

    def test_hard_bounce_over_resets_timer(self) -> None:
        self.profile.last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS + 1
        )
        self.profile.save()
        assert self.profile.last_hard_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""
        assert self.profile.last_hard_bounce is None

    def test_soft_bounce_over_resets_timer(self) -> None:
        self.profile.last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS + 1
        )
        self.profile.save()
        assert self.profile.last_soft_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""
        assert self.profile.last_soft_bounce is None


class ProfileNextEmailTryDateTest(ProfileBounceTestCase):
    """Tests for Profile.next_email_try"""

    def test_no_bounces_returns_today(self) -> None:
        assert self.profile.next_email_try.date() == datetime.now(timezone.utc).date()

    def test_hard_bounce_returns_proper_datemath(self) -> None:
        last_hard_bounce = self.set_hard_bounce()
        expected_next_try_date = last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        assert self.profile.next_email_try.date() == expected_next_try_date.date()

    def test_soft_bounce_returns_proper_datemath(self) -> None:
        last_soft_bounce = self.set_soft_bounce()
        expected_next_try_date = last_soft_bounce + timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS
        )
        assert self.profile.next_email_try.date() == expected_next_try_date.date()

    def test_hard_and_soft_bounce_returns_hard_datemath(self) -> None:
        last_soft_bounce = self.set_soft_bounce()
        last_hard_bounce = self.set_hard_bounce()
        assert last_soft_bounce != last_hard_bounce
        expected_next_try_date = last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        assert self.profile.next_email_try.date() == expected_next_try_date.date()


class ProfileLastBounceDateTest(ProfileBounceTestCase):
    """Tests for Profile.last_bounce_date"""

    def test_no_bounces_returns_None(self) -> None:
        assert self.profile.last_bounce_date is None

    def test_soft_bounce_returns_its_date(self) -> None:
        self.set_soft_bounce()
        assert self.profile.last_bounce_date == self.profile.last_soft_bounce

    def test_hard_bounce_returns_its_date(self) -> None:
        self.set_hard_bounce()
        assert self.profile.last_bounce_date == self.profile.last_hard_bounce

    def test_hard_and_soft_bounces_returns_hard_date(self) -> None:
        self.set_soft_bounce()
        self.set_hard_bounce()
        assert self.profile.last_bounce_date == self.profile.last_hard_bounce


class ProfileHasPremiumTest(ProfileTestCase):
    """Tests for Profile.has_premium"""

    def test_default_False(self) -> None:
        assert self.profile.has_premium is False

    def test_unlimited_subsription_returns_True(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.has_premium is True


class ProfileHasPhoneTest(ProfileTestCase):
    """Tests for Profile.has_phone"""

    def test_default_False(self) -> None:
        assert self.profile.has_phone is False


class ProfileTotalMasksTest(ProfileTestCase):
    """Tests for Profile.total_masks"""

    def test_total_masks(self) -> None:
        self.upgrade_to_premium()
        self.profile.add_subdomain("totalmasks")
        assert self.profile.total_masks == 0
        num_relay_addresses = random.randint(0, 2)
        for _ in list(range(num_relay_addresses)):
            baker.make(RelayAddress, user=self.profile.user)
        num_domain_addresses = random.randint(0, 2)
        for i in list(range(num_domain_addresses)):
            baker.make(DomainAddress, user=self.profile.user, address=f"mask{i}")
        assert self.profile.total_masks == num_relay_addresses + num_domain_addresses


class ProfileAtMaskLimitTest(ProfileTestCase):
    """Tests for Profile.at_mask_limit"""

    def test_premium_user_returns_False(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.at_mask_limit is False
        baker.make(
            RelayAddress,
            user=self.profile.user,
            _quantity=settings.MAX_NUM_FREE_ALIASES,
        )
        assert self.profile.at_mask_limit is False

    def test_free_user(self) -> None:
        assert self.profile.at_mask_limit is False
        baker.make(
            RelayAddress,
            user=self.profile.user,
            _quantity=settings.MAX_NUM_FREE_ALIASES,
        )
        assert self.profile.at_mask_limit is True


class ProfileAddSubdomainTest(ProfileTestCase):
    """Tests for Profile.add_subdomain()"""

    def test_new_unlimited_profile(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.add_subdomain("newpremium") == "newpremium"

    def test_lowercases_subdomain_value(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.add_subdomain("mIxEdcAsE") == "mixedcase"

    def test_non_premium_user_raises_exception(self) -> None:
        expected_msg = "error-premium-set-subdomain"
        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain("test")

    def test_calling_again_raises_exception(self) -> None:
        self.upgrade_to_premium()
        subdomain = "test"
        self.profile.subdomain = subdomain
        self.profile.save()

        expected_msg = "error-premium-cannot-change-subdomain"
        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain(subdomain)

    def test_badword_subdomain_raises_exception(self) -> None:
        self.upgrade_to_premium()
        expected_msg = "error-subdomain-not-available"
        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain("angry")

    def test_blocked_word_subdomain_raises_exception(self) -> None:
        self.upgrade_to_premium()
        expected_msg = "error-subdomain-not-available"
        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain("mozilla")

    def test_empty_subdomain_raises(self) -> None:
        self.upgrade_to_premium()
        expected_msg = "error-subdomain-cannot-be-empty-or-null"

        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain("")

    def test_null_subdomain_raises(self) -> None:
        self.upgrade_to_premium()
        expected_msg = "error-subdomain-cannot-be-empty-or-null"

        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain(None)

    def test_subdomain_with_space_at_end_raises(self) -> None:
        self.upgrade_to_premium()
        expected_msg = "error-subdomain-not-available"

        with self.assertRaisesMessage(CannotMakeSubdomainException, expected_msg):
            self.profile.add_subdomain("mydomain ")


class ProfileSaveTest(ProfileTestCase):
    """Tests for Profile.save()"""

    def test_lowercases_subdomain_value(self) -> None:
        self.upgrade_to_premium()
        self.profile.subdomain = "mIxEdcAsE"
        self.profile.save()
        assert self.profile.subdomain == "mixedcase"

    TEST_DESCRIPTION = "test description"
    TEST_USED_ON = TEST_GENERATED_FOR = "secret.com"

    def add_relay_address(self) -> RelayAddress:
        return baker.make(
            RelayAddress,
            user=self.profile.user,
            description=self.TEST_DESCRIPTION,
            generated_for=self.TEST_GENERATED_FOR,
            used_on=self.TEST_USED_ON,
        )

    def test_save_server_storage_true_doesnt_delete_data(self) -> None:
        relay_address = self.add_relay_address()
        self.profile.server_storage = True
        self.profile.save()

        relay_address.refresh_from_db()
        assert relay_address.description == self.TEST_DESCRIPTION
        assert relay_address.generated_for == self.TEST_GENERATED_FOR
        assert relay_address.used_on == self.TEST_USED_ON

    def test_save_server_storage_false_deletes_data(self) -> None:
        relay_address = self.add_relay_address()
        self.profile.server_storage = False
        self.profile.save()

        relay_address.refresh_from_db()
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on == ""

    def add_four_relay_addresses(self, user: User | None = None) -> list[RelayAddress]:
        if user is None:
            user = self.profile.user
        return baker.make(
            RelayAddress,
            user=user,
            description=self.TEST_DESCRIPTION,
            generated_for=self.TEST_GENERATED_FOR,
            used_on=self.TEST_USED_ON,
            _quantity=4,
        )

    def test_save_server_storage_false_deletes_ALL_data(self) -> None:
        self.add_four_relay_addresses()
        self.profile.server_storage = False
        self.profile.save()

        for relay_address in RelayAddress.objects.filter(user=self.profile.user):
            assert relay_address.description == ""
            assert relay_address.generated_for == ""

    def test_save_server_storage_false_only_deletes_that_profiles_data(self) -> None:
        other_user = make_free_test_user()
        assert other_user.profile.server_storage is True
        self.add_four_relay_addresses()
        self.add_four_relay_addresses(user=other_user)
        self.profile.server_storage = False
        self.profile.save()

        for relay_address in RelayAddress.objects.filter(user=self.profile.user):
            assert relay_address.description == ""
            assert relay_address.generated_for == ""
            assert relay_address.used_on == ""

        for relay_address in RelayAddress.objects.filter(user=other_user):
            assert relay_address.description == self.TEST_DESCRIPTION
            assert relay_address.generated_for == self.TEST_GENERATED_FOR
            assert relay_address.used_on == self.TEST_USED_ON


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

    def test_subdomain_with_dash_returns_True(self) -> None:
        assert valid_available_subdomain("my-domain") is True

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


class ProfileDisplayNameTest(ProfileTestCase):
    """Tests for Profile.display_name"""

    def test_exists(self) -> None:
        display_name = "Display Name"
        social_account = self.get_or_create_social_account()
        social_account.extra_data["displayName"] = display_name
        social_account.save()
        assert self.profile.display_name == display_name

    def test_display_name_does_not_exist(self) -> None:
        self.get_or_create_social_account()
        assert self.profile.display_name is None


class ProfileLanguageTest(ProfileTestCase):
    """Test Profile.language"""

    def test_no_fxa_extra_data_locale_returns_default_en(self) -> None:
        social_account = self.get_or_create_social_account()
        assert "locale" not in social_account.extra_data
        assert self.profile.language == "en"

    def test_no_fxa_locale_returns_default_en(self) -> None:
        assert self.profile.language == "en"

    def test_fxa_locale_de_returns_de(self) -> None:
        social_account = self.get_or_create_social_account()
        social_account.extra_data["locale"] = "de,en-US;q=0.9,en;q=0.8"
        social_account.save()
        assert self.profile.language == "de"


class ProfileFxaLocaleInPremiumCountryTest(ProfileTestCase):
    """Tests for Profile.fxa_locale_in_premium_country"""

    def set_fxa_locale(self, locale: str) -> None:
        social_account = self.get_or_create_social_account()
        social_account.extra_data["locale"] = locale
        social_account.save()

    def test_when_premium_available_returns_True(self) -> None:
        self.set_fxa_locale("de-DE,en-xx;q=0.9,en;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is True

    def test_en_implies_premium_available(self) -> None:
        self.set_fxa_locale("en;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is True

    def test_when_premium_unavailable_returns_False(self) -> None:
        self.set_fxa_locale("en-IN, en;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is False

    def test_when_premium_available_by_language_code_returns_True(self) -> None:
        self.set_fxa_locale("de;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is True

    def test_invalid_language_code_returns_False(self) -> None:
        self.set_fxa_locale("xx;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is False

    def test_when_premium_unavailable_by_language_code_returns_False(self) -> None:
        self.set_fxa_locale("zh;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is False

    def test_no_fxa_account_returns_False(self) -> None:
        assert self.profile.fxa_locale_in_premium_country is False

    def test_in_estonia(self):
        """Estonia (EE) was added in August 2023."""
        self.set_fxa_locale("et-ee,et;q=0.8")
        assert self.profile.fxa_locale_in_premium_country is True


class ProfileJoinedBeforePremiumReleaseTest(ProfileTestCase):
    """Tests for Profile.joined_before_premium_release"""

    def test_returns_True(self) -> None:
        before = "2021-10-18 17:00:00+00:00"
        self.profile.user.date_joined = datetime.fromisoformat(before)
        assert self.profile.joined_before_premium_release

    def test_returns_False(self) -> None:
        after = "2021-10-28 17:00:00+00:00"
        self.profile.user.date_joined = datetime.fromisoformat(after)
        assert self.profile.joined_before_premium_release is False


class ProfileDefaultsTest(ProfileTestCase):
    """Tests for default Profile values"""

    def test_user_created_after_premium_release_server_storage_True(self) -> None:
        assert self.profile.server_storage

    def test_emails_replied_new_user_aggregates_sum_of_replies_to_zero(self) -> None:
        assert self.profile.emails_replied == 0


class ProfileEmailsRepliedTest(ProfileTestCase):
    """Tests for Profile.emails_replied"""

    def test_premium_user_aggregates_replies_from_all_addresses(self) -> None:
        self.upgrade_to_premium()
        self.profile.subdomain = "test"
        self.profile.num_email_replied_in_deleted_address = 1
        self.profile.save()
        baker.make(RelayAddress, user=self.profile.user, num_replied=3)
        baker.make(
            DomainAddress, user=self.profile.user, address="lower-case", num_replied=5
        )

        assert self.profile.emails_replied == 9

    def test_free_user_aggregates_replies_from_relay_addresses(self) -> None:
        baker.make(RelayAddress, user=self.profile.user, num_replied=3)
        baker.make(RelayAddress, user=self.profile.user, num_replied=5)

        assert self.profile.emails_replied == 8


class ProfileUpdateAbuseMetricTest(ProfileTestCase):
    """Tests for Profile.update_abuse_metric()"""

    def setUp(self) -> None:
        super().setUp()
        self.get_or_create_social_account()
        self.abuse_metric = baker.make(AbuseMetrics, user=self.profile.user)

        patcher_logger = patch("emails.models.abuse_logger.info")
        self.mocked_abuse_info = patcher_logger.start()
        self.addCleanup(patcher_logger.stop)

        # Selectively patch datatime.now() for emails models
        # https://docs.python.org/3/library/unittest.mock-examples.html#partial-mocking
        patcher = patch("emails.models.datetime")
        mocked_datetime = patcher.start()
        self.addCleanup(patcher.stop)

        self.expected_now = datetime.now(timezone.utc)
        mocked_datetime.combine.return_value = datetime.combine(
            datetime.now(timezone.utc).date(), datetime.min.time()
        )
        mocked_datetime.now.return_value = self.expected_now
        mocked_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

    @override_settings(MAX_FORWARDED_PER_DAY=5)
    def test_flags_profile_when_emails_forwarded_abuse_threshold_met(self) -> None:
        self.abuse_metric.num_email_forwarded_per_day = 4
        self.abuse_metric.save()
        assert self.profile.last_account_flagged is None

        self.profile.update_abuse_metric(email_forwarded=True)
        self.abuse_metric.refresh_from_db()

        self.mocked_abuse_info.assert_called_once_with(
            "Abuse flagged",
            extra={
                "uid": self.profile.fxa.uid,
                "flagged": self.expected_now.timestamp(),
                "replies": 0,
                "addresses": 0,
                "forwarded": 5,
                "forwarded_size_in_bytes": 0,
            },
        )
        assert self.abuse_metric.num_email_forwarded_per_day == 5
        assert self.profile.last_account_flagged == self.expected_now

    @override_settings(MAX_FORWARDED_EMAIL_SIZE_PER_DAY=100)
    def test_flags_profile_when_forwarded_email_size_abuse_threshold_met(self) -> None:
        self.abuse_metric.forwarded_email_size_per_day = 50
        self.abuse_metric.save()
        assert self.profile.last_account_flagged is None

        self.profile.update_abuse_metric(forwarded_email_size=50)
        self.abuse_metric.refresh_from_db()

        self.mocked_abuse_info.assert_called_once_with(
            "Abuse flagged",
            extra={
                "uid": self.profile.fxa.uid,
                "flagged": self.expected_now.timestamp(),
                "replies": 0,
                "addresses": 0,
                "forwarded": 0,
                "forwarded_size_in_bytes": 100,
            },
        )
        assert self.abuse_metric.forwarded_email_size_per_day == 100
        assert self.profile.last_account_flagged == self.expected_now


class DomainAddressTest(TestCase):
    def setUp(self):
        self.subdomain = "test"
        self.user = make_premium_test_user()
        self.storageless_user = make_storageless_test_user()
        self.user_profile = self.user.profile
        self.user_profile.subdomain = self.subdomain
        self.user_profile.save()

    def test_make_domain_address_assigns_to_user(self):
        domain_address = DomainAddress.make_domain_address(
            self.user_profile, "test-assigns"
        )
        assert domain_address.user == self.user

    @skip(reason="test not reliable, look at FIXME comment")
    def test_make_domain_address_makes_different_addresses(self):
        # FIXME: sometimes this test will fail because it randomly generates
        # alias with bad words. See make_domain_address for why this has
        # not been fixed yet
        for i in range(5):
            domain_address = DomainAddress.make_domain_address(
                self.user_profile, "test-different-%s" % i
            )
            assert domain_address.first_emailed_at is None
        domain_addresses = DomainAddress.objects.filter(user=self.user).values_list(
            "address", flat=True
        )
        # checks that there are 5 unique DomainAddress
        assert len(set(domain_addresses)) == 5

    def test_make_domain_address_makes_requested_address(self):
        domain_address = DomainAddress.make_domain_address(self.user_profile, "foobar")
        assert domain_address.address == "foobar"
        assert domain_address.first_emailed_at is None

    @override_settings(MAX_ADDRESS_CREATION_PER_DAY=10)
    def test_make_domain_address_has_limit(self) -> None:
        for i in range(10):
            DomainAddress.make_domain_address(self.user_profile, "foobar" + str(i))
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(self.user_profile, "one-too-many")
        assert exc_info.value.get_codes() == "account_is_paused"
        domain_address_count = DomainAddress.objects.filter(
            user=self.user_profile.user
        ).count()
        assert domain_address_count == 10

    def test_make_domain_address_makes_requested_address_via_email(self):
        domain_address = DomainAddress.make_domain_address(
            self.user_profile, "foobar", True
        )
        assert domain_address.address == "foobar"
        assert domain_address.first_emailed_at is not None

    def test_make_domain_address_non_premium_user(self) -> None:
        non_premium_user_profile = baker.make(User).profile
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(
                non_premium_user_profile, "test-non-premium"
            )
        assert exc_info.value.get_codes() == "free_tier_no_subdomain_masks"

    def test_make_domain_address_can_make_blocklisted_address(self):
        domain_address = DomainAddress.make_domain_address(self.user_profile, "testing")
        assert domain_address.address == "testing"

    def test_make_domain_address_valid_premium_user_with_no_subdomain(self) -> None:
        user = baker.make(User)
        baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data={"subscriptions": [unlimited_subscription()]},
        )
        user_profile = Profile.objects.get(user=user)
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(user_profile, "test-nosubdomain")
        assert exc_info.value.get_codes() == "need_subdomain"

    @patch.multiple("string", ascii_lowercase="a", digits="")
    def test_make_domain_address_makes_dupe_of_deleted(self):
        test_hash = address_hash("aaaaaaaaa", self.subdomain)
        DeletedAddress.objects.create(address_hash=test_hash)
        domain_address = DomainAddress.make_domain_address(self.user_profile)
        domain_address_hash = address_hash(
            domain_address.address,
            domain_address.user_profile.subdomain,
            domain_address.domain_value,
        )
        assert (
            DeletedAddress.objects.filter(address_hash=domain_address_hash).count() == 1
        )

    @patch("emails.models.address_default")
    def test_make_domain_address_doesnt_randomly_generate_bad_word(
        self, address_default_mocked
    ) -> None:
        address_default_mocked.return_value = "angry0123"
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(self.user_profile)
        assert exc_info.value.get_codes() == "address_unavailable"

    def test_delete_adds_deleted_address_object(self):
        domain_address = baker.make(DomainAddress, address="lower-case", user=self.user)
        domain_address_hash = sha256(
            domain_address.full_address.encode("utf-8")
        ).hexdigest()
        domain_address.delete()
        deleted_address_qs = DeletedAddress.objects.filter(
            address_hash=domain_address_hash
        )
        assert deleted_address_qs.count() == 1
        assert deleted_address_qs.first().address_hash == domain_address_hash

    def test_premium_user_can_set_block_list_emails(self):
        domain_address = DomainAddress.objects.create(
            user=self.user, address="lower-case"
        )
        assert domain_address.block_list_emails is False
        domain_address.block_list_emails = True
        domain_address.save()
        domain_address.refresh_from_db()
        assert domain_address.block_list_emails is True

    def test_formerly_premium_user_clears_block_list_emails(self):
        domain_address = DomainAddress.objects.create(
            user=self.user, address="coupons", block_list_emails=True
        )
        domain_address.refresh_from_db()
        assert domain_address.block_list_emails is True

        # Remove premium from user
        fxa_account = self.user.profile.fxa
        fxa_account.extra_data["subscriptions"] = []
        fxa_account.save()
        assert not self.user.profile.has_premium

        domain_address.save()
        assert domain_address.block_list_emails is False

    def test_storageless_user_cant_set_labels(self):
        domain_address = DomainAddress.objects.create(
            user=self.storageless_user, address="lower-case"
        )
        assert domain_address.description == ""
        domain_address.description = "Arbitrary description"
        domain_address.save()
        domain_address.refresh_from_db()
        assert domain_address.description == ""
