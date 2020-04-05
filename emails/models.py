from hashlib import sha256
import random
import string
import uuid

from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    api_token = models.UUIDField(default=uuid.uuid4)

    def __str__(self):
        return '%s Profile' % self.user


def address_default():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))


class RelayAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(
        max_length=64, default=address_default, unique=True
    )
    enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    num_forwarded = models.PositiveSmallIntegerField(default=0)
    num_blocked = models.PositiveSmallIntegerField(default=0)
    num_spam = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return self.address

    def make_relay_address(user):
        relay_address = RelayAddress.objects.create(user=user)
        address_hash = sha256(relay_address.address.encode('utf-8')).hexdigest()
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash
        ).count()
        if address_already_deleted > 0:
            relay_address.delete()
            return RelayAddress.make_relay_address(user)
        return relay_address


class DeletedAddress(models.Model):
    address_hash = models.CharField(max_length=64)
