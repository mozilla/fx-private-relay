from datetime import datetime, timedelta, timezone
from hashlib import sha256
import random
from unittest import skip
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase

from allauth.socialaccount.models import SocialAccount

from model_bakery import baker

from ..models import (
    address_hash,
    CannotMakeAddressException,
    CannotMakeSubdomainException,
    DeletedAddress,
    DomainAddress,
    has_bad_words,
    NOT_PREMIUM_USER_ERR_MSG,
    Profile,
    RelayAddress,
    TRY_DIFFERENT_VALUE_ERR_MSG,
)


class MiscEmailModelsTest(TestCase):
    def test_has_bad_words_with_bad_words(self):
        assert has_bad_words('angry')

    def test_has_bad_words_without_bad_words(self):
        assert not has_bad_words('happy')

    def test_address_hash_without_subdomain(self):
        address = 'aaaaaaaaa'
        expected_hash = sha256(f'{address}'.encode('utf-8')).hexdigest()
        assert address_hash(address) == expected_hash

    def test_address_hash_with_subdomain(self):
        address = 'aaaaaaaaa'
        subdomain = 'test'
        expected_hash = sha256(f'{address}@{subdomain}'.encode('utf-8')).hexdigest()
        assert address_hash(address, subdomain) == expected_hash


class RelayAddressTest(TestCase):
    def setUp(self):
        user = baker.make(User)
        self.user_profile = Profile.objects.get(user=user)

        # premium user
        self.premium_user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=self.premium_user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        self.premium_user_profile = Profile.objects.get(user=self.premium_user)

    def test_make_relay_address_assigns_to_user(self):
        relay_address = RelayAddress.make_relay_address(self.user_profile)
        assert relay_address.user == self.user_profile.user

    def test_make_relay_address_makes_different_addresses(self):
        for i in range(1000):
            RelayAddress.make_relay_address(self.premium_user_profile)
        # check that the address is unique (deeper assertion that the generated aliases are unique)
        relay_addresses = RelayAddress.objects.filter(
            user=self.premium_user
        ).values_list("address", flat=True)
        assert len(set(relay_addresses)) == 1000

    def test_make_relay_address_premium_user_can_exceed_limit(self):
        for i in range(settings.MAX_NUM_FREE_ALIASES + 1):
            RelayAddress.make_relay_address(self.premium_user_profile)
        relay_addresses = RelayAddress.objects.filter(
            user=self.premium_user
        ).values_list("address", flat=True)
        assert len(relay_addresses) == settings.MAX_NUM_FREE_ALIASES + 1

    def test_make_relay_address_non_premium_user_cannot_pass_limit(self):
        try:
            for i in range(settings.MAX_NUM_FREE_ALIASES + 1):
                RelayAddress.make_relay_address(self.user_profile)
        except CannotMakeAddressException as e:
            assert e.message == NOT_PREMIUM_USER_ERR_MSG.format(
                f'make more than {settings.MAX_NUM_FREE_ALIASES} aliases'
            )
            relay_addresses = RelayAddress.objects.filter(
                user=self.user_profile.user
            ).values_list("address", flat=True)
            assert len(relay_addresses) == settings.MAX_NUM_FREE_ALIASES
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_delete_adds_deleted_address_object(self):
        relay_address = baker.make(RelayAddress)
        address_hash = sha256(
            relay_address.address.encode('utf-8')
        ).hexdigest()
        relay_address.delete()
        deleted_count = DeletedAddress.objects.filter(
            address_hash=address_hash
        ).count()
        assert deleted_count == 1

    # trigger a collision by making address_default always return 'aaaaaaaaa'
    @patch.multiple('string', ascii_lowercase='a', digits='')
    def test_make_relay_address_doesnt_make_dupe_of_deleted(self):
        test_hash = sha256('aaaaaaaaa'.encode('utf-8')).hexdigest()
        DeletedAddress.objects.create(address_hash=test_hash)
        try:
            RelayAddress.make_relay_address(self.user_profile)
        except CannotMakeAddressException:
            return
        self.fail("Should have raise CannotMakeAddressException")


class ProfileTest(TestCase):
    def setUp(self):
        self.profile = baker.make(Profile)

    def test_bounce_paused_no_bounces(self):
        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused == False
        assert bounce_type == ''

    def test_bounce_paused_hard_bounce_pending(self):
        self.profile.last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.save()

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused == True
        assert bounce_type == 'hard'

    def test_bounce_paused_soft_bounce_pending(self):
        self.profile.last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.save()

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused == True
        assert bounce_type == 'soft'

    def test_bounce_paused_hardd_and_soft_bounce_pending_shows_hard(self):
        self.profile.last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.save()
        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused == True
        assert bounce_type == 'hard'

    def test_bounce_paused_hard_bounce_over_resets_timer(self):
        self.profile.last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS+1)
        )
        self.profile.save()

        assert self.profile.last_hard_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused == False
        assert bounce_type == ''
        assert self.profile.last_hard_bounce == None

    def test_bounce_paused_soft_bounce_over_resets_timer(self):
        self.profile.last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS+1)
        )
        self.profile.save()

        assert self.profile.last_soft_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused == False
        assert bounce_type == ''
        assert self.profile.last_soft_bounce == None

    def test_next_email_try_no_bounces_returns_today(self):
        assert (
            self.profile.next_email_try.date() ==
            datetime.now(timezone.utc).date()
        )

    def test_next_email_try_hard_bounce_returns_proper_datemath(self):
        last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        expected_next_try_date = last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        assert (
            self.profile.next_email_try.date() == expected_next_try_date.date()
        )

    def test_next_email_try_soft_bounce_returns_proper_datemath(self):
        last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_soft_bounce = last_soft_bounce
        self.profile.save()

        expected_next_try_date = last_soft_bounce + timedelta(
            days=settings.SOFT_BOUNCE_ALLOWED_DAYS
        )
        assert (
            self.profile.next_email_try.date() == expected_next_try_date.date()
        )

    def test_next_email_try_hard_and_soft_bounce_returns_hard_datemath(self):
        last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_soft_bounce = last_soft_bounce
        last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        expected_next_try_date = last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        assert (
            self.profile.next_email_try.date() == expected_next_try_date.date()
        )

    def test_last_bounce_date_no_bounces_returns_None(self):
        assert self.profile.last_bounce_date == None

    def test_last_bounce_date_soft_bounce_returns_its_date(self):
        last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_soft_bounce = last_soft_bounce
        self.profile.save()

        assert self.profile.last_bounce_date == self.profile.last_soft_bounce

    def test_last_bounce_date_hard_bounce_returns_its_date(self):
        last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        assert self.profile.last_bounce_date == self.profile.last_hard_bounce

    def test_last_bounce_date_hard_and_soft_bounces_returns_hard_date(self):
        last_soft_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_soft_bounce = last_soft_bounce
        last_hard_bounce = (
            datetime.now(timezone.utc) -
            timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS-1)
        )
        self.profile.last_hard_bounce = last_hard_bounce
        self.profile.save()

        assert self.profile.last_bounce_date == self.profile.last_hard_bounce

    def test_has_unlimited_default_False(self):
        assert self.profile.has_unlimited == False

    def test_has_unlimited_with_unlimited_subsription_returns_True(self):
        premium_user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=premium_user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        premium_profile = baker.make(Profile, user=premium_user)
        assert premium_profile.has_unlimited == True

    def test_add_subdomain_to_new_unlimited_profile(self):
        subdomain = 'test'
        premium_user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=premium_user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        premium_profile = Profile.objects.get(user=premium_user)
        assert premium_profile.add_subdomain(subdomain) == subdomain

    def test_add_subdomain_to_non_premium_user_raises_exception(self):
        subdomain = 'test'
        non_premium_profile = baker.make(Profile)
        try:
            non_premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == NOT_PREMIUM_USER_ERR_MSG.format('set a subdomain')
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_add_subdomain_to_unlimited_profile_with_subdomain_raises_exception(self):
        subdomain = 'test'
        premium_user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=premium_user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        premium_profile = Profile.objects.get(user=premium_user)
        premium_profile.subdomain = subdomain
        premium_profile.save()

        try:
            premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == 'You cannot change your subdomain.'
            return
        self.fail("Should have raised CannotMakeSubdomainException")

    def test_add_subdomain_to_unlimited_profile_with_badword_subdomain_raises_exception(self):
        subdomain = 'angry'
        premium_user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=premium_user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        premium_profile = Profile.objects.get(user=premium_user)

        try:
            premium_profile.add_subdomain(subdomain)
        except CannotMakeSubdomainException as e:
            assert e.message == TRY_DIFFERENT_VALUE_ERR_MSG.format('Subdomain')
            return
        self.fail("Should have raised CannotMakeSubdomainException")


class DomainAddressTest(TestCase):
    def setUp(self):
        self.subdomain = 'test'
        self.user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=self.user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        # get rather than create profile since profile is auto-generated
        # when user is created
        self.user_profile = Profile.objects.get(user=self.user)
        self.user_profile.subdomain = self.subdomain
        self.user_profile.save()

    def test_make_domain_address_assigns_to_user(self):
        domain_address = DomainAddress.make_domain_address(self.user_profile)
        assert domain_address.user == self.user

    @skip(reason="test not reliable, look at FIXME comment")
    def test_make_domain_address_makes_different_addresses(self):
        # FIXME: sometimes this test will fail because it randomly generates
        # alias with bad words. See make_domain_address for why this has
        # not been fixed yet
        for i in range(5):
            domain_address = DomainAddress.make_domain_address(self.user_profile)
            assert domain_address.first_emailed_at is None
        domain_addresses = DomainAddress.objects.filter(
            user=self.user
        ).values_list("address", flat=True)
        # checks that there are 5 unique DomainAddress
        assert len(set(domain_addresses)) == 5

    def test_make_domain_address_makes_requested_address(self):
        domain_address = DomainAddress.make_domain_address(self.user_profile, 'testing')
        assert domain_address.address == 'testing'
        assert domain_address.first_emailed_at is None

    def test_make_domain_address_makes_requested_address_via_email(self):
        domain_address = DomainAddress.make_domain_address(self.user_profile, 'testing', True)
        assert domain_address.address == 'testing'
        assert domain_address.first_emailed_at is not None

    def test_make_domain_address_non_premium_user(self):
        non_preimum_user_profile = baker.make(Profile)
        try:
            DomainAddress.make_domain_address(non_preimum_user_profile)
        except CannotMakeAddressException as e:
            assert e.message == NOT_PREMIUM_USER_ERR_MSG.format('create subdomain aliases')
            return
        self.fail("Should have raise CannotMakeAddressException")

    def test_make_domain_address_valid_premium_user_with_no_subdomain(self):
        user = baker.make(User)
        random_sub = random.choice(
            settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(',')
        )
        baker.make(
            SocialAccount,
            user=user,
            provider='fxa',
            extra_data={'subscriptions': [random_sub]}
        )
        user_profile = Profile.objects.get(user=user)
        try:
            DomainAddress.make_domain_address(user_profile)
        except CannotMakeAddressException as e:
            excpected_err_msg = (
                'You must select a subdomain before creating email address with subdomain.'
            )
            assert e.message == excpected_err_msg
            return
        self.fail("Should have raise CannotMakeAddressException")

    @patch.multiple('string', ascii_lowercase='a', digits='')
    def test_make_domain_address_doesnt_make_dupe_of_deleted(self):
        test_hash = address_hash('aaaaaaaaa', self.subdomain)
        DeletedAddress.objects.create(address_hash=test_hash)
        try:
            DomainAddress.make_domain_address(self.user_profile)
        except CannotMakeAddressException as e:
            assert e.message == TRY_DIFFERENT_VALUE_ERR_MSG.format('Email address with subdomain')
            return
        self.fail("Should have raise CannotMakeAddressException")

    @patch('emails.models.address_default')
    def test_make_domain_address_doesnt_randomly_generate_bad_word(self, address_default_mocked):
        address_default_mocked.return_value = 'angry0123'
        try:
            DomainAddress.make_domain_address(self.user_profile)
        except CannotMakeAddressException as e:
            assert e.message == TRY_DIFFERENT_VALUE_ERR_MSG.format('Email address with subdomain')
            return
        self.fail("Should have raise CannotMakeAddressException")

    def test_delete_adds_deleted_address_object(self):
        domain_address = baker.make(DomainAddress, user=self.user)
        domain_address_hash = sha256(
            f'{domain_address}@{self.subdomain}'.encode('utf-8')
        ).hexdigest()
        domain_address.delete()
        deleted_address_qs = DeletedAddress.objects.filter(
            address_hash=domain_address_hash
        )
        assert deleted_address_qs.count() == 1
        assert deleted_address_qs.first().address_hash == domain_address_hash
