from datetime import datetime

from django.core.exceptions import PermissionDenied

from .models import Invitations


ALLOWED_SIGNUP_DOMAINS = [
    'getpocket.com', 'mozilla.com', 'mozillafoundation.org'
]


def invitations_only(sender, **kwargs):
    sociallogin = kwargs['sociallogin']
    email = sociallogin.account.extra_data['email']
    domain_part = email.split('@')[1]
    for allowed_domain in ALLOWED_SIGNUP_DOMAINS:
        if domain_part == allowed_domain:
            return True
    try:
        active_invitation = Invitations.objects.get(email=email, active=True)
    except Invitations.DoesNotExist:
        raise PermissionDenied
    if not active_invitation.date_redeemed:
        active_invitation.date_redeemed = datetime.now()
        active_invitation.save()
    return True
