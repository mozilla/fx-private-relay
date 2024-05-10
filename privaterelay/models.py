from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models

from allauth.socialaccount.models import SocialAccount


def update_or_create_subscription(social_account: SocialAccount) -> Subscription:
    subscription = Subscription.objects.get_or_create(user=social_account.user)[0]

    user_subscriptions = social_account.extra_data.get("subscriptions", [])
    relay_subscriptions = ""
    for sub in settings.SUBSCRIPTIONS_WITH_UNLIMITED:
        if sub in user_subscriptions:
            relay_subscriptions += f"{sub},"

    subscription.names = relay_subscriptions
    subscription.save()
    return subscription


class Subscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    names = models.TextField(default=None, blank=True, null=True)
