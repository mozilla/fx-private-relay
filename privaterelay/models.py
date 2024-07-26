from __future__ import annotations

import logging
import uuid
from collections import namedtuple
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import TYPE_CHECKING, Literal

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.utils.translation.trans_real import (
    get_supported_language_variant,
    parse_accept_lang_header,
)

from allauth.socialaccount.models import SocialAccount

from .exceptions import CannotMakeSubdomainException
from .plans import get_premium_countries
from .utils import (
    AcceptLanguageError,
    flag_is_active_in_task,
    guess_country_from_accept_lang,
)
from .validators import valid_available_subdomain

if TYPE_CHECKING:
    from collections.abc import Iterable

    from django.db.models.base import ModelBase
    from django.db.models.query import QuerySet

    from emails.models import DomainAddress, RelayAddress


abuse_logger = logging.getLogger("abusemetrics")
BounceStatus = namedtuple("BounceStatus", "paused type")
PREMIUM_DOMAINS = ["mozilla.com", "getpocket.com", "mozillafoundation.org"]


def hash_subdomain(subdomain: str, domain: str = settings.MOZMAIL_DOMAIN) -> str:
    return sha256(f"{subdomain}.{domain}".encode()).hexdigest()


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    api_token = models.UUIDField(default=uuid.uuid4)
    num_address_deleted = models.PositiveIntegerField(default=0)
    date_subscribed = models.DateTimeField(blank=True, null=True)
    date_subscribed_phone = models.DateTimeField(blank=True, null=True)
    # TODO MPP-2972: delete date_phone_subscription_checked in favor of
    # date_phone_subscription_next_reset
    date_phone_subscription_checked = models.DateTimeField(blank=True, null=True)
    date_phone_subscription_start = models.DateTimeField(blank=True, null=True)
    date_phone_subscription_reset = models.DateTimeField(blank=True, null=True)
    date_phone_subscription_end = models.DateTimeField(blank=True, null=True)
    address_last_deleted = models.DateTimeField(blank=True, null=True, db_index=True)
    last_soft_bounce = models.DateTimeField(blank=True, null=True, db_index=True)
    last_hard_bounce = models.DateTimeField(blank=True, null=True, db_index=True)
    last_account_flagged = models.DateTimeField(blank=True, null=True, db_index=True)
    num_deleted_relay_addresses = models.PositiveIntegerField(default=0)
    num_deleted_domain_addresses = models.PositiveIntegerField(default=0)
    num_email_forwarded_in_deleted_address = models.PositiveIntegerField(default=0)
    num_email_blocked_in_deleted_address = models.PositiveIntegerField(default=0)
    num_level_one_trackers_blocked_in_deleted_address = models.PositiveIntegerField(
        default=0, null=True
    )
    num_email_replied_in_deleted_address = models.PositiveIntegerField(default=0)
    num_email_spam_in_deleted_address = models.PositiveIntegerField(default=0)
    subdomain = models.CharField(
        blank=True,
        null=True,
        unique=True,
        max_length=63,
        db_index=True,
        validators=[valid_available_subdomain],
    )
    # Whether we store the user's alias labels in the server
    server_storage = models.BooleanField(default=True)
    # Whether we store the caller/sender log for the user's relay number
    store_phone_log = models.BooleanField(default=True)
    # TODO: Data migration to set null to false
    # TODO: Schema migration to remove null=True
    remove_level_one_email_trackers = models.BooleanField(null=True, default=False)
    onboarding_state = models.PositiveIntegerField(default=0)
    onboarding_free_state = models.PositiveIntegerField(default=0)
    auto_block_spam = models.BooleanField(default=False)
    forwarded_first_reply = models.BooleanField(default=False)
    # Empty string means the profile was created through relying party flow
    created_by = models.CharField(blank=True, null=True, max_length=63)
    sent_welcome_email = models.BooleanField(default=False)
    last_engagement = models.DateTimeField(blank=True, null=True, db_index=True)

    class Meta:
        # Moved from emails to privaterelay, but old table name retained. See:
        # privaterelay/migrations/0010_move_profile_and_registered_subdomain_models.py
        # emails/migrations/0062_move_profile_and_registered_subdomain_models.py
        db_table = "emails_profile"

    def __str__(self):
        return f"{self.user} Profile"

    def save(
        self,
        force_insert: bool | tuple[ModelBase, ...] = False,
        force_update: bool = False,
        using: str | None = None,
        update_fields: Iterable[str] | None = None,
    ) -> None:
        from emails.models import DomainAddress, RelayAddress

        # always lower-case the subdomain before saving it
        # TODO: change subdomain field as a custom field inheriting from
        # CharField to validate constraints on the field update too
        if self.subdomain and not self.subdomain.islower():
            self.subdomain = self.subdomain.lower()
            if update_fields is not None:
                update_fields = {"subdomain"}.union(update_fields)
        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )
        # any time a profile is saved with server_storage False, delete the
        # appropriate server-stored Relay address data.
        if not self.server_storage:
            relay_addresses = RelayAddress.objects.filter(user=self.user)
            relay_addresses.update(description="", generated_for="", used_on="")
            domain_addresses = DomainAddress.objects.filter(user=self.user)
            domain_addresses.update(description="", used_on="")
        if settings.PHONES_ENABLED:
            # any time a profile is saved with store_phone_log False, delete the
            # appropriate server-stored InboundContact records
            from phones.models import InboundContact, RelayNumber

            if not self.store_phone_log:
                try:
                    relay_number = RelayNumber.objects.get(user=self.user)
                    InboundContact.objects.filter(relay_number=relay_number).delete()
                except RelayNumber.DoesNotExist:
                    pass

    @property
    def language(self):
        if self.fxa and self.fxa.extra_data.get("locale"):
            for accept_lang, _ in parse_accept_lang_header(
                self.fxa.extra_data.get("locale")
            ):
                try:
                    return get_supported_language_variant(accept_lang)
                except LookupError:
                    continue
        return "en"

    # This method returns whether the locale associated with the user's Mozilla account
    # includes a country code from a Premium country. This is less accurate than using
    # get_countries_info_from_request_and_mapping(), which can use a GeoIP lookup, so
    # prefer using that if a request context is available. In other contexts, for
    # example when sending an email, this method can be useful.
    @property
    def fxa_locale_in_premium_country(self) -> bool:
        if self.fxa and self.fxa.extra_data.get("locale"):
            try:
                country = guess_country_from_accept_lang(self.fxa.extra_data["locale"])
            except AcceptLanguageError:
                return False
            premium_countries = get_premium_countries()
            if country in premium_countries:
                return True
        return False

    @property
    def avatar(self) -> str | None:
        if fxa := self.fxa:
            return str(fxa.extra_data.get("avatar"))
        return None

    @property
    def relay_addresses(self) -> QuerySet[RelayAddress]:
        from emails.models import RelayAddress

        return RelayAddress.objects.filter(user=self.user)

    @property
    def domain_addresses(self) -> QuerySet[DomainAddress]:
        from emails.models import DomainAddress

        return DomainAddress.objects.filter(user=self.user)

    @property
    def total_masks(self) -> int:
        ra_count: int = self.relay_addresses.count()
        da_count: int = self.domain_addresses.count()
        return ra_count + da_count

    @property
    def at_mask_limit(self) -> bool:
        if self.has_premium:
            return False
        ra_count: int = self.relay_addresses.count()
        return ra_count >= settings.MAX_NUM_FREE_ALIASES

    def check_bounce_pause(self) -> BounceStatus:
        if self.last_hard_bounce:
            last_hard_bounce_allowed = datetime.now(UTC) - timedelta(
                days=settings.HARD_BOUNCE_ALLOWED_DAYS
            )
            if self.last_hard_bounce > last_hard_bounce_allowed:
                return BounceStatus(True, "hard")
            self.last_hard_bounce = None
            self.save()
        if self.last_soft_bounce:
            last_soft_bounce_allowed = datetime.now(UTC) - timedelta(
                days=settings.SOFT_BOUNCE_ALLOWED_DAYS
            )
            if self.last_soft_bounce > last_soft_bounce_allowed:
                return BounceStatus(True, "soft")
            self.last_soft_bounce = None
            self.save()
        return BounceStatus(False, "")

    @property
    def bounce_status(self) -> BounceStatus:
        return self.check_bounce_pause()

    @property
    def next_email_try(self) -> datetime:
        bounce_pause, bounce_type = self.check_bounce_pause()

        if not bounce_pause:
            return datetime.now(UTC)

        if bounce_type == "soft":
            if not self.last_soft_bounce:
                raise ValueError("self.last_soft_bounce must be truthy value.")
            return self.last_soft_bounce + timedelta(
                days=settings.SOFT_BOUNCE_ALLOWED_DAYS
            )

        if bounce_type != "hard":
            raise ValueError("bounce_type must be either 'soft' or 'hard'")
        if not self.last_hard_bounce:
            raise ValueError("self.last_hard_bounce must be truthy value.")
        return self.last_hard_bounce + timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS)

    @property
    def last_bounce_date(self):
        if self.last_hard_bounce:
            return self.last_hard_bounce
        if self.last_soft_bounce:
            return self.last_soft_bounce
        return None

    @property
    def at_max_free_aliases(self) -> bool:
        relay_addresses_count: int = self.relay_addresses.count()
        return relay_addresses_count >= settings.MAX_NUM_FREE_ALIASES

    @property
    def fxa(self) -> SocialAccount | None:
        # Note: we are NOT using .filter() here because it invalidates
        # any profile instances that were queried with prefetch_related, which
        # we use in at least the profile view to minimize queries
        if not hasattr(self.user, "socialaccount_set"):
            raise AttributeError("self.user must have socialaccount_set attribute")
        for sa in self.user.socialaccount_set.all():
            if sa.provider == "fxa":
                return sa
        return None

    @property
    def display_name(self) -> str | None:
        # if display name is not set on FxA the
        # displayName key will not exist on the extra_data
        if fxa := self.fxa:
            name = fxa.extra_data.get("displayName")
            return name if name is None else str(name)
        return None

    @property
    def custom_domain(self) -> str:
        if not self.subdomain:
            raise ValueError("self.subdomain must be truthy value.")
        return f"@{self.subdomain}.{settings.MOZMAIL_DOMAIN}"

    @property
    def has_premium(self) -> bool:
        if not self.user.is_active:
            return False

        # FIXME: as we don't have all the tiers defined we are over-defining
        # this to mark the user as a premium user as well
        if not self.fxa:
            return False
        for premium_domain in PREMIUM_DOMAINS:
            if self.user.email.endswith(f"@{premium_domain}"):
                return True
        user_subscriptions = self.fxa.extra_data.get("subscriptions", [])
        for sub in settings.SUBSCRIPTIONS_WITH_UNLIMITED:
            if sub in user_subscriptions:
                return True
        return False

    @property
    def has_phone(self) -> bool:
        if not self.fxa:
            return False
        if settings.RELAY_CHANNEL != "prod" and not settings.IN_PYTEST:
            if not flag_is_active_in_task("phones", self.user):
                return False
        if flag_is_active_in_task("free_phones", self.user):
            return True
        user_subscriptions = self.fxa.extra_data.get("subscriptions", [])
        for sub in settings.SUBSCRIPTIONS_WITH_PHONE:
            if sub in user_subscriptions:
                return True
        return False

    @property
    def has_vpn(self) -> bool:
        if not self.fxa:
            return False
        user_subscriptions = self.fxa.extra_data.get("subscriptions", [])
        for sub in settings.SUBSCRIPTIONS_WITH_VPN:
            if sub in user_subscriptions:
                return True
        return False

    @property
    def emails_forwarded(self) -> int:
        return (
            sum(ra.num_forwarded for ra in self.relay_addresses)
            + sum(da.num_forwarded for da in self.domain_addresses)
            + self.num_email_forwarded_in_deleted_address
        )

    @property
    def emails_blocked(self) -> int:
        return (
            sum(ra.num_blocked for ra in self.relay_addresses)
            + sum(da.num_blocked for da in self.domain_addresses)
            + self.num_email_blocked_in_deleted_address
        )

    @property
    def emails_replied(self) -> int:
        ra_sum = self.relay_addresses.aggregate(models.Sum("num_replied", default=0))
        da_sum = self.domain_addresses.aggregate(models.Sum("num_replied", default=0))
        return (
            int(ra_sum["num_replied__sum"])
            + int(da_sum["num_replied__sum"])
            + self.num_email_replied_in_deleted_address
        )

    @property
    def level_one_trackers_blocked(self) -> int:
        return (
            sum(ra.num_level_one_trackers_blocked or 0 for ra in self.relay_addresses)
            + sum(
                da.num_level_one_trackers_blocked or 0 for da in self.domain_addresses
            )
            + (self.num_level_one_trackers_blocked_in_deleted_address or 0)
        )

    @property
    def joined_before_premium_release(self):
        date_created = self.user.date_joined
        return date_created < datetime.fromisoformat("2021-10-22 17:00:00+00:00")

    @property
    def date_phone_registered(self) -> datetime | None:
        if not settings.PHONES_ENABLED:
            return None

        from phones.models import RealPhone, RelayNumber

        try:
            real_phone = RealPhone.objects.get(user=self.user)
            relay_number = RelayNumber.objects.get(user=self.user)
        except RealPhone.DoesNotExist:
            return None
        except RelayNumber.DoesNotExist:
            return real_phone.verified_date
        return relay_number.created_at or real_phone.verified_date

    def add_subdomain(self, subdomain):
        # Handles if the subdomain is "" or None
        if not subdomain:
            raise CannotMakeSubdomainException(
                "error-subdomain-cannot-be-empty-or-null"
            )

        # subdomain must be all lowercase
        subdomain = subdomain.lower()

        if not self.has_premium:
            raise CannotMakeSubdomainException("error-premium-set-subdomain")
        if self.subdomain is not None:
            raise CannotMakeSubdomainException("error-premium-cannot-change-subdomain")
        self.subdomain = subdomain
        # The validator defined in the subdomain field does not get run in full_clean()
        # when self.subdomain is "" or None, so we need to run the validator again to
        # catch these cases.
        valid_available_subdomain(subdomain)
        self.full_clean()
        self.save()

        RegisteredSubdomain.objects.create(subdomain_hash=hash_subdomain(subdomain))
        return subdomain

    def update_abuse_metric(
        self,
        address_created: bool = False,
        replied: bool = False,
        email_forwarded: bool = False,
        forwarded_email_size: int = 0,
    ) -> datetime | None:
        if self.user.email in settings.ALLOWED_ACCOUNTS:
            return None

        with transaction.atomic():
            # look for abuse metrics created on the same UTC date, regardless of time.
            midnight_utc_today = datetime.combine(
                datetime.now(UTC).date(), datetime.min.time()
            ).astimezone(UTC)
            midnight_utc_tomorow = midnight_utc_today + timedelta(days=1)
            abuse_metric = (
                self.user.abusemetrics_set.select_for_update()
                .filter(
                    first_recorded__gte=midnight_utc_today,
                    first_recorded__lt=midnight_utc_tomorow,
                )
                .first()
            )
            if not abuse_metric:
                from emails.models import AbuseMetrics

                abuse_metric = AbuseMetrics.objects.create(user=self.user)
                AbuseMetrics.objects.filter(
                    first_recorded__lt=midnight_utc_today
                ).delete()

            # increment the abuse metric
            if address_created:
                abuse_metric.num_address_created_per_day += 1
            if replied:
                abuse_metric.num_replies_per_day += 1
            if email_forwarded:
                abuse_metric.num_email_forwarded_per_day += 1
            if forwarded_email_size > 0:
                abuse_metric.forwarded_email_size_per_day += forwarded_email_size
            abuse_metric.last_recorded = datetime.now(UTC)
            abuse_metric.save()

            # check user should be flagged for abuse
            hit_max_create = False
            hit_max_replies = False
            hit_max_forwarded = False
            hit_max_forwarded_email_size = False

            hit_max_create = (
                abuse_metric.num_address_created_per_day
                >= settings.MAX_ADDRESS_CREATION_PER_DAY
            )
            hit_max_replies = (
                abuse_metric.num_replies_per_day >= settings.MAX_REPLIES_PER_DAY
            )
            hit_max_forwarded = (
                abuse_metric.num_email_forwarded_per_day
                >= settings.MAX_FORWARDED_PER_DAY
            )
            hit_max_forwarded_email_size = (
                abuse_metric.forwarded_email_size_per_day
                >= settings.MAX_FORWARDED_EMAIL_SIZE_PER_DAY
            )
            if (
                hit_max_create
                or hit_max_replies
                or hit_max_forwarded
                or hit_max_forwarded_email_size
            ):
                self.last_account_flagged = datetime.now(UTC)
                self.save()
                data = {
                    "uid": self.fxa.uid if self.fxa else None,
                    "flagged": self.last_account_flagged.timestamp(),
                    "replies": abuse_metric.num_replies_per_day,
                    "addresses": abuse_metric.num_address_created_per_day,
                    "forwarded": abuse_metric.num_email_forwarded_per_day,
                    "forwarded_size_in_bytes": (
                        abuse_metric.forwarded_email_size_per_day
                    ),
                }
                # log for further secops review
                abuse_logger.info("Abuse flagged", extra=data)

        return self.last_account_flagged

    @property
    def is_flagged(self):
        if not self.last_account_flagged:
            return False
        account_premium_feature_resumed = self.last_account_flagged + timedelta(
            days=settings.PREMIUM_FEATURE_PAUSED_DAYS
        )
        if datetime.now(UTC) > account_premium_feature_resumed:
            # premium feature has been resumed
            return False
        # user was flagged and the premium feature pause period is not yet over
        return True

    @property
    def metrics_enabled(self) -> bool:
        """
        Does the user allow us to record technical and interaction data?

        This is based on the Mozilla accounts opt-out option, added around 2022. A user
        can go to their Mozilla account profile settings, Data Collection and Use, and
        deselect "Help improve Mozilla Account". This setting defaults to On, and is
        sent as "metricsEnabled". Some older Relay accounts do not have
        "metricsEnabled", and we default to On.
        """
        if self.fxa:
            return bool(self.fxa.extra_data.get("metricsEnabled", True))
        return True

    @property
    def plan(self) -> Literal["free", "email", "phone", "bundle"]:
        """The user's Relay plan as a string."""
        if self.has_premium:
            if self.has_phone:
                return "bundle" if self.has_vpn else "phone"
            else:
                return "email"
        else:
            return "free"

    @property
    def plan_term(self) -> Literal[None, "unknown", "1_month", "1_year"]:
        """The user's Relay plan term as a string."""
        plan = self.plan
        if plan == "free":
            return None
        if plan == "phone":
            start_date = self.date_phone_subscription_start
            end_date = self.date_phone_subscription_end
            if start_date and end_date:
                span = end_date - start_date
                return "1_year" if span.days > 32 else "1_month"
        return "unknown"

    @property
    def metrics_premium_status(self) -> str:
        plan = self.plan
        if plan == "free":
            return "free"
        return f"{plan}_{self.plan_term}"


class RegisteredSubdomain(models.Model):
    subdomain_hash = models.CharField(max_length=64, db_index=True, unique=True)
    registered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.subdomain_hash

    class Meta:
        # Moved from emails to privaterelay, but old table name retained. See:
        # privaterelay/migrations/0010_move_profile_and_registered_subdomain_models.py
        # emails/migrations/0062_move_profile_and_registered_subdomain_models.py
        db_table = "emails_registeredsubdomain"

    @classmethod
    def is_taken(cls, subdomain: str) -> bool:
        return cls.objects.filter(subdomain_hash=hash_subdomain(subdomain)).exists()
