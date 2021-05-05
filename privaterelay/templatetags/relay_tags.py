from django import template
from django.conf import settings

from emails.utils import get_email_domain_from_settings

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
    return settings.MAX_NUM_FREE_ALIASES-len(aliases)


@register.simple_tag
def user_email_domain(user_profile):
    mail_domain = get_email_domain_from_settings()
    return "%s.%s" % (user_profile.subdomain, mail_domain)
