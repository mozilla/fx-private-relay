from typing import Any

from django.db.models.signals import post_save
from django.dispatch import receiver

from allauth.account.signals import user_logged_in, user_signed_up
from allauth.socialaccount.models import SocialAccount

from emails.utils import incr_if_enabled
from privaterelay.models import update_or_create_subscription


@receiver(user_signed_up)
def record_user_signed_up(request, user, **kwargs):
    incr_if_enabled("user_signed_up", 1)
    # the user_signed_up signal doesn't have access to the response object
    # so we have to set a user_created session var for user_logged_in receiver
    request.session["user_created"] = True
    request.session.modified = True


@receiver(user_logged_in)
def record_user_logged_in(request, user, **kwargs):
    incr_if_enabled("user_logged_in", 1)
    response = kwargs.get("response")
    event = "user_logged_in"
    # the user_signed_up signal doesn't have access to the response object
    # so we have to check for user_created session var from user_signed_up
    if request.session.get("user_created", False):
        event = "user_signed_up"
    if response:
        response.set_cookie(f"server_ga_event:{event}", event, max_age=5)


@receiver(post_save, sender=SocialAccount)
def update_user_subscription(
    sender: SocialAccount, instance: SocialAccount, created: bool, **kwargs: Any
) -> None:
    update_or_create_subscription(instance)
