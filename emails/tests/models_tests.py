from datetime import datetime, timedelta, timezone
from hashlib import sha256
import random
from unittest import skip
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import SuspiciousOperation
from django.test import (
    override_settings,
    TestCase,
)

from allauth.socialaccount.models import SocialAccount

from model_bakery import baker

from ..models import (
    address_hash,
    ACCOUNT_PAUSED_ERR_MSG,
    CannotMakeAddressException,
    CannotMakeSubdomainException,
    DeletedAddress,
    DomainAddress,
    get_domains_from_settings,
    get_domain_numerical,
    has_bad_words,
    hash_subdomain,
    is_blocklisted,
    NOT_PREMIUM_USER_ERR_MSG,
    Profile,
    RegisteredSubdomain,
    RelayAddress,
    TRY_DIFFERENT_VALUE_ERR_MSG,
    valid_available_subdomain,
    valid_address,
    valid_address_pattern,
)


def make_free_test_user():
    user = baker.make(User)
    user_profile = Profile.objects.get(user=user)
    user_profile.server_storage = True
    user_profile.save()
    baker.make(
        SocialAccount, user=user, provider="fxa", extra_data={"avatar": "avatar.png"}
    )
    return user


def make_premium_test_user():
    # premium user
    premium_user = baker.make(User)
    premium_user_profile = Profile.objects.get(user=premium_user)
    premium_user_profile.server_storage = True
    premium_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    premium_user_profile.save()
    upgrade_test_user_to_premium(premium_user)
    return premium_user


def make_storageless_test_user():
    storageless_user = baker.make(User)
    storageless_user_profile = Profile.objects.get(user=storageless_user)
    storageless_user_profile.server_storage = False
    storageless_user_profile.subdomain = "mydomain"
    storageless_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    storageless_user_profile.save()
    upgrade_test_user_to_premium(storageless_user)
    return storageless_user


def upgrade_test_user_to_premium(user):
    random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
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
    def test_address_hash_without_subdomain_domain_not_firefox(self):
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
        self.user_profile = self.user.profile_set.first()
        self.premium_user = make_premium_test_user()
        self.premium_user_profile = self.premium_user.profile_set.first()
        self.storageless_user = make_storageless_test_user()

    def test_create_assigns_to_user(self):
        relay_address = RelayAddress.objects.create(user=self.user_profile.user)
        assert relay_address.user == self.user_profile.user

    @override_settings(MAX_NUM_FREE_ALIASES=5, MAX_ADDRESS_CREATION_PER_DAY=10)
    def test_create_has_limit(self):
        try:
            for i in range(100):
                RelayAddress.objects.create(user=self.premium_user_profile.user)
        except CannotMakeAddressException as e:
            relay_address_count = RelayAddress.objects.filter(
                user=self.premium_user_profile.user
            ).count()
            assert e.message == ACCOUNT_PAUSED_ERR_MSG
            assert relay_address_count == 10
            return
        self.fail("Should have raised CannotMakeAddressException")

    def test_create_premium_user_can_exceed_free_limit(self):
        for i in range(settings.MAX_NUM_FREE_ALIASES + 1):
            RelayAddress.objects.create(user=self.premium_user_profile.user)
        relay_addresses = RelayAddress.objects.filter(
            user=self.premium_user
        ).values_list("address", flat=True)
        assert len(relay_addresses) == settings.MAX_NUM_FREE_ALIASES + 1

    def test_create_non_premium_user_cannot_pass_free_limit(self):
        try:
            for i in range(settings.MAX_NUM_FREE_ALIASES + 1):
                RelayAddress.objects.create(user=self.user_profile.user)
        except CannotMakeAddressException as e:
            assert e.message == NOT_PREMIUM_USER_ERR_MSG.format(
                f"make more than {settings.MAX_NUM_FREE_ALIASES} aliases"
            )
            relay_addresses = RelayAddress.objects.filter(
                user=self.user_profile.user
            ).values_list("address", flat=True)
            assert len(relay_addresses) == settings.MAX_NUM_FREE_ALIASES
            return
        self.fail("Should have raised CannotMakeSubdomainException")

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
        with self.assertRaises(SuspiciousOperation):
            relay_address.block_list_emails = True
            relay_address.save()
        relay_address.refresh_from_db()
        assert relay_address.block_list_emails == False

    def test_premium_user_can_set_block_list_emails(self):
        relay_address = RelayAddress.objects.create(user=self.premium_user)
        assert relay_address.block_list_emails == False
        relay_address.block_list_emails = True
        relay_address.save()
        relay_address.refresh_from_db()
        assert relay_address.block_list_emails == True

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


class ProfileTest(TestCase):
    def setUp(self):
        self.profile = baker.make(Profile)
        self.profile.server_storage = True
        self.profile.save()

    def test_bounce_paused_no_bounces(self):
        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""

    def test_bounce_paused_hard_bounce_pending(self):
        self.profile.last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.save()

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is True
        assert bounce_type == "hard"

    def test_bounce_paused_soft_bounce_pending(self):
        self.profile.last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.save()

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is True
        assert bounce_type == "soft"

    def test_bounce_paused_hardd_and_soft_bounce_pending_shows_hard(self):
        self.profile.last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.save()
        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is True
        assert bounce_type == "hard"

    def test_bounce_paused_hard_bounce_over_resets_timer(self):
        self.profile.last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS + 1
        )
        self.profile.save()

        assert self.profile.last_hard_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""
        assert self.profile.last_hard_bounce is None

    def test_bounce_paused_soft_bounce_over_resets_timer(self):
        self.profile.last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS + 1
        )
        self.profile.save()

        assert self.profile.last_soft_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""
        assert self.profile.last_soft_bounce is None

    def test_next_email_try_no_bounces_returns_today(self):
        assert self.profile.next_email_try.date() == datetime.now(timezone.utc).date()

    def test_next_email_try_hard_bounce_returns_proper_datemath(self):
        last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        expected_next_try_date = last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        assert self.profile.next_email_try.date() == expected_next_try_date.date()

    def test_next_email_try_soft_bounce_returns_proper_datemath(self):
        last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_soft_bounce = last_soft_bounce
        self.profile.save()

        expected_next_try_date = last_soft_bounce + timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS
        )
        assert self.profile.next_email_try.date() == expected_next_try_date.date()

    def test_next_email_try_hard_and_soft_bounce_returns_hard_datemath(self):
        last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_soft_bounce = last_soft_bounce
        last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        expected_next_try_date = last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        assert self.profile.next_email_try.date() == expected_next_try_date.date()

    def test_last_bounce_date_no_bounces_returns_None(self):
        assert self.profile.last_bounce_date is None

    def test_last_bounce_date_soft_bounce_returns_its_date(self):
        last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_soft_bounce = last_soft_bounce
        self.profile.save()

        assert self.profile.last_bounce_date == self.profile.last_soft_bounce

    def test_last_bounce_date_hard_bounce_returns_its_date(self):
        last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        assert self.profile.last_bounce_date == self.profile.last_hard_bounce

    def test_last_bounce_date_hard_and_soft_bounces_returns_hard_date(self):
        last_soft_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_soft_bounce = last_soft_bounce
        last_hard_bounce = datetime.now(timezone.utc) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS - 1
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        assert self.profile.last_bounce_date == self.profile.last_hard_bounce

    def test_has_premium_default_False(self):
        assert self.profile.has_premium is False

    def test_has_phone_default_False(self):
        assert self.profile.has_phone is False

    def test_has_premium_with_unlimited_subscription_returns_True(self):
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = baker.make(Profile, user=premium_user)
        assert premium_profile.has_premium is True

    def test_add_subdomain_to_new_unlimited_profile(self):
        subdomain = "newpremium"
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        assert premium_profile.add_subdomain(subdomain) == subdomain

    def test_setting_direct_Profile_subdomain_lowercases_subdomain_value(self):
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        premium_profile.subdomain = "mIxEdcAsE"
        premium_profile.save()
        assert premium_profile.subdomain == "mixedcase"

    def test_add_subdomain_lowercases_subdomain_value(self):
        subdomain = "mIxEdcAsE"
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        assert premium_profile.add_subdomain(subdomain) == "mixedcase"

    def test_add_subdomain_to_non_premium_user_raises_exception(self):
        subdomain = "test"
        non_premium_profile = baker.make(Profile)
        try:
            non_premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == "error-premium-set-subdomain"
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_add_subdomain_to_unlimited_profile_with_subdomain_raises_exception(self):
        subdomain = "test"
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        premium_profile.subdomain = subdomain
        premium_profile.save()

        try:
            premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == "error-premium-cannot-change-subdomain"
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_add_subdomain_to_unlimited_profile_with_badword_subdomain_raises_exception(
        self,
    ):
        subdomain = "angry"
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)

        try:
            premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == "error-subdomain-not-available"
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_add_subdomain_to_unlimited_profile_with_blocked_word_subdomain_raises_exception(
        self,
    ):
        subdomain = "mozilla"
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)

        try:
            premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == "error-subdomain-not-available"
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_subdomain_available_bad_word_returns_False(self):
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("angry")

    def test_subdomain_available_blocked_word_returns_False(self):
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("mozilla")

    def test_subdomain_available_taken_returns_False(self):
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        premium_profile.add_subdomain("thisisfine")
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("thisisfine")

    def test_subdomain_available_taken_returns_False_case_insensitive(self):
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        premium_profile.add_subdomain("thIsIsfInE")
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("THiSiSFiNe")

    def test_valid_available_subdomain_taken_returns_False_for_inactive_subdomain(self):
        # subdomains registered in now deleted profiles are considered
        # inactive subdomains
        premium_user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=premium_user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        premium_profile = Profile.objects.get(user=premium_user)
        premium_profile.add_subdomain("thisisfine")
        premium_user.delete()

        registered_subdomain_count = RegisteredSubdomain.objects.filter(
            subdomain_hash=hash_subdomain("thisisfine")
        ).count()
        assert Profile.objects.filter(subdomain="thisisfine").count() == 0
        assert registered_subdomain_count == 1
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("thisisfine")

    def test_subdomain_available_with_space_returns_False(self):
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("my domain")

    def test_subdomain_available_with_special_char_returns_False(self):
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("my@domain")

    def test_subdomain_available_with_dash_returns_True(self):
        assert valid_available_subdomain("my-domain") == True

    def test_subdomain_available_with_dash_at_front_returns_False(self):
        with self.assertRaises(CannotMakeSubdomainException):
            valid_available_subdomain("-mydomain")

    def test_display_name_exists(self):
        display_name = "Display Name"
        social_account = baker.make(
            SocialAccount, provider="fxa", extra_data={"displayName": display_name}
        )
        profile = Profile.objects.get(user=social_account.user)
        assert profile.display_name == display_name

    def test_display_name_does_not_exist(self):
        social_account = baker.make(SocialAccount, provider="fxa", extra_data={})
        profile = Profile.objects.get(user=social_account.user)
        assert profile.display_name is None

    def test_save_server_storage_true_doesnt_delete_data(self):
        test_desc = "test description"
        test_generated_for = "secret.com"
        test_used_on = "secret.com"
        relay_address = baker.make(
            RelayAddress,
            user=self.profile.user,
            description=test_desc,
            generated_for=test_generated_for,
            used_on=test_used_on,
        )
        self.profile.server_storage = True
        self.profile.save()

        assert relay_address.description == test_desc
        assert relay_address.generated_for == test_generated_for
        assert relay_address.used_on == test_used_on

    def test_save_server_storage_false_deletes_data(self):
        test_desc = "test description"
        test_generated_for = "secret.com"
        test_used_on = "secret.com"
        relay_address = baker.make(
            RelayAddress,
            user=self.profile.user,
            description=test_desc,
            generated_for=test_generated_for,
            used_on=test_used_on,
        )
        self.profile.server_storage = False
        self.profile.save()

        relay_address.refresh_from_db()
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on == ""

    def test_save_server_storage_false_deletes_ALL_data(self):
        test_desc = "test description"
        test_generated_for = "secret.com"
        baker.make(
            RelayAddress,
            user=self.profile.user,
            description=test_desc,
            generated_for=test_generated_for,
            _quantity=4,
        )
        self.profile.server_storage = False
        self.profile.save()

        for relay_address in RelayAddress.objects.filter(user=self.profile.user):
            assert relay_address.description == ""
            assert relay_address.generated_for == ""

    def test_save_server_storage_false_only_deletes_that_profiles_data(self):
        test_desc = "test description"
        test_generated_for = "secret.com"
        baker.make(
            RelayAddress,
            user=self.profile.user,
            description=test_desc,
            generated_for=test_generated_for,
            _quantity=4,
        )

        server_stored_data_profile = baker.make(Profile, server_storage=True)
        baker.make(
            RelayAddress,
            user=server_stored_data_profile.user,
            description=test_desc,
            generated_for=test_generated_for,
            _quantity=4,
        )

        self.profile.server_storage = False
        self.profile.save()

        for relay_address in RelayAddress.objects.filter(user=self.profile.user):
            assert relay_address.description == ""
            assert relay_address.generated_for == ""

        for relay_address in RelayAddress.objects.filter(
            user=server_stored_data_profile.user
        ):
            assert relay_address.description == test_desc
            assert relay_address.generated_for == test_generated_for

    def test_language_with_no_fxa_extra_data_locale_returns_default_en(self):
        baker.make(SocialAccount, user=self.profile.user, provider="fxa")
        assert self.profile.language == "en"

    def test_language_with_no_fxa_locale_returns_default_en(self):
        assert self.profile.language == "en"

    def test_language_with_fxa_locale_de_returns_de(self):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
            extra_data={"locale": "de,en-US;q=0.9,en;q=0.8"},
        )
        assert self.profile.language == "de"

    def test_locale_in_premium_country_returns_True_if_premium_available(self):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
            extra_data={"locale": "de-DE,en-xx;q=0.9,en;q=0.8"},
        )
        assert self.profile.fxa_locale_in_premium_country is True

    def test_locale_in_premium_country_returns_False_if_premium_unavailable(self):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
            extra_data={"locale": "en;q=0.8"},
        )
        assert self.profile.fxa_locale_in_premium_country is False

    def test_locale_in_premium_country_returns_True_if_premium_available_in_country_with_same_language_code(
        self,
    ):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
            extra_data={"locale": "de;q=0.8"},
        )
        assert self.profile.fxa_locale_in_premium_country is True

    def test_locale_in_premium_country_returns_False_if_premium_not_available_in_country_with_same_language_code(
        self,
    ):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
            extra_data={"locale": "xx;q=0.8"},
        )
        assert self.profile.fxa_locale_in_premium_country is False

    def test_locale_in_premium_country_returns_False_if_no_fxa_account(self):
        assert self.profile.fxa_locale_in_premium_country is False

    def test_user_joined_before_premium_release_returns_True(self):
        user = baker.make(
            User, date_joined=datetime.fromisoformat("2021-10-18 17:00:00+00:00")
        )
        profile = Profile.objects.get(user=user)
        assert profile.joined_before_premium_release

    def test_user_joined_before_premium_release_returns_False(self):
        user = baker.make(
            User, date_joined=datetime.fromisoformat("2021-10-28 17:00:00+00:00")
        )
        profile = Profile.objects.get(user=user)
        assert profile.joined_before_premium_release is False

    def test_user_created_after_premium_release_server_storage_True(self):
        user = baker.make(User)
        profile = Profile.objects.get(user=user)
        assert profile.server_storage

    def test_emails_replied_premium_user_aggregates_sum_of_replies_from_all_addresses(
        self,
    ):
        subdomain = "test"
        user = make_premium_test_user()
        user_profile = Profile.objects.get(user=user)
        user_profile.subdomain = subdomain
        user_profile.num_email_replied_in_deleted_address = 1
        user_profile.save()
        baker.make(RelayAddress, user=user, num_replied=3)
        baker.make(DomainAddress, user=user, address="lower-case", num_replied=5)

        assert user_profile.emails_replied == 9

    def test_emails_replied_user_aggregates_sum_of_replies_from_relay_addresses(self):
        baker.make(RelayAddress, user=self.profile.user, num_replied=3)
        baker.make(RelayAddress, user=self.profile.user, num_replied=5)

        assert self.profile.emails_replied == 8

    def test_emails_replied_new_user_aggregates_sum_of_replies_to_zero(self):
        assert self.profile.emails_replied == 0

    @patch("emails.signals.incr_if_enabled")
    @patch("emails.signals.info_logger.info")
    def test_remove_level_one_email_trackers_enabled_emits_metric_and_logs(
        self, mocked_events_info, mocked_incr
    ):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
        )
        self.profile.remove_level_one_email_trackers = True
        self.profile.save()

        expected_hashed_uid = sha256(self.profile.fxa.uid.encode("utf-8")).hexdigest()
        mocked_incr.assert_called_once_with("tracker_removal_enabled")
        mocked_events_info.assert_called_once_with(
            "tracker_removal_feature",
            extra={
                "enabled": True,
                "hashed_uid": expected_hashed_uid,
            },
        )

    @patch("emails.signals.incr_if_enabled")
    @patch("emails.signals.info_logger.info")
    def test_remove_level_one_email_trackers_disabled_emits_metric_and_logs(
        self, mocked_events_info, mocked_incr
    ):
        profile = baker.make(Profile, remove_level_one_email_trackers=True)
        baker.make(
            SocialAccount,
            user=profile.user,
            provider="fxa",
        )
        profile.remove_level_one_email_trackers = False
        profile.save()

        expected_hashed_uid = sha256(profile.fxa.uid.encode("utf-8")).hexdigest()
        mocked_incr.assert_called_once_with("tracker_removal_disabled")
        mocked_events_info.assert_called_once_with(
            "tracker_removal_feature",
            extra={
                "enabled": False,
                "hashed_uid": expected_hashed_uid,
            },
        )

    @patch("emails.signals.incr_if_enabled")
    @patch("emails.signals.info_logger.info")
    def test_remove_level_one_email_trackers_unchanged_does_not_emit_metric_and_logs(
        self, mocked_events_info, mocked_incr
    ):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
        )
        self.profile.remove_level_one_email_trackers = False
        self.profile.save()

        mocked_incr.assert_not_called()
        mocked_events_info.assert_not_called()

    @patch("emails.signals.incr_if_enabled")
    @patch("emails.signals.info_logger.info")
    def test_remove_level_one_email_trackers_unchanged_different_field_changed_does_not_emit_metric_and_logs(
        self, mocked_events_info, mocked_incr
    ):
        baker.make(
            SocialAccount,
            user=self.profile.user,
            provider="fxa",
        )
        self.profile.server_storage = False
        self.profile.save()

        mocked_incr.assert_not_called()
        mocked_events_info.assert_not_called()

    @patch("emails.signals.incr_if_enabled")
    @patch("emails.signals.info_logger.info")
    def test_profile_created_does_not_emit_metric_and_logs_from_measure_feature_usage_signal(
        self, mocked_events_info, mocked_incr
    ):
        baker.make(Profile)

        mocked_incr.assert_not_called()
        mocked_events_info.assert_not_called()


class DomainAddressTest(TestCase):
    def setUp(self):
        self.subdomain = "test"
        self.user = make_premium_test_user()
        self.storageless_user = make_storageless_test_user()
        # get rather than create profile since profile is auto-generated
        # when user is created
        self.user_profile = Profile.objects.get(user=self.user)
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
    def test_make_domain_address_has_limit(self):
        try:
            for i in range(100):
                DomainAddress.make_domain_address(self.user_profile, "foobar" + str(i))
        except CannotMakeAddressException as e:
            domain_address_count = DomainAddress.objects.filter(
                user=self.user_profile.user
            ).count()
            assert e.message == ACCOUNT_PAUSED_ERR_MSG
            assert domain_address_count == 10
            return
        self.fail("Should have raised CannotMakeAddressException")

    def test_make_domain_address_makes_requested_address_via_email(self):
        domain_address = DomainAddress.make_domain_address(
            self.user_profile, "foobar", True
        )
        assert domain_address.address == "foobar"
        assert domain_address.first_emailed_at is not None

    def test_make_domain_address_non_premium_user(self):
        non_premium_user_profile = baker.make(Profile)
        try:
            DomainAddress.make_domain_address(
                non_premium_user_profile, "test-non-premium"
            )
        except CannotMakeAddressException as e:
            assert e.message == NOT_PREMIUM_USER_ERR_MSG.format(
                "create subdomain aliases"
            )
            return
        self.fail("Should have raise CannotMakeAddressException")

    def test_make_domain_address_can_make_blocklisted_address(self):
        domain_address = DomainAddress.make_domain_address(self.user_profile, "testing")
        assert domain_address.address == "testing"

    def test_make_domain_address_valid_premium_user_with_no_subdomain(self):
        user = baker.make(User)
        random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(","))
        baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data={"subscriptions": [random_sub]},
        )
        user_profile = Profile.objects.get(user=user)
        try:
            DomainAddress.make_domain_address(user_profile, "test-nosubdomain")
        except CannotMakeAddressException as e:
            expected_err_msg = "You must select a subdomain before creating email address with subdomain."
            assert e.message == expected_err_msg
            return
        self.fail("Should have raise CannotMakeAddressException")

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
    ):
        address_default_mocked.return_value = "angry0123"
        try:
            DomainAddress.make_domain_address(self.user_profile)
        except CannotMakeAddressException as e:
            assert e.message == TRY_DIFFERENT_VALUE_ERR_MSG.format(
                "Domain address angry0123"
            )
            return
        self.fail("Should have raise CannotMakeAddressException")

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
        assert domain_address.block_list_emails == False
        domain_address.block_list_emails = True
        domain_address.save()
        domain_address.refresh_from_db()
        assert domain_address.block_list_emails == True

    def test_storageless_user_cant_set_labels(self):
        domain_address = DomainAddress.objects.create(
            user=self.storageless_user, address="lower-case"
        )
        assert domain_address.description == ""
        domain_address.description = "Arbitrary description"
        domain_address.save()
        domain_address.refresh_from_db()
        assert domain_address.description == ""
