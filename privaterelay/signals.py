from django.core.exceptions import PermissionDenied


def mozillians_only(sender, **kwargs):
    sociallogin = kwargs['sociallogin']
    if not sociallogin.account.extra_data['email'].endswith('@mozilla.com'):
        raise PermissionDenied
