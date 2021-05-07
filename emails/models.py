from collections import namedtuple
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import random
import string
import uuid

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.db import models


emails_config = apps.get_app_config('emails')


BounceStatus = namedtuple('BounceStatus', 'paused type')

NOT_PREMIUM_USER_ERR_MSG = 'You must be a premium subscriber to {}.'
TRY_DIFFERENT_VALUE_ERR_MSG = '{} could not be created, try using a different value.'


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
        blank=True, null=True, unique=True, max_length=12, db_index=True
    )

    def __str__(self):
        return '%s Profile' % self.user

    @property
    def num_active_address(self):
        return RelayAddress.objects.filter(user=self.user).count()

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
    def has_unlimited(self):
        # FIXME: as we don't have all the tiers defined we are over-defining
        # this to mark the user as a premium user as well
        if not self.fxa:
            return False
        user_subscriptions = self.fxa.extra_data.get('subscriptions', [])
        for sub in settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(','):
            if sub in user_subscriptions:
                return True
        return False

    def add_subdomain(self, subdomain):
        if not self.has_unlimited:
            raise CannotMakeSubdomainException(NOT_PREMIUM_USER_ERR_MSG.format('set a subdomain'))
        if self.subdomain is not None:
            raise CannotMakeSubdomainException('You cannot change your subdomain.')
        subdomain_exists = Profile.objects.filter(subdomain=subdomain)
        if not subdomain or has_bad_words(subdomain) or subdomain_exists:
            raise CannotMakeSubdomainException(TRY_DIFFERENT_VALUE_ERR_MSG.format('Subdomain'))
        self.subdomain = subdomain
        self.save()
        return subdomain


def address_hash(address, subdomain=None):
    if subdomain:
        return sha256(
            f'{address}@{subdomain}'.encode('utf-8')
        ).hexdigest()
    return sha256(
            f'{address}'.encode('utf-8')
        ).hexdigest()


def address_default():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))


def has_bad_words(value):
    return any(
        badword in value
        for badword in emails_config.badwords
    )


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
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveSmallIntegerField(default=0)
    num_blocked = models.PositiveSmallIntegerField(default=0)
    num_spam = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return self.address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(self.address),
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

    def make_relay_address(user_profile, num_tries=0):
        if (
            user_profile.at_max_free_aliases
            and not user_profile.has_unlimited
        ):
            hit_limit = f'make more than {settings.MAX_NUM_FREE_ALIASES} aliases'
            raise CannotMakeAddressException(
                NOT_PREMIUM_USER_ERR_MSG.format(hit_limit)
            )
        if num_tries >= 5:
            raise CannotMakeAddressException
        relay_address = RelayAddress.objects.create(user=user_profile.user)
        address_contains_badword = has_bad_words(relay_address.address)
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(relay_address.address)
        ).count()
        if address_already_deleted > 0 or address_contains_badword:
            relay_address.delete()
            num_tries += 1
            return RelayAddress.make_relay_address(user_profile, num_tries)
        return relay_address


class DeletedAddress(models.Model):
    address_hash = models.CharField(max_length=64, db_index=True)
    num_forwarded = models.PositiveSmallIntegerField(default=0)
    num_blocked = models.PositiveSmallIntegerField(default=0)
    num_spam = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return self.address_hash


class DomainAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(max_length=64)
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    first_emailed_at = models.DateTimeField(null=True, db_index=True)
    last_used_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveSmallIntegerField(default=0)
    num_blocked = models.PositiveSmallIntegerField(default=0)
    num_spam = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return self.address

    @property
    def user_profile(self):
        return Profile.objects.get(user=self.user)

    def make_domain_address(user_profile, address=None, made_via_email=False):
        if not user_profile.has_unlimited:
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
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(address, user_subdomain)
        ).count()
        if address_contains_badword or address_already_deleted > 0:
            raise CannotMakeAddressException(
                TRY_DIFFERENT_VALUE_ERR_MSG.format('Email address with subdomain')
            )

        domain_address = DomainAddress.objects.create(user=user_profile.user, address=address)
        if made_via_email:
            # update first_emailed_at indicating alias generation impromptu.
            domain_address.first_emailed_at = datetime.now(timezone.utc)
            domain_address.save()
        return domain_address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(self.address, self.user_profile.subdomain),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        self.user_profile.address_last_deleted = datetime.now(timezone.utc)
        self.user_profile.num_address_deleted += 1
        self.user_profile.save()
        return super(DomainAddress, self).delete(*args, **kwargs)
