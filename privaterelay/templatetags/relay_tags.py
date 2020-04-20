from urllib.parse import urlparse

from django import template
from django.conf import settings

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
    return settings.MAX_NUM_BETA_ALIASES-len(aliases)


@register.simple_tag
def manage_fxa_url():
    fxa_profile_url = urlparse(
        settings.SOCIALACCOUNT_PROVIDERS['fxa']['PROFILE_ENDPOINT']
    )
    return '%s://%s/settings' % (
        fxa_profile_url.scheme, fxa_profile_url.netloc
    )
