import logging
from hashlib import sha256

from django.contrib.auth.models import User
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from allauth.account.signals import user_logged_in, user_signed_up
from rest_framework.authtoken.models import Token

from emails.utils import incr_if_enabled, set_user_group

from .models import Profile

info_logger = logging.getLogger("eventsinfo")


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


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        set_user_group(instance)
        Profile.objects.create(user=instance)


@receiver(pre_save, sender=Profile)
def measure_feature_usage(sender, instance, **kwargs):
    if instance._state.adding:
        # if newly created Profile ignore the signal
        return
    curr_profile = Profile.objects.get(id=instance.id)

    # measure tracker removal usage
    changed_tracker_removal_setting = (
        instance.remove_level_one_email_trackers
        != curr_profile.remove_level_one_email_trackers
    )
    if changed_tracker_removal_setting:
        if instance.remove_level_one_email_trackers:
            incr_if_enabled("tracker_removal_enabled")
        if not instance.remove_level_one_email_trackers:
            incr_if_enabled("tracker_removal_disabled")
        info_logger.info(
            "tracker_removal_feature",
            extra={
                "enabled": instance.remove_level_one_email_trackers,
                # TODO create a utility function or property for hashed fxa uid
                "hashed_uid": sha256(instance.fxa.uid.encode("utf-8")).hexdigest(),
            },
        )


@receiver(post_save, sender=Profile)
def copy_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        # baker triggers created during tests
        # so first check the user doesn't already have a Token
        try:
            Token.objects.get(user=instance.user)
            return
        except Token.DoesNotExist:
            Token.objects.create(user=instance.user, key=instance.api_token)
