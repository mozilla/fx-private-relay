from django import template
from django.conf import settings

from emails.utils import get_email_domain_from_settings

from ..utils import get_premium_country_lang

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
    return settings.MAX_NUM_FREE_ALIASES - len(aliases)


@register.simple_tag
def user_email_domain(user_profile):
    mail_domain = get_email_domain_from_settings()
    return "%s.%s" % (user_profile.subdomain, mail_domain)


@register.simple_tag
def message_in_fluent(message):
    ftl_messages = [
        "success-subdomain-registered-2",
        "success-settings-update",
        "error-subdomain-not-available-2",
        "error-premium-cannot-change-subdomain",
        "error-premium-set-subdomain",
        "error-premium-check-subdomain",
    ]
    return message in ftl_messages
