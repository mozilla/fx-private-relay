from django.dispatch import receiver

from allauth.account.signals import user_signed_up, user_logged_in

from emails.utils import incr_if_enabled


@receiver(user_signed_up)
def record_user_signed_up(request, user, **kwargs):
    incr_if_enabled('user_signed_up', 1)
    # the user_signed_up signal doesn't have access to the response object
    # so we have to set a user_created session var for user_logged_in receiver
    request.session['user_created'] = True
    request.session.modified = True


@receiver(user_logged_in)
def record_user_logged_in(request, user, **kwargs):
    incr_if_enabled('user_logged_in', 1)
    response = kwargs.get('response')
    event = 'user_logged_in'
    # the user_signed_up signal doesn't have access to the response object
    # so we have to check for user_created session var from user_signed_up
    if request.session.get('user_created', False):
        event = 'user_signed_up'
    if response:
        response.set_cookie(f'server_ga_event:{event}', event, max_age=5)
