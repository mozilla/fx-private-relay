from datetime import UTC, datetime
from hashlib import sha256
from unittest import skip
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from waffle.testutils import override_flag

from privaterelay.tests.utils import (
    make_free_test_user,
    make_premium_test_user,
    make_storageless_test_user,
    premium_subscription,
)

from ..apps import BadWords
from ..exceptions import (
    CannotMakeAddressException,
    DomainAddrDuplicateException,
    DomainAddrUnavailableException,
)
from ..models import (
    DeletedAddress,
    DomainAddress,
    RelayAddress,
    address_hash,
    get_domain_numerical,
)
from ..utils import get_domains_from_settings

if settings.PHONES_ENABLED:
    pass


class AddressHashTest(TestCase):
    @override_settings(RELAY_FIREFOX_DOMAIN="firefox.com")
    def test_address_hash_without_subdomain_domain_firefox(self):
        address = "aaaaaaaaa"
        expected_hash = sha256(f"{address}".encode()).hexdigest()
        assert address_hash(address, domain="firefox.com") == expected_hash

    @override_settings(RELAY_FIREFOX_DOMAIN="firefox.com")
    def test_address_hash_without_subdomain_domain_not_firefoxz(self):
        non_default = "test.com"
        address = "aaaaaaaaa"
        expected_hash = sha256(f"{address}@{non_default}".encode()).hexdigest()
        assert address_hash(address, domain=non_default) == expected_hash

    def test_address_hash_with_subdomain(self):
        address = "aaaaaaaaa"
        subdomain = "test"
        domain = get_domains_from_settings().get("MOZMAIL_DOMAIN")
        expected_hash = sha256(f"{address}@{subdomain}.{domain}".encode()).hexdigest()
        assert address_hash(address, subdomain, domain) == expected_hash

    def test_address_hash_with_additional_domain(self):
        address = "aaaaaaaaa"
        test_domain = "test.com"
        expected_hash = sha256(f"{address}@{test_domain}".encode()).hexdigest()
        assert address_hash(address, domain=test_domain) == expected_hash


class GetDomainNumericalTest(TestCase):
    def test_get_domain_numerical(self):
        assert get_domain_numerical("default.com") == 1
        assert get_domain_numerical("test.com") == 2


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

    def test_create_updates_profile_last_engagement(self) -> None:
        relay_address = baker.make(RelayAddress, user=self.user, enabled=True)
        profile = relay_address.user.profile
        profile.refresh_from_db()
        assert profile.last_engagement
        pre_create_last_engagement = profile.last_engagement

        baker.make(RelayAddress, user=self.user, enabled=True)

        profile.refresh_from_db()
        assert profile.last_engagement > pre_create_last_engagement

    def test_save_does_not_update_profile_last_engagement(self) -> None:
        relay_address = baker.make(RelayAddress, user=self.user, enabled=True)
        profile = relay_address.user.profile
        profile.refresh_from_db()
        assert profile.last_engagement
        pre_save_last_engagement = profile.last_engagement

        relay_address.enabled = False
        relay_address.save()

        profile.refresh_from_db()
        assert profile.last_engagement == pre_save_last_engagement

    def test_delete_updates_profile_last_engagement(self) -> None:
        relay_address = baker.make(RelayAddress, user=self.user)
        profile = relay_address.user.profile
        profile.refresh_from_db()
        assert profile.last_engagement
        pre_delete_last_engagement = profile.last_engagement

        relay_address.delete()

        profile.refresh_from_db()
        assert profile.last_engagement > pre_delete_last_engagement

    def test_delete_adds_deleted_address_object(self):
        relay_address = baker.make(RelayAddress, user=self.user)
        address_hash = sha256(relay_address.full_address.encode("utf-8")).hexdigest()
        relay_address.delete()
        deleted_count = DeletedAddress.objects.filter(address_hash=address_hash).count()
        assert deleted_count == 1

    def test_delete_mozmail_deleted_address_object(self):
        relay_address = baker.make(RelayAddress, domain=2, user=self.user)
        address_hash = sha256(
            f"{relay_address.address}@{relay_address.domain_value}".encode()
        ).hexdigest()
        relay_address.delete()
        deleted_count = DeletedAddress.objects.filter(address_hash=address_hash).count()
        assert deleted_count == 1

    def test_delete_increments_values_on_profile(self):
        assert self.premium_user_profile.num_address_deleted == 0
        assert self.premium_user_profile.num_email_forwarded_in_deleted_address == 0
        assert self.premium_user_profile.num_email_blocked_in_deleted_address == 0
        assert (
            self.premium_user_profile.num_level_one_trackers_blocked_in_deleted_address
            == 0
        )
        assert self.premium_user_profile.num_email_replied_in_deleted_address == 0
        assert self.premium_user_profile.num_email_spam_in_deleted_address == 0
        assert self.premium_user_profile.num_deleted_relay_addresses == 0
        assert self.premium_user_profile.num_deleted_domain_addresses == 0

        relay_address = baker.make(
            RelayAddress,
            user=self.premium_user,
            num_forwarded=2,
            num_blocked=3,
            num_level_one_trackers_blocked=4,
            num_replied=5,
            num_spam=6,
        )
        relay_address.delete()

        self.premium_user_profile.refresh_from_db()
        assert self.premium_user_profile.num_address_deleted == 1
        assert self.premium_user_profile.num_email_forwarded_in_deleted_address == 2
        assert self.premium_user_profile.num_email_blocked_in_deleted_address == 3
        assert (
            self.premium_user_profile.num_level_one_trackers_blocked_in_deleted_address
            == 4
        )
        assert self.premium_user_profile.num_email_replied_in_deleted_address == 5
        assert self.premium_user_profile.num_email_spam_in_deleted_address == 6
        assert self.premium_user_profile.num_deleted_relay_addresses == 1
        assert self.premium_user_profile.num_deleted_domain_addresses == 0

    def test_relay_address_create_repeats_deleted_address_invalid(self):
        user = baker.make(User)
        address = "random-address"
        relay_address = RelayAddress.objects.create(user=user, address=address)
        relay_address.delete()
        repeat_deleted_relay_address = RelayAddress.objects.create(
            user=user, address=address
        )
        assert not repeat_deleted_relay_address.address == address

    @patch("emails.validators.badwords", return_value=BadWords(short=set(), long=[]))
    @patch("emails.validators.blocklist", return_value=set(["blocked-word"]))
    def test_address_contains_blocklist_invalid(
        self, mock_blocklist: Mock, mock_badwords: Mock
    ) -> None:
        blocked_word = "blocked-word"
        relay_address = RelayAddress.objects.create(
            user=baker.make(User), address=blocked_word
        )
        assert not relay_address.address == blocked_word

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
        assert (fxa_account := self.premium_user.profile.fxa) is not None
        fxa_account.extra_data["subscriptions"] = []
        fxa_account.save()
        assert not self.premium_user.profile.has_premium

        relay_address.save()
        assert relay_address.block_list_emails is False

    def test_storageless_user_cant_set_label(self):
        relay_address = RelayAddress.objects.create(user=self.storageless_user)
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on in (None, "")
        relay_address.description = "Arbitrary description"
        relay_address.generated_for = "https://example.com"
        relay_address.used_on = "https://example.com"
        relay_address.save()
        relay_address.refresh_from_db()
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on in (None, "")

    def test_clear_storage_with_update_fields(self) -> None:
        """
        With update_fields, the stored data is still cleared for storageless users.
        """
        relay_address = RelayAddress.objects.create(user=self.storageless_user)
        assert relay_address.description == ""

        # Use QuerySet.update to avoid model save method
        RelayAddress.objects.filter(id=relay_address.id).update(
            description="the description",
            generated_for="https://example.com",
            used_on="https://example.com",
        )
        relay_address.refresh_from_db()
        assert relay_address.description == "the description"
        assert relay_address.generated_for == "https://example.com"
        assert relay_address.used_on == "https://example.com"

        # Update a different field with update_fields to avoid full model save
        new_last_used_at = datetime(2024, 1, 11, tzinfo=UTC)
        relay_address.last_used_at = new_last_used_at
        relay_address.save(update_fields={"last_used_at"})

        # Since .save() added to update_fields, the storage fields are cleared
        relay_address.refresh_from_db()
        assert relay_address.last_used_at == new_last_used_at
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on in ("", None)

    def test_clear_block_list_emails_with_update_fields(self) -> None:
        """
        With update_fields, the block_list_emails flag is still cleared for free users.
        """
        relay_address = RelayAddress.objects.create(user=self.user)
        assert not relay_address.block_list_emails

        # Use QuerySet.update to avoid model save method
        RelayAddress.objects.filter(id=relay_address.id).update(block_list_emails=True)
        relay_address.refresh_from_db()
        assert relay_address.block_list_emails

        # Update a different field with update_fields to avoid full model save
        new_last_used_at = datetime(2024, 1, 12, tzinfo=UTC)
        relay_address.last_used_at = new_last_used_at
        relay_address.save(update_fields={"last_used_at"})

        # Since .save() added to update_fields, block_list_emails flag is cleared
        relay_address.refresh_from_db()
        assert relay_address.last_used_at == new_last_used_at
        assert not relay_address.block_list_emails

    def test_metrics_id(self):
        relay_address = RelayAddress.objects.create(user=self.user)
        assert relay_address.metrics_id == f"R{relay_address.id}"


class DomainAddressTest(TestCase):
    def setUp(self):
        self.subdomain = "test"
        self.user = make_premium_test_user()
        self.storageless_user = make_storageless_test_user()
        self.user.profile.subdomain = self.subdomain
        self.user.profile.save()

    def test_make_domain_address_assigns_to_user(self):
        domain_address = DomainAddress.make_domain_address(self.user, "test-assigns")
        assert domain_address.user == self.user

    @skip(reason="test not reliable, look at FIXME comment")
    def test_make_domain_address_makes_different_addresses(self):
        # FIXME: sometimes this test will fail because it randomly generates
        # alias with bad words. See make_domain_address for why this has
        # not been fixed yet
        for i in range(5):
            domain_address = DomainAddress.make_domain_address(
                self.user, f"test-different-{i}"
            )
            assert domain_address.first_emailed_at is None
        domain_addresses = DomainAddress.objects.filter(user=self.user).values_list(
            "address", flat=True
        )
        # checks that there are 5 unique DomainAddress
        assert len(set(domain_addresses)) == 5

    def test_make_domain_address_makes_requested_address(self):
        domain_address = DomainAddress.make_domain_address(self.user, "foobar")
        assert domain_address.address == "foobar"
        assert domain_address.first_emailed_at is None

    @override_settings(MAX_ADDRESS_CREATION_PER_DAY=10)
    def test_make_domain_address_has_limit(self) -> None:
        for i in range(10):
            DomainAddress.make_domain_address(self.user, "foobar" + str(i))
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(self.user, "one-too-many")
        assert exc_info.value.get_codes() == "account_is_paused"
        domain_address_count = DomainAddress.objects.filter(user=self.user).count()
        assert domain_address_count == 10

    def test_make_domain_address_makes_requested_address_via_email(self):
        domain_address = DomainAddress.make_domain_address(self.user, "foobar", True)
        assert domain_address.address == "foobar"
        assert domain_address.first_emailed_at is not None

    def test_make_domain_address_non_premium_user(self) -> None:
        non_premium_user = baker.make(User)
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(non_premium_user, "test-non-premium")
        assert exc_info.value.get_codes() == "free_tier_no_subdomain_masks"

    def test_make_domain_address_can_make_blocklisted_address(self):
        domain_address = DomainAddress.make_domain_address(self.user, "testing")
        assert domain_address.address == "testing"

    def test_make_domain_address_valid_premium_user_with_no_subdomain(self) -> None:
        user = baker.make(User)
        baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data={"subscriptions": [premium_subscription()]},
        )
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(user, "test-nosubdomain")
        assert exc_info.value.get_codes() == "need_subdomain"

    def test_make_domain_address_dupe_of_existing_raises(self):
        address = "same-address"
        DomainAddress.make_domain_address(self.user, address=address)
        with pytest.raises(DomainAddrDuplicateException) as exc_info:
            DomainAddress.make_domain_address(self.user, address=address)
        assert exc_info.value.get_codes() == "duplicate_address"

    @override_flag("custom_domain_management_redesign", active=False)
    def test_make_domain_address_can_make_dupe_of_deleted(self) -> None:
        address = "same-address"
        domain_address = DomainAddress.make_domain_address(self.user, address=address)
        domain_address_hash = address_hash(
            domain_address.address,
            domain_address.user.profile.subdomain,
            domain_address.domain_value,
        )
        domain_address.delete()
        dupe_domain_address = DomainAddress.make_domain_address(
            self.user, address=address
        )
        assert (
            DeletedAddress.objects.filter(address_hash=domain_address_hash).count() == 1
        )
        assert dupe_domain_address.full_address == domain_address.full_address

    @override_flag("custom_domain_management_redesign", active=True)
    def test_make_domain_address_cannot_make_dupe_of_deleted(self) -> None:
        address = "same-address"
        domain_address = DomainAddress.make_domain_address(self.user, address=address)
        domain_address_hash = address_hash(
            domain_address.address,
            domain_address.user.profile.subdomain,
            domain_address.domain_value,
        )
        domain_address.delete()
        with pytest.raises(DomainAddrUnavailableException) as exc_info:
            DomainAddress.make_domain_address(self.user, address=address)
        assert exc_info.value.get_codes() == "address_unavailable"
        assert (
            DeletedAddress.objects.filter(address_hash=domain_address_hash).count() == 1
        )

    @patch("emails.models.address_default")
    def test_make_domain_address_doesnt_randomly_generate_bad_word(
        self, address_default_mocked: Mock
    ) -> None:
        address_default_mocked.return_value = "angry0123"
        with pytest.raises(CannotMakeAddressException) as exc_info:
            DomainAddress.make_domain_address(self.user)
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
        assert deleted_address_qs.get().address_hash == domain_address_hash

    def test_premium_user_can_set_block_list_emails(self):
        domain_address = DomainAddress.objects.create(
            user=self.user, address="lower-case"
        )
        assert domain_address.block_list_emails is False
        domain_address.block_list_emails = True
        domain_address.save()
        domain_address.refresh_from_db()
        assert domain_address.block_list_emails is True

    def test_delete_increments_values_on_profile(self):
        profile = self.user.profile
        assert profile.num_address_deleted == 0
        assert profile.num_email_forwarded_in_deleted_address == 0
        assert profile.num_email_blocked_in_deleted_address == 0
        assert profile.num_level_one_trackers_blocked_in_deleted_address == 0
        assert profile.num_email_replied_in_deleted_address == 0
        assert profile.num_email_spam_in_deleted_address == 0
        assert profile.num_deleted_relay_addresses == 0
        assert profile.num_deleted_domain_addresses == 0

        domain_address = DomainAddress.objects.create(
            user=self.user,
            address="lower-case",
            num_forwarded=2,
            num_blocked=3,
            num_level_one_trackers_blocked=4,
            num_replied=5,
            num_spam=6,
        )
        domain_address.delete()

        profile.refresh_from_db()
        assert profile.num_address_deleted == 1
        assert profile.num_email_forwarded_in_deleted_address == 2
        assert profile.num_email_blocked_in_deleted_address == 3
        assert profile.num_level_one_trackers_blocked_in_deleted_address == 4
        assert profile.num_email_replied_in_deleted_address == 5
        assert profile.num_email_spam_in_deleted_address == 6
        assert profile.num_deleted_relay_addresses == 0
        assert profile.num_deleted_domain_addresses == 1

    def test_formerly_premium_user_clears_block_list_emails(self):
        domain_address = DomainAddress.objects.create(
            user=self.user, address="coupons", block_list_emails=True
        )
        domain_address.refresh_from_db()
        assert domain_address.block_list_emails is True

        # Remove premium from user
        assert (fxa_account := self.user.profile.fxa) is not None
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

    def test_clear_storage_with_update_fields(self) -> None:
        """With update_fields, the stored data is cleared for storageless users."""
        domain_address = DomainAddress.objects.create(
            user=self.storageless_user, address="no-storage"
        )
        assert domain_address.used_on is None
        assert domain_address.description == ""

        # Use QuerySet.update to avoid model save method
        DomainAddress.objects.filter(id=domain_address.id).update(
            description="the description",
            used_on="https://example.com",
        )
        domain_address.refresh_from_db()
        assert domain_address.description == "the description"
        assert domain_address.used_on == "https://example.com"

        # Update a different field with update_fields to avoid full model save
        new_last_used_at = datetime(2024, 1, 11, tzinfo=UTC)
        domain_address.last_used_at = new_last_used_at
        domain_address.save(update_fields={"last_used_at"})

        # Since .save() added to update_fields, the storage fields are cleared
        domain_address.refresh_from_db()
        assert domain_address.last_used_at == new_last_used_at
        assert domain_address.description == ""
        assert domain_address.used_on == ""

    def test_clear_block_list_emails_with_update_fields(self) -> None:
        """
        With update_fields, the block_list_emails flag is still cleared for free users.
        """
        domain_address = DomainAddress.objects.create(
            user=self.user, address="block-list-emails", block_list_emails=True
        )

        # Remove premium from user
        assert (fxa_account := self.user.profile.fxa) is not None
        fxa_account.extra_data["subscriptions"] = []
        fxa_account.save()
        assert not self.user.profile.has_premium
        assert domain_address.block_list_emails

        # Update a different field with update_fields to avoid full model save
        new_last_used_at = datetime(2024, 1, 12, tzinfo=UTC)
        assert domain_address.last_used_at != new_last_used_at
        domain_address.last_used_at = new_last_used_at
        domain_address.save(update_fields={"last_used_at"})

        # Since .save() added to update_fields, block_list_emails flag is cleared
        domain_address.refresh_from_db()
        assert domain_address.last_used_at == new_last_used_at
        assert not domain_address.block_list_emails

    def test_create_updates_profile_last_engagement(self) -> None:
        DomainAddress.make_domain_address(self.user, address="create")
        assert self.user.profile.last_engagement
        pre_create_last_engagement = self.user.profile.last_engagement

        DomainAddress.make_domain_address(self.user, address="create2")

        self.user.profile.refresh_from_db()
        assert self.user.profile.last_engagement > pre_create_last_engagement

    def test_save_does_not_update_profile_last_engagement(self) -> None:
        domain_address = DomainAddress.make_domain_address(self.user, address="save")
        assert self.user.profile.last_engagement
        pre_save_last_engagement = self.user.profile.last_engagement

        domain_address.enabled = False
        domain_address.save()

        self.user.profile.refresh_from_db()
        assert self.user.profile.last_engagement == pre_save_last_engagement

    def test_delete_updates_profile_last_engagement(self) -> None:
        domain_address = DomainAddress.make_domain_address(self.user, address="delete")
        assert self.user.profile.last_engagement
        pre_delete_last_engagement = self.user.profile.last_engagement

        domain_address.delete()

        self.user.profile.refresh_from_db()
        assert self.user.profile.last_engagement > pre_delete_last_engagement

    def test_metrics_id(self):
        address = DomainAddress.objects.create(user=self.user, address="metrics")
        assert address.metrics_id == f"D{address.id}"
