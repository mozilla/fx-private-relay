from django.core.exceptions import PermissionDenied


ALLOWED_SIGNUP_DOMAINS = [
    'getpocket.com', 'mozilla.com', 'mozillafoundation.org'
]


def mozillians_only(sender, **kwargs):
    sociallogin = kwargs['sociallogin']
    email = sociallogin.account.extra_data['email']
    for allowed_domain in ALLOWED_SIGNUP_DOMAINS:
        if email.endswith(allowed_domain):
            return True
    raise PermissionDenied
