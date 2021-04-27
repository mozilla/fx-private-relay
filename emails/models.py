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
        if not self.fxa:
            return False
        user_subscriptions = self.fxa.extra_data.get('subscriptions', [])
        for sub in settings.SUBSCRIPTIONS_WITH_UNLIMITED.split(','):
            if sub in user_subscriptions:
                return True
        return False

    def add_subdomain(self, subdomain):
        # checking for premium user happens before this funciton is called
        if self.subdomain is not None:
            raise CannotMakeSubdomainException('You cannot change your subdomain.')
        subdomain_exists = Profile.objects.filter(subdomain=subdomain)
        if not subdomain or has_bad_words(subdomain) or subdomain_exists:
            raise CannotMakeSubdomainException('Subdomain could not be created, try using a different value.')
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
    pass


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
        profile.address_last_deleted = datetime.now()
        profile.num_address_deleted += 1
        profile.save()
        return super(RelayAddress, self).delete(*args, **kwargs)

    def make_relay_address(user, num_tries=0):
        if num_tries >= 5:
            raise CannotMakeAddressException
        relay_address = RelayAddress.objects.create(user=user)
        address_contains_badword = has_bad_words(relay_address.address)        
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(relay_address.address)
        ).count()
        if address_already_deleted > 0 or address_contains_badword:
            relay_address.delete()
            num_tries += 1
            return RelayAddress.make_relay_address(user, num_tries)
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
    address = models.CharField(max_length=64, unique=True)
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    first_emailed_at = models.DateTimeField(auto_now_add=True, db_index=True)
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

    def make_domain_address(user, address=None):
        address_contains_badword = False
        if address is None:
            address = address_default()
            address_contains_badword = has_bad_words(address)
        
        user_subdomain = Profile.objects.get(user=user).subdomain
        if not user_subdomain or address_contains_badword:
            raise CannotMakeAddressException
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(address, user_subdomain)
        ).count()
        if address_already_deleted > 0:
            raise CannotMakeAddressException
        domain_address = DomainAddress.objects.create(user=user, address=address)
        return domain_address

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        profile = Profile.objects.get(user=self.user)
        deleted_address = DeletedAddress.objects.create(
            address_hash=address_hash(self.address, self.user_profile.subdomain),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        profile.address_last_deleted = datetime.now()
        profile.num_address_deleted += 1
        profile.save()
        return super(DomainAddress, self).delete(*args, **kwargs)
