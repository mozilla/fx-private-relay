from __future__ import annotations

import logging
import random
import re
import string
import uuid
from collections import namedtuple
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Literal, cast

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import BadRequest
from django.core.validators import MinLengthValidator
from django.db import models, transaction
from django.db.models.base import ModelBase
from django.db.models.query import QuerySet
from django.dispatch import receiver
from django.utils.translation.trans_real import (
    get_supported_language_variant,
    parse_accept_lang_header,
)

from allauth.socialaccount.models import SocialAccount
from rest_framework.authtoken.models import Token

from api.exceptions import ErrorContextType, RelayAPIException
from privaterelay.plans import get_premium_countries
from privaterelay.utils import (
    AcceptLanguageError,
    flag_is_active_in_task,
    guess_country_from_accept_lang,
)

from .apps import emails_config
from .utils import get_domains_from_settings, incr_if_enabled

if settings.PHONES_ENABLED:
    from phones.models import RealPhone, RelayNumber


logger = logging.getLogger("events")
abuse_logger = logging.getLogger("abusemetrics")

BounceStatus = namedtuple("BounceStatus", "paused type")

DOMAIN_CHOICES = [(1, "RELAY_FIREFOX_DOMAIN"), (2, "MOZMAIL_DOMAIN")]
PREMIUM_DOMAINS = ["mozilla.com", "getpocket.com", "mozillafoundation.org"]


def valid_available_subdomain(subdomain, *args, **kwargs):
    if not subdomain:
        raise CannotMakeSubdomainException("error-subdomain-cannot-be-empty-or-null")
    # valid subdomains:
    #   can't start or end with a hyphen
    #   must be 1-63 alphanumeric characters and/or hyphens
    subdomain = subdomain.lower()
    valid_subdomain_pattern = re.compile("^(?!-)[a-z0-9-]{1,63}(?<!-)$")
    valid = valid_subdomain_pattern.match(subdomain) is not None
    #   can't have "bad" words in them
    bad_word = has_bad_words(subdomain)
    #   can't have "blocked" words in them
    blocked_word = is_blocklisted(subdomain)
    #   can't be taken by someone else
    taken = (
        RegisteredSubdomain.objects.filter(
            subdomain_hash=hash_subdomain(subdomain)
        ).count()
        > 0
    )
    if not valid or bad_word or blocked_word or taken:
        raise CannotMakeSubdomainException("error-subdomain-not-available")
    return True


# This historical function is referenced in migration
# 0029_profile_add_deleted_metric_and_changeserver_storage_default
def default_server_storage():
    return True


def default_domain_numerical():
    domains = get_domains_from_settings()
    domain = domains["MOZMAIL_DOMAIN"]
    return get_domain_numerical(domain)


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

    def __str__(self):
        return "%s Profile" % self.user

    def save(
        self,
        force_insert: bool | tuple[ModelBase, ...] = False,
        force_update: bool = False,
        using: str | None = None,
        update_fields: Iterable[str] | None = None,
    ) -> None:
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
        return RelayAddress.objects.filter(user=self.user)

    @property
    def domain_addresses(self) -> QuerySet[DomainAddress]:
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
            assert self.last_soft_bounce
            return self.last_soft_bounce + timedelta(
                days=settings.SOFT_BOUNCE_ALLOWED_DAYS
            )

        assert bounce_type == "hard"
        assert self.last_hard_bounce
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
        assert hasattr(self.user, "socialaccount_set")
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
        assert self.subdomain
        return f"@{self.subdomain}.{settings.MOZMAIL_DOMAIN}"

    @property
    def has_premium(self) -> bool:
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
        # TODO MPP-3720: This should be wrapped in atomic or select_for_update to ensure
        # race conditions are properly handled.

        # look for abuse metrics created on the same UTC date, regardless of time.
        midnight_utc_today = datetime.combine(
            datetime.now(UTC).date(), datetime.min.time()
        ).astimezone(UTC)
        midnight_utc_tomorow = midnight_utc_today + timedelta(days=1)
        abuse_metric = self.user.abusemetrics_set.filter(
            first_recorded__gte=midnight_utc_today,
            first_recorded__lt=midnight_utc_tomorow,
        ).first()
        if not abuse_metric:
            abuse_metric = AbuseMetrics.objects.create(user=self.user)
            AbuseMetrics.objects.filter(first_recorded__lt=midnight_utc_today).delete()

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
            abuse_metric.num_email_forwarded_per_day >= settings.MAX_FORWARDED_PER_DAY
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
                "forwarded_size_in_bytes": abuse_metric.forwarded_email_size_per_day,
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


@receiver(models.signals.post_save, sender=Profile)
def copy_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        # baker triggers created during tests
        # so first check the user doesn't already have a Token
        try:
            Token.objects.get(user=instance.user)
            return
        except Token.DoesNotExist:
            Token.objects.create(user=instance.user, key=instance.api_token)


def address_hash(address, subdomain=None, domain=None):
    if not domain:
        domain = get_domains_from_settings()["MOZMAIL_DOMAIN"]
    if subdomain:
        return sha256(f"{address}@{subdomain}.{domain}".encode()).hexdigest()
    if domain == settings.RELAY_FIREFOX_DOMAIN:
        return sha256(f"{address}".encode()).hexdigest()
    return sha256(f"{address}@{domain}".encode()).hexdigest()


def address_default():
    return "".join(
        random.choices(  # noqa: S311 (standard pseudo-random generator used)
            string.ascii_lowercase + string.digits, k=9
        )
    )


def has_bad_words(value: str) -> bool:
    for badword in emails_config().badwords:
        badword = badword.strip()
        if len(badword) <= 4 and badword == value:
            return True
        if len(badword) > 4 and badword in value:
            return True
    return False


def is_blocklisted(value: str) -> bool:
    return any(blockedword == value for blockedword in emails_config().blocklist)


def get_domain_numerical(domain_address):
    # get domain name from the address
    domains = get_domains_from_settings()
    domains_keys = list(domains.keys())
    domains_values = list(domains.values())
    domain_name = domains_keys[domains_values.index(domain_address)]
    # get domain numerical value from domain name
    choices = dict(DOMAIN_CHOICES)
    choices_keys = list(choices.keys())
    choices_values = list(choices.values())
    return choices_keys[choices_values.index(domain_name)]


def hash_subdomain(subdomain, domain=settings.MOZMAIL_DOMAIN):
    return sha256(f"{subdomain}.{domain}".encode()).hexdigest()


class RegisteredSubdomain(models.Model):
    subdomain_hash = models.CharField(max_length=64, db_index=True, unique=True)
    registered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.subdomain_hash


class CannotMakeSubdomainException(BadRequest):
    """Exception raised by Profile due to error on subdomain creation.

    Attributes:
        message -- optional explanation of the error
    """

    def __init__(self, message=None):
        self.message = message


class CannotMakeAddressException(RelayAPIException):
    """Base exception for RelayAddress or DomainAddress creation failure."""


class AccountIsPausedException(CannotMakeAddressException):
    default_code = "account_is_paused"
    default_detail = "Your account is on pause."
    status_code = 403


class RelayAddrFreeTierLimitException(CannotMakeAddressException):
    default_code = "free_tier_limit"
    default_detail_template = (
        "You’ve used all {free_tier_limit} email masks included with your free account."
        " You can reuse an existing mask, but using a unique mask for each account is"
        " the most secure option."
    )
    status_code = 403

    def __init__(self, free_tier_limit: int | None = None):
        self.free_tier_limit = free_tier_limit or settings.MAX_NUM_FREE_ALIASES
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"free_tier_limit": self.free_tier_limit}


class DomainAddrFreeTierException(CannotMakeAddressException):
    default_code = "free_tier_no_subdomain_masks"
    default_detail = (
        "Your free account does not include custom subdomains for masks."
        " To create custom masks, upgrade to Relay Premium."
    )
    status_code = 403


class DomainAddrNeedSubdomainException(CannotMakeAddressException):
    default_code = "need_subdomain"
    default_detail = "Please select a subdomain before creating a custom email address."
    status_code = 400


class DomainAddrUpdateException(CannotMakeAddressException):
    """Exception raised when attempting to edit an existing domain address field."""

    default_code = "address_not_editable"
    default_detail = "You cannot edit an existing domain address field."
    status_code = 400


class DomainAddrUnavailableException(CannotMakeAddressException):
    default_code = "address_unavailable"
    default_detail_template = (
        "“{unavailable_address}” could not be created."
        " Please try again with a different mask name."
    )
    status_code = 400

    def __init__(self, unavailable_address: str):
        self.unavailable_address = unavailable_address
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"unavailable_address": self.unavailable_address}


class DomainAddrDuplicateException(CannotMakeAddressException):
    default_code = "duplicate_address"
    default_detail_template = (
        "“{duplicate_address}” already exists."
        " Please try again with a different mask name."
    )
    status_code = 409

    def __init__(self, duplicate_address: str):
        self.duplicate_address = duplicate_address
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"duplicate_address": self.duplicate_address}


class RelayAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(max_length=64, default=address_default, unique=True)
    domain = models.PositiveSmallIntegerField(
        choices=DOMAIN_CHOICES, default=default_domain_numerical
    )
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveIntegerField(default=0)
    num_blocked = models.PositiveIntegerField(default=0)
    num_level_one_trackers_blocked = models.PositiveIntegerField(default=0, null=True)
    num_replied = models.PositiveIntegerField(default=0)
    num_spam = models.PositiveIntegerField(default=0)
    generated_for = models.CharField(max_length=255, blank=True)
    block_list_emails = models.BooleanField(default=False)
    used_on = models.TextField(default=None, blank=True, null=True)

    class Meta:
        indexes = [
            # Find when a user first used the add-on
            models.Index(
                name="idx_ra_created_by_addon",
                fields=["user"],
                condition=~models.Q(generated_for__exact=""),
                include=["created_at"],
            ),
        ]

    def __str__(self):
        return self.address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(self.address, domain=self.domain_value),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_replied=self.num_replied,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        profile = Profile.objects.get(user=self.user)
        profile.address_last_deleted = datetime.now(UTC)
        profile.num_address_deleted += 1
        profile.num_email_forwarded_in_deleted_address += self.num_forwarded
        profile.num_email_blocked_in_deleted_address += self.num_blocked
        profile.num_level_one_trackers_blocked_in_deleted_address = (
            profile.num_level_one_trackers_blocked_in_deleted_address or 0
        ) + (self.num_level_one_trackers_blocked or 0)
        profile.num_email_replied_in_deleted_address += self.num_replied
        profile.num_email_spam_in_deleted_address += self.num_spam
        profile.num_deleted_relay_addresses += 1
        profile.last_engagement = datetime.now(UTC)
        profile.save()
        return super().delete(*args, **kwargs)

    def save(
        self,
        force_insert: bool | tuple[ModelBase, ...] = False,
        force_update: bool = False,
        using: str | None = None,
        update_fields: Iterable[str] | None = None,
    ) -> None:
        if self._state.adding:
            with transaction.atomic():
                locked_profile = Profile.objects.select_for_update().get(user=self.user)
                check_user_can_make_another_address(locked_profile)
                while True:
                    address_is_allowed = not is_blocklisted(self.address)
                    address_is_valid = valid_address(self.address, self.domain_value)
                    if address_is_valid and address_is_allowed:
                        break
                    self.address = address_default()
                locked_profile.update_abuse_metric(address_created=True)
                locked_profile.last_engagement = datetime.now(UTC)
                locked_profile.save()
        if (not self.user.profile.server_storage) and any(
            (self.description, self.generated_for, self.used_on)
        ):
            self.description = ""
            self.generated_for = ""
            self.used_on = ""
            if update_fields is not None:
                update_fields = {"description", "generated_for", "used_on"}.union(
                    update_fields
                )
        if not self.user.profile.has_premium and self.block_list_emails:
            self.block_list_emails = False
            if update_fields is not None:
                update_fields = {"block_list_emails"}.union(update_fields)
        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

    @property
    def domain_value(self) -> str:
        domain = cast(
            Literal["RELAY_FIREFOX_DOMAIN", "MOZMAIL_DOMAIN"], self.get_domain_display()
        )
        return get_domains_from_settings()[domain]

    @property
    def full_address(self) -> str:
        return f"{self.address}@{self.domain_value}"

    @property
    def metrics_id(self) -> str:
        assert self.id
        # Prefix with 'R' for RelayAddress, since there may be a DomainAddress with the
        # same row ID
        return f"R{self.id}"


def check_user_can_make_another_address(profile: Profile) -> None:
    if profile.is_flagged:
        raise AccountIsPausedException()
    # MPP-3021: return early for premium users to avoid at_max_free_aliases DB query
    if profile.has_premium:
        return
    if profile.at_max_free_aliases:
        raise RelayAddrFreeTierLimitException()


def valid_address_pattern(address):
    #   can't start or end with a hyphen
    #   must be 1-63 lowercase alphanumeric characters and/or hyphens
    valid_address_pattern = re.compile("^(?![-.])[a-z0-9-.]{1,63}(?<![-.])$")
    return valid_address_pattern.match(address) is not None


def valid_address(address: str, domain: str, subdomain: str | None = None) -> bool:
    address_pattern_valid = valid_address_pattern(address)
    address_contains_badword = has_bad_words(address)
    address_already_deleted = 0
    if not subdomain or flag_is_active_in_task(
        "custom_domain_management_redesign", None
    ):
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(address, domain=domain, subdomain=subdomain)
        ).count()
    if (
        address_already_deleted > 0
        or address_contains_badword
        or not address_pattern_valid
    ):
        return False
    return True


class DeletedAddress(models.Model):
    address_hash = models.CharField(max_length=64, db_index=True)
    num_forwarded = models.PositiveIntegerField(default=0)
    num_blocked = models.PositiveIntegerField(default=0)
    num_replied = models.PositiveIntegerField(default=0)
    num_spam = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.address_hash


def check_user_can_make_domain_address(user_profile: Profile) -> None:
    if not user_profile.has_premium:
        raise DomainAddrFreeTierException()

    if not user_profile.subdomain:
        raise DomainAddrNeedSubdomainException()

    if user_profile.is_flagged:
        raise AccountIsPausedException()


class DomainAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(
        max_length=64, validators=[MinLengthValidator(limit_value=1)]
    )
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    domain = models.PositiveSmallIntegerField(choices=DOMAIN_CHOICES, default=2)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    first_emailed_at = models.DateTimeField(null=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveIntegerField(default=0)
    num_blocked = models.PositiveIntegerField(default=0)
    num_level_one_trackers_blocked = models.PositiveIntegerField(default=0, null=True)
    num_replied = models.PositiveIntegerField(default=0)
    num_spam = models.PositiveIntegerField(default=0)
    block_list_emails = models.BooleanField(default=False)
    used_on = models.TextField(default=None, blank=True, null=True)

    class Meta:
        unique_together = ["user", "address"]

    def __str__(self):
        return self.address

    def save(
        self,
        force_insert: bool | tuple[ModelBase, ...] = False,
        force_update: bool = False,
        using: str | None = None,
        update_fields: Iterable[str] | None = None,
    ) -> None:
        user_profile = self.user.profile
        if self._state.adding:
            check_user_can_make_domain_address(user_profile)
            domain_address_valid = valid_address(
                self.address, self.domain_value, user_profile.subdomain
            )
            if not domain_address_valid:
                if self.first_emailed_at:
                    incr_if_enabled("domainaddress.create_via_email_fail")
                raise DomainAddrUnavailableException(unavailable_address=self.address)

            if DomainAddress.objects.filter(
                user=self.user, address=self.address
            ).exists():
                raise DomainAddrDuplicateException(duplicate_address=self.address)

            user_profile.update_abuse_metric(address_created=True)
            user_profile.last_engagement = datetime.now(UTC)
            user_profile.save(update_fields=["last_engagement"])
            incr_if_enabled("domainaddress.create")
            if self.first_emailed_at:
                incr_if_enabled("domainaddress.create_via_email")
        else:
            # The model is in an update state, do not allow 'address' field updates
            existing_instance = DomainAddress.objects.get(id=self.id)
            if existing_instance.address != self.address:
                raise DomainAddrUpdateException()

        if not user_profile.has_premium and self.block_list_emails:
            self.block_list_emails = False
            if update_fields:
                update_fields = {"block_list_emails"}.union(update_fields)
        if (not user_profile.server_storage) and (self.description or self.used_on):
            self.description = ""
            self.used_on = ""
            if update_fields:
                update_fields = {"description", "used_on"}.union(update_fields)
        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

    @property
    def user_profile(self):
        return Profile.objects.get(user=self.user)

    @staticmethod
    def make_domain_address(
        user_profile: Profile, address: str | None = None, made_via_email: bool = False
    ) -> DomainAddress:
        check_user_can_make_domain_address(user_profile)

        if not address:
            # FIXME: if the alias is randomly generated and has bad words
            # we should retry like make_relay_address does
            # not fixing this now because not sure randomly generated
            # DomainAlias will be a feature
            address = address_default()
            # Only check for bad words if randomly generated
        assert isinstance(address, str)

        first_emailed_at = datetime.now(UTC) if made_via_email else None
        domain_address = DomainAddress.objects.create(
            user=user_profile.user, address=address, first_emailed_at=first_emailed_at
        )
        return domain_address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(
                self.address, self.user_profile.subdomain, self.domain_value
            ),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_replied=self.num_replied,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        # self.user_profile is a property and should not be used to
        # update values on the user's profile
        profile = Profile.objects.get(user=self.user)
        profile.address_last_deleted = datetime.now(UTC)
        profile.num_address_deleted += 1
        profile.num_email_forwarded_in_deleted_address += self.num_forwarded
        profile.num_email_blocked_in_deleted_address += self.num_blocked
        profile.num_level_one_trackers_blocked_in_deleted_address = (
            profile.num_level_one_trackers_blocked_in_deleted_address or 0
        ) + (self.num_level_one_trackers_blocked or 0)
        profile.num_email_replied_in_deleted_address += self.num_replied
        profile.num_email_spam_in_deleted_address += self.num_spam
        profile.num_deleted_domain_addresses += 1
        profile.last_engagement = datetime.now(UTC)
        profile.save()
        return super().delete(*args, **kwargs)

    @property
    def domain_value(self) -> str:
        domain = cast(
            Literal["RELAY_FIREFOX_DOMAIN", "MOZMAIL_DOMAIN"], self.get_domain_display()
        )
        return get_domains_from_settings()[domain]

    @property
    def full_address(self) -> str:
        return f"{self.address}@{self.user_profile.subdomain}.{self.domain_value}"

    @property
    def metrics_id(self) -> str:
        assert self.id
        # Prefix with 'D' for DomainAddress, since there may be a RelayAddress with the
        # same row ID
        return f"D{self.id}"


class Reply(models.Model):
    relay_address = models.ForeignKey(
        RelayAddress, on_delete=models.CASCADE, blank=True, null=True
    )
    domain_address = models.ForeignKey(
        DomainAddress, on_delete=models.CASCADE, blank=True, null=True
    )
    lookup = models.CharField(max_length=255, blank=False, db_index=True)
    encrypted_metadata = models.TextField(blank=False)
    created_at = models.DateField(auto_now_add=True, null=False, db_index=True)

    @property
    def address(self):
        return self.relay_address or self.domain_address

    @property
    def profile(self):
        return self.address.user.profile

    @property
    def owner_has_premium(self):
        return self.profile.has_premium

    def increment_num_replied(self):
        address = self.relay_address or self.domain_address
        assert address
        address.num_replied += 1
        address.last_used_at = datetime.now(UTC)
        address.save(update_fields=["num_replied", "last_used_at"])
        return address.num_replied


class AbuseMetrics(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    first_recorded = models.DateTimeField(auto_now_add=True, db_index=True)
    last_recorded = models.DateTimeField(auto_now_add=True, db_index=True)
    num_address_created_per_day = models.PositiveSmallIntegerField(default=0)
    num_replies_per_day = models.PositiveSmallIntegerField(default=0)
    # Values from 0 to 32767 are safe in all databases supported by Django.
    num_email_forwarded_per_day = models.PositiveSmallIntegerField(default=0)
    # Values from 0 to 9.2 exabytes are safe in all databases supported by Django.
    forwarded_email_size_per_day = models.PositiveBigIntegerField(default=0)

    class Meta:
        unique_together = ["user", "first_recorded"]
