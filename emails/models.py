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

    def __str__(self):
        return self.address
