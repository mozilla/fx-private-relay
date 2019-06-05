import random
import string

from django.contrib.auth.models import User
from django.db import models


def address_default():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))


class RelayAddress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    address = models.CharField(
        max_length=64, default=address_default, unique=True
    )


class Message(models.Model):
    relay_address = models.ForeignKey(RelayAddress, on_delete=models.CASCADE)
    from_address = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    message = models.TextField()
