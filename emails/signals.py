from django.contrib.auth.models import User
# use SuspiciousOperation when we need to raise a 4xx error
from django.core.exceptions import SuspiciousOperation
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from emails.models import DomainAddress, Profile, RelayAddress
from emails.utils import set_user_group


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        set_user_group(instance)
        Profile.objects.create(user=instance)


def check_premium_for_block_list_emails(sender, instance, **kwargs):
    if not instance.user.profile_set.first().has_premium:
        try:
            obj = sender.objects.get(pk=instance.pk)
            if obj.block_list_emails != instance.block_list_emails:
                raise SuspiciousOperation(
                    'Must be premium to set block_list_emails'
                )
        except sender.DoesNotExist:
            if instance.block_list_emails:
                raise SuspiciousOperation(
                    'Must be premium to set block_list_emails'
                )
pre_save.connect(check_premium_for_block_list_emails, sender=RelayAddress)
pre_save.connect(check_premium_for_block_list_emails, sender=DomainAddress)
