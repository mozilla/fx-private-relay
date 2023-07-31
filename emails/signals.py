from hashlib import sha256
import logging

from django.contrib.auth.models import User

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from emails.models import Profile
from emails.utils import incr_if_enabled, set_user_group


info_logger = logging.getLogger("eventsinfo")


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
