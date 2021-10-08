from django.dispatch import receiver

from allauth.account.signals import user_signed_up, user_logged_in

from emails.utils import incr_if_enabled


@receiver(user_signed_up)
def record_user_signed_up(request, user, **kwargs):
    incr_if_enabled('user_signed_up', 1)


@receiver(user_logged_in)
def record_user_logged_in(request, user, **kwargs):
    incr_if_enabled('user_logged_in', 1)
