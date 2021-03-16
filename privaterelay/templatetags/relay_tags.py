from urllib.parse import urlparse

from django import template
from django.conf import settings

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
    return settings.MAX_NUM_FREE_ALIASES-len(aliases)


@register.simple_tag
def user_email_domain(user_profile):
    return "%s@%s" % (user_profile.subdomain, urlparse(settings.SITE_ORIGIN).netloc)
