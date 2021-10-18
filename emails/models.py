from collections import namedtuple
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import logging
import random
import re
import string
import uuid

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.dispatch import receiver
from django.utils.translation.trans_real import (
    parse_accept_lang_header,
    get_supported_language_variant,
)

from rest_framework.authtoken.models import Token

emails_config = apps.get_app_config('emails')
logger = logging.getLogger('events')

BounceStatus = namedtuple('BounceStatus', 'paused type')

NOT_PREMIUM_USER_ERR_MSG = 'You must be a premium subscriber to {}.'
TRY_DIFFERENT_VALUE_ERR_MSG = '{} could not be created, try using a different value.'


def get_domains_from_settings():
    return {
        'RELAY_FIREFOX_DOMAIN': settings.RELAY_FIREFOX_DOMAIN,
        'MOZMAIL_DOMAIN': settings.MOZMAIL_DOMAIN
    }


DOMAINS = get_domains_from_settings()
DOMAIN_CHOICES = [(1, 'RELAY_FIREFOX_DOMAIN'), (2, 'MOZMAIL_DOMAIN')]
DEFAULT_DOMAIN = settings.RELAY_FIREFOX_DOMAIN
if settings.TEST_MOZMAIL:
    DEFAULT_DOMAIN = settings.MOZMAIL_DOMAIN
PREMIUM_DOMAINS = ['mozilla.com', 'getpocket.com', 'mozillafoundation.org']


def valid_available_subdomain(subdomain, *args, **kwargs):
    # valid subdomains:
    #   can't start or end with a hyphen
    #   must be 1-63 alphanumeric characters and/or hyphens
    valid_subdomain_pattern = re.compile('^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$')
    valid = valid_subdomain_pattern.match(subdomain) is not None
    #   can't have "bad" words in them
    bad_word = has_bad_words(subdomain)
    #   can't have "blocked" words in them
    blocked_word = is_blocklisted(subdomain)
    #   can't be taken by someone else
    taken = RegisteredSubdomain.objects.filter(
        subdomain_hash=hash_subdomain(subdomain)
    ).count() > 0
    if not valid or bad_word or blocked_word or taken:
        raise CannotMakeSubdomainException('error-subdomain-not-available')
    return True


class Profile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    api_token = models.UUIDField(default=uuid.uuid4)
    num_address_deleted = models.PositiveIntegerField(default=0)
    address_last_deleted = models.DateTimeField(
        blank=True, null=True, db_index=True
    )
    last_soft_bounce = models.DateTimeField(
        blank=True, null=True, db_index=True
    )
    last_hard_bounce = models.DateTimeField(
        blank=True, null=True, db_index=True
    )
    subdomain = models.CharField(
        blank=True, null=True, unique=True, max_length=63, db_index=True,
        validators=[valid_available_subdomain]
    )
    server_storage = models.BooleanField(default=False)

    def __str__(self):
        return '%s Profile' % self.user

    def save(self, *args, **kwargs):
        ret = super().save(*args, **kwargs)
        # any time a profile is saved with server_storage False, delete the
        # appropriate server-stored Relay address data.
        if not self.server_storage:
            relay_addresses = RelayAddress.objects.filter(user=self.user)
            relay_addresses.update(description='', generated_for='')
        return ret

    @property
    def language(self):
        if self.fxa.extra_data.get('locale'):
            for accept_lang, _ in parse_accept_lang_header(
                self.fxa.extra_data.get('locale')
            ):
                try:
                    return get_supported_language_variant(accept_lang)
                except LookupError:
                    continue
        return 'en'

    @property
    def num_active_address(self):
        return (
            RelayAddress.objects.filter(user=self.user).count() +
            DomainAddress.objects.filter(user=self.user).count()
        )

    def check_bounce_pause(self):
        if self.last_hard_bounce:
            last_hard_bounce_allowed = (
                datetime.now(timezone.utc) -
                timedelta(days=settings.HARD_BOUNCE_ALLOWED_DAYS)
            )
            if self.last_hard_bounce > last_hard_bounce_allowed:
                return BounceStatus(True, 'hard')
            self.last_hard_bounce = None
            self.save()
        if self.last_soft_bounce:
            last_soft_bounce_allowed = (
                datetime.now(timezone.utc) -
                timedelta(days=settings.SOFT_BOUNCE_ALLOWED_DAYS)
            )
            if self.last_soft_bounce > last_soft_bounce_allowed:
                return BounceStatus(True, 'soft')
            self.last_soft_bounce = None
            self.save()
        return BounceStatus(False, '')

    @property
    def next_email_try(self):
        bounce_pause, bounce_type = self.check_bounce_pause()

        if not bounce_pause:
            return datetime.now(timezone.utc)

        if bounce_type == 'soft':
            return self.last_soft_bounce + timedelta(
                days=settings.SOFT_BOUNCE_ALLOWED_DAYS
            )

        return self.last_hard_bounce + timedelta(
            days=settings.HARD_BOUNCE_ALLOWED_DAYS
        )

    @property
    def last_bounce_date(self):
        if self.last_hard_bounce:
            return self.last_hard_bounce
        if self.last_soft_bounce:
            return self.last_soft_bounce
        return None

    @property
    def at_max_free_aliases(self):
        relay_addresses_count = RelayAddress.objects.filter(
            user=self.user
        ).count()
        return relay_addresses_count >= settings.MAX_NUM_FREE_ALIASES

    @property
    def fxa(self):
        return self.user.socialaccount_set.filter(provider='fxa').first()

    @property
    def display_name(self):
        # if display name is not set on FxA the
        # displayName key will not exist on the extra_data
        return self.fxa.extra_data.get('displayName')

    @property
    def has_premium(self):
        # FIXME: as we don't have all the tiers defined we are over-defining
        # this to mark the user as a premium user as well
        if not self.fxa:
            return False
        for premium_domain in PREMIUM_DOMAINS:
            if self.user.email.endswith(f'@{premium_domain}'):
                return True
        user_subscriptions = self.fxa.extra_data.get('subscriptions', [])
        for sub in settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(','):
            if sub in user_subscriptions:
                return True
        return False

    @property
    def emails_forwarded(self):
        relay_addresses_forwarded = RelayAddress.objects.filter(
            user=self.user
        ).values('num_forwarded')
        domain_addresses_forwarded = DomainAddress.objects.filter(
            user=self.user
        ).values('num_forwarded')
        return (
            sum(forwarded['num_forwarded'] for forwarded in relay_addresses_forwarded) +
            sum(forwarded['num_forwarded'] for forwarded in domain_addresses_forwarded)
        )

    @property
    def emails_blocked(self):
        relay_addresses_blocked = RelayAddress.objects.filter(
            user=self.user
        ).values('num_blocked')
        domain_addresses_blocked = DomainAddress.objects.filter(
            user=self.user
        ).values('num_blocked')
        return (
            sum(blocked['num_blocked'] for blocked in relay_addresses_blocked) +
            sum(blocked['num_blocked'] for blocked in domain_addresses_blocked)
        )

    @property
    def joined_before_premium_release(self):
        date_created = self.user.date_joined
        return date_created < settings.PREMIUM_RELEASE_DATE

    def add_subdomain(self, subdomain):
        if not self.has_premium:
            raise CannotMakeSubdomainException('error-premium-set-subdomain')
        if self.subdomain is not None:
            raise CannotMakeSubdomainException('error-premium-cannot-change-subdomain')
        self.subdomain = subdomain
        self.full_clean()
        self.save()

        RegisteredSubdomain.objects.create(subdomain_hash=hash_subdomain(subdomain))
        return subdomain


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


def address_hash(address, subdomain=None, domain=DEFAULT_DOMAIN):
    if subdomain:
        return sha256(
            f'{address}@{subdomain}.{domain}'.encode('utf-8')
        ).hexdigest()
    if domain == settings.RELAY_FIREFOX_DOMAIN:
        return sha256(
            f'{address}'.encode('utf-8')
        ).hexdigest()
    return sha256(
        f'{address}@{domain}'.encode('utf-8')
    ).hexdigest()


def address_default():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))


def has_bad_words(value):
    for badword in emails_config.badwords:
        badword = badword.strip()
        if len(badword) <= 4 and badword == value:
            return True
        if len(badword) > 4 and badword in value:
            return True
    return False


def is_blocklisted(value):
    return any(
        blockedword == value
        for blockedword in emails_config.blocklist
    )


def get_domain_numerical(domain_address):
    # get domain name from the address
    domains_keys = list(DOMAINS.keys())
    domains_values = list(DOMAINS.values())
    domain_name = domains_keys[domains_values.index(domain_address)]
    # get domain numerical value from domain name
    choices = dict(DOMAIN_CHOICES)
    choices_keys = list(choices.keys())
    choices_values = list(choices.values())
    return choices_keys[choices_values.index(domain_name)]


def hash_subdomain(subdomain, domain=settings.MOZMAIL_DOMAIN):
    return sha256(
        f'{subdomain}.{domain}'.encode('utf-8')
    ).hexdigest()


class RegisteredSubdomain(models.Model):
    subdomain_hash = models.CharField(max_length=64, db_index=True, unique=True)
    registered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.address_hash


class CannotMakeSubdomainException(Exception):
    """Exception raised by Profile due to error on subdomain creation.

    Attributes:
        message -- optional explanation of the error
    """

    def __init__(self, message=None):
        self.message = message


class CannotMakeAddressException(Exception):
    """Exception raised by RelayAddress or DomainAddress due to error on alias creation.

    Attributes:
        message -- optional explanation of the error
    """

    def __init__(self, message=None):
        self.message = message


class RelayAddress(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(
        max_length=64, default=address_default, unique=True
    )
    domain = models.PositiveSmallIntegerField(choices=DOMAIN_CHOICES, default=1)
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveIntegerField(default=0)
    num_blocked = models.PositiveIntegerField(default=0)
    num_spam = models.PositiveIntegerField(default=0)
    generated_for = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(self.address, domain=self.domain_value),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        profile = Profile.objects.get(user=self.user)
        profile.address_last_deleted = datetime.now(timezone.utc)
        profile.num_address_deleted += 1
        profile.save()
        return super(RelayAddress, self).delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        if self._state.adding:
            check_user_can_make_another_address(self.user)
            while True:
                if valid_address(self.address, self.domain):
                    break
                self.address = address_default()
            self.domain = get_domain_from_env_vars_and_profile(self.user)
        return super().save(*args, **kwargs)

    @property
    def domain_value(self):
        return DOMAINS.get(self.get_domain_display())

    @property
    def full_address(self):
        return '%s@%s' % (self.address, self.domain_value)


def check_user_can_make_another_address(user):
    user_profile = user.profile_set.first()
    if (user_profile.at_max_free_aliases and not user_profile.has_premium):
        hit_limit = f'make more than {settings.MAX_NUM_FREE_ALIASES} aliases'
        raise CannotMakeAddressException(
            NOT_PREMIUM_USER_ERR_MSG.format(hit_limit)
        )


def valid_address(address, domain):
    address_contains_badword = has_bad_words(address)
    address_is_blocklisted = is_blocklisted(address)
    address_already_deleted = DeletedAddress.objects.filter(
        address_hash=address_hash(address, domain=domain)
    ).count()
    if (
        address_already_deleted > 0 or
        address_contains_badword or
        address_is_blocklisted
    ):
        return False
    return True


def get_domain_from_env_vars_and_profile(user):
    user_profile = user.profile_set.first()
    domain = DOMAINS.get('RELAY_FIREFOX_DOMAIN')
    if user_profile.has_premium or settings.TEST_MOZMAIL:
            domain = DOMAINS.get('MOZMAIL_DOMAIN')
    return get_domain_numerical(domain)


class DeletedAddress(models.Model):
    address_hash = models.CharField(max_length=64, db_index=True)
    num_forwarded = models.PositiveIntegerField(default=0)
    num_blocked = models.PositiveIntegerField(default=0)
    num_spam = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.address_hash


class DomainAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(max_length=64)
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    domain = models.PositiveSmallIntegerField(choices=DOMAIN_CHOICES, default=2)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    first_emailed_at = models.DateTimeField(null=True, db_index=True)
    last_used_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveIntegerField(default=0)
    num_blocked = models.PositiveIntegerField(default=0)
    num_spam = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.address

    @property
    def user_profile(self):
        return Profile.objects.get(user=self.user)

    def make_domain_address(user_profile, address=None, made_via_email=False):
        if not user_profile.has_premium:
            raise CannotMakeAddressException(
                NOT_PREMIUM_USER_ERR_MSG.format('create subdomain aliases')
            )

        user_subdomain = Profile.objects.get(user=user_profile.user).subdomain
        if not user_subdomain:
            raise CannotMakeAddressException(
                'You must select a subdomain before creating email address with subdomain.'
            )

        address_contains_badword = False
        if not address:
            # FIXME: if the alias is randomly generated and has bad words
            # we should retry like make_relay_address does
            # not fixing this now because not sure randomly generated
            # DomainAlias will be a feature
            address = address_default()
            # Only check for bad words if randomly generated
            address_contains_badword = has_bad_words(address)
        address_is_blocklisted = is_blocklisted(address)
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(address, user_subdomain)
        ).count()
        if address_contains_badword or address_is_blocklisted or address_already_deleted > 0:
            raise CannotMakeAddressException(
                TRY_DIFFERENT_VALUE_ERR_MSG.format('Email address with subdomain')
            )

        domain_address = DomainAddress.objects.create(
            user=user_profile.user,
            address=address,
        )
        if made_via_email:
            # update first_emailed_at indicating alias generation impromptu.
            domain_address.first_emailed_at = datetime.now(timezone.utc)
            domain_address.save()
        return domain_address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(self.address, self.user_profile.subdomain, self.domain_value),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        self.user_profile.address_last_deleted = datetime.now(timezone.utc)
        self.user_profile.num_address_deleted += 1
        self.user_profile.save()
        return super(DomainAddress, self).delete(*args, **kwargs)

    @property
    def domain_value(self):
        return DOMAINS.get(self.get_domain_display())

    @property
    def full_address(self):
        return '%s@%s.%s' % (
            self.address, self.user_profile.subdomain, self.domain_value
        )


class Reply(models.Model):
    relay_address = models.ForeignKey(RelayAddress, on_delete=models.CASCADE, blank=True, null=True)
    domain_address = models.ForeignKey(
        DomainAddress, on_delete=models.CASCADE, blank=True, null=True
    )
    lookup = models.CharField(max_length=255, blank=False, db_index=True)
    encrypted_metadata = models.TextField(blank=False)
    created_at = models.DateField(auto_now_add=True, null=False)

    @property
    def address(self):
        return self.relay_address or self.domain_address

    @property
    def owner_has_premium(self):
        profile = self.address.user.profile_set.first()
        return profile.has_premium
