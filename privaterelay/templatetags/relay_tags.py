from urllib.parse import urlparse

from django import template
from django.conf import settings

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
    return settings.MAX_NUM_FREE_ALIASES-len(aliases)


@register.simple_tag
def user_email_domain(user_profile):
    mail_domain = urlparse(settings.SITE_ORIGIN).netloc
    # on heroku with settings.DEBUG we need to add "mail" prefix
    if settings.DEBUG:
        mail_domain = 'mail.%s' % mail_domain
    return "%s.%s" % (user_profile.subdomain, mail_domain)
