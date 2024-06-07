import random
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

from emails.models import AbuseMetrics, DomainAddress, RelayAddress

from ..exceptions import CannotMakeSubdomainException
from ..models import Profile
from .utils import (
    make_free_test_user,
    phone_subscription,
    premium_subscription,
    vpn_subscription,
)

if settings.PHONES_ENABLED:
    from phones.models import RealPhone, RelayNumber


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
            defaults={
                "uid": str(uuid4()),
                "extra_data": {"avatar": "image.png", "subscriptions": []},
            },
        )
        return social_account

    def upgrade_to_premium(self) -> None:
        """Add an unlimited emails subscription to the user."""
        social_account = self.get_or_create_social_account()
        social_account.extra_data["subscriptions"].append(premium_subscription())
        social_account.save()

    def upgrade_to_phone(self) -> None:
        """Add a phone plan to the user."""
        social_account = self.get_or_create_social_account()
        social_account.extra_data["subscriptions"].append(phone_subscription())
        if not self.profile.has_premium:
            social_account.extra_data["subscriptions"].append(premium_subscription())
        social_account.save()

    def upgrade_to_vpn_bundle(self) -> None:
        """Add a phone plan to the user."""
        social_account = self.get_or_create_social_account()
        social_account.extra_data["subscriptions"].append(vpn_subscription())
        if not self.profile.has_premium:
            social_account.extra_data["subscriptions"].append(premium_subscription())
        if not self.profile.has_phone:
            social_account.extra_data["subscriptions"].append(phone_subscription())
        social_account.save()


class ProfileBounceTestCase(ProfileTestCase):
    """Base class for Profile tests that check for bounces."""

    def set_hard_bounce(self) -> datetime:
        """
        Set a hard bounce pause for the profile, return the bounce time.

        This happens when the user's email server reports a hard bounce, such as
        saying the email does not exist.
        """
        self.profile.last_hard_bounce = datetime.now(UTC) - timedelta(
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
        self.profile.last_soft_bounce = datetime.now(UTC) - timedelta(
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
        self.profile.last_hard_bounce = datetime.now(UTC) - timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS + 1
        )
        self.profile.save()
        assert self.profile.last_hard_bounce is not None

        bounce_paused, bounce_type = self.profile.check_bounce_pause()

        assert bounce_paused is False
        assert bounce_type == ""
        assert self.profile.last_hard_bounce is None

    def test_soft_bounce_over_resets_timer(self) -> None:
        self.profile.last_soft_bounce = datetime.now(UTC) - timedelta(
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
        assert self.profile.next_email_try.date() == datetime.now(UTC).date()

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

    def test_premium_subscription_returns_True(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.has_premium is True

    def test_phone_returns_True(self) -> None:
        self.upgrade_to_phone()
        assert self.profile.has_premium is True

    def test_vpn_bundle_returns_True(self) -> None:
        self.upgrade_to_vpn_bundle()
        assert self.profile.has_premium is True


class ProfileHasPhoneTest(ProfileTestCase):
    """Tests for Profile.has_phone"""

    def test_default_False(self) -> None:
        assert self.profile.has_phone is False

    def test_premium_subscription_returns_False(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.has_phone is False

    def test_phone_returns_True(self) -> None:
        self.upgrade_to_phone()
        assert self.profile.has_phone is True

    def test_vpn_bundle_returns_True(self) -> None:
        self.upgrade_to_vpn_bundle()
        assert self.profile.has_phone is True


@pytest.mark.skipif(not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False")
@override_settings(PHONES_NO_CLIENT_CALLS_IN_TEST=True)
class ProfileDatePhoneRegisteredTest(ProfileTestCase):
    """Tests for Profile.date_phone_registered"""

    def test_default_None(self) -> None:
        assert self.profile.date_phone_registered is None

    def test_real_phone_no_relay_number_returns_verified_date(self) -> None:
        self.upgrade_to_phone()
        datetime_now = datetime.now(UTC)
        RealPhone.objects.create(
            user=self.profile.user,
            number="+12223334444",
            verified=True,
            verified_date=datetime_now,
        )
        assert self.profile.date_phone_registered == datetime_now

    def test_real_phone_and_relay_number_w_created_at_returns_created_at_date(
        self,
    ) -> None:
        self.upgrade_to_phone()
        datetime_now = datetime.now(UTC)
        phone_user = self.profile.user
        RealPhone.objects.create(
            user=phone_user,
            number="+12223334444",
            verified=True,
            verified_date=datetime_now,
        )
        relay_number = RelayNumber.objects.create(user=phone_user)
        assert self.profile.date_phone_registered == relay_number.created_at

    def test_real_phone_and_relay_number_wo_created_at_returns_verified_date(
        self,
    ) -> None:
        self.upgrade_to_phone()
        datetime_now = datetime.now(UTC)
        phone_user = self.profile.user
        real_phone = RealPhone.objects.create(
            user=phone_user,
            number="+12223334444",
            verified=True,
            verified_date=datetime_now,
        )
        relay_number = RelayNumber.objects.create(user=phone_user)
        # since created_at is auto set, update to None
        relay_number.created_at = None
        relay_number.save()
        assert self.profile.date_phone_registered == real_phone.verified_date


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

    def test_lowercases_subdomain_value_with_update_fields(self) -> None:
        """With update_fields, the subdomain is still lowercased."""
        self.upgrade_to_premium()
        assert self.profile.subdomain is None

        # Use QuerySet.update to avoid model .save()
        Profile.objects.filter(id=self.profile.id).update(subdomain="mIxEdcAsE")
        self.profile.refresh_from_db()
        assert self.profile.subdomain == "mIxEdcAsE"

        # Update a different field with update_fields to avoid a full model save
        new_date_subscribed = datetime(2023, 3, 3, tzinfo=UTC)
        self.profile.date_subscribed = new_date_subscribed
        self.profile.save(update_fields={"date_subscribed"})

        # Since .save() added to update_fields, subdomain is now lowercase
        self.profile.refresh_from_db()
        assert self.profile.date_subscribed == new_date_subscribed
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

    def add_domain_address(self) -> DomainAddress:
        self.upgrade_to_premium()
        self.profile.subdomain = "somesubdomain"
        self.profile.save()
        return baker.make(
            DomainAddress,
            user=self.profile.user,
            address="localpart",
            description=self.TEST_DESCRIPTION,
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
        domain_address = self.add_domain_address()
        self.profile.server_storage = False
        self.profile.save()

        relay_address.refresh_from_db()
        domain_address.refresh_from_db()
        assert relay_address.description == ""
        assert relay_address.generated_for == ""
        assert relay_address.used_on == ""
        assert domain_address.description == ""
        assert domain_address.used_on == ""

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

        patcher_logger = patch("privaterelay.models.abuse_logger.info")
        self.mocked_abuse_info = patcher_logger.start()
        self.addCleanup(patcher_logger.stop)

        # Selectively patch datatime.now() for emails models
        # https://docs.python.org/3/library/unittest.mock-examples.html#partial-mocking
        patcher = patch("privaterelay.models.datetime")
        mocked_datetime = patcher.start()
        self.addCleanup(patcher.stop)

        self.expected_now = datetime.now(UTC)
        mocked_datetime.combine.return_value = datetime.combine(
            datetime.now(UTC).date(), datetime.min.time()
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

        assert self.profile.fxa
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

        assert self.profile.fxa
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


class ProfileMetricsEnabledTest(ProfileTestCase):
    def test_no_fxa_means_metrics_enabled(self) -> None:
        assert not self.profile.fxa
        assert self.profile.metrics_enabled

    def test_fxa_legacy_means_metrics_enabled(self) -> None:
        self.get_or_create_social_account()
        assert self.profile.fxa
        assert "metricsEnabled" not in self.profile.fxa.extra_data
        assert self.profile.metrics_enabled

    def test_fxa_opt_in_means_metrics_enabled(self) -> None:
        social_account = self.get_or_create_social_account()
        social_account.extra_data["metricsEnabled"] = True
        social_account.save()
        assert self.profile.fxa
        assert self.profile.metrics_enabled

    def test_fxa_opt_out_means_metrics_disabled(self) -> None:
        social_account = self.get_or_create_social_account()
        social_account.extra_data["metricsEnabled"] = False
        social_account.save()
        assert self.profile.fxa
        assert not self.profile.metrics_enabled


class ProfilePlanTest(ProfileTestCase):
    def test_free_user(self) -> None:
        assert self.profile.plan == "free"

    def test_premium_user(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.plan == "email"

    def test_phone_user(self) -> None:
        self.upgrade_to_phone()
        assert self.profile.plan == "phone"

    def test_vpn_bundle_user(self) -> None:
        self.upgrade_to_vpn_bundle()
        assert self.profile.plan == "bundle"


class ProfilePlanTermTest(ProfileTestCase):
    def test_free_user(self) -> None:
        assert self.profile.plan_term is None

    def test_premium_user(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.plan_term == "unknown"

    def test_phone_user(self) -> None:
        self.upgrade_to_phone()
        assert self.profile.plan_term == "unknown"

    def test_phone_user_1_month(self) -> None:
        self.upgrade_to_phone()
        self.profile.date_phone_subscription_start = datetime(2024, 1, 1, tzinfo=UTC)

        self.profile.date_phone_subscription_end = datetime(2024, 2, 1, tzinfo=UTC)
        assert self.profile.plan_term == "1_month"

    def test_phone_user_1_year(self) -> None:
        self.upgrade_to_phone()
        self.profile.date_phone_subscription_start = datetime(2024, 1, 1, tzinfo=UTC)

        self.profile.date_phone_subscription_end = datetime(2025, 1, 1, tzinfo=UTC)
        assert self.profile.plan_term == "1_year"

    def test_vpn_bundle_user(self) -> None:
        self.upgrade_to_vpn_bundle()
        assert self.profile.plan_term == "unknown"


class ProfileMetricsPremiumStatus(ProfileTestCase):
    def test_free_user(self):
        assert self.profile.metrics_premium_status == "free"

    def test_premium_user(self) -> None:
        self.upgrade_to_premium()
        assert self.profile.metrics_premium_status == "email_unknown"

    def test_phone_user(self) -> None:
        self.upgrade_to_phone()
        assert self.profile.metrics_premium_status == "phone_unknown"

    def test_phone_user_1_month(self) -> None:
        self.upgrade_to_phone()
        self.profile.date_phone_subscription_start = datetime(2024, 1, 1, tzinfo=UTC)

        self.profile.date_phone_subscription_end = datetime(2024, 2, 1, tzinfo=UTC)
        assert self.profile.metrics_premium_status == "phone_1_month"

    def test_phone_user_1_year(self) -> None:
        self.upgrade_to_phone()
        self.profile.date_phone_subscription_start = datetime(2024, 1, 1, tzinfo=UTC)

        self.profile.date_phone_subscription_end = datetime(2025, 1, 1, tzinfo=UTC)
        assert self.profile.metrics_premium_status == "phone_1_year"

    def test_vpn_bundle_user(self) -> None:
        self.upgrade_to_vpn_bundle()
        assert self.profile.metrics_premium_status == "bundle_unknown"
