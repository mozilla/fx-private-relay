from datetime import datetime
from hashlib import sha256
import random
import string
import uuid

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models


emails_config = apps.get_app_config('emails')


class Profile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    api_token = models.UUIDField(default=uuid.uuid4)
    num_address_deleted = models.PositiveIntegerField(default=0)
    address_last_deleted = models.DateTimeField(
        blank=True, null=True, db_index=True
    )

    def __str__(self):
        return '%s Profile' % self.user

    @property
    def num_active_address(self):
        return RelayAddress.objects.filter(user=self.user).count()


def address_default():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))


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
            address_hash=sha256(self.address.encode('utf-8')).hexdigest(),
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
        address_contains_badword = any(
            badword in relay_address.address
            for badword in emails_config.badwords
        )
        address_hash = sha256(
            relay_address.address.encode('utf-8')
        ).hexdigest()
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash
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
