from __future__ import annotations

from django.contrib.auth.models import User
from django.db import models


class Subscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    names = models.TextField(default=None, blank=True, null=True)
