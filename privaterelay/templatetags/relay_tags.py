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

@register.simple_tag
def message_in_fluent(message):
    ftl_messages = [
        'success-subdomain-registered',
        'success-settings-update',
        'error-subdomain-not-available',
        'error-premium-cannot-change-subdomain',
        'error-premium-set-subdomain',
        'error-premium-check-subdomain'
    ]
    return message in ftl_messages


def get_premium_country_lang(accept_lang):
    lang = accept_lang.split(',')[0]
    lang_parts = lang.split("-") if lang and "-" in lang else [lang]
    lang = lang_parts[0].lower()
    cc = lang_parts[1] if len(lang_parts) == 2 else lang_parts[0]
    cc = cc.lower()
    if cc in settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING.keys():
        languages = settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING[cc]
        if lang in languages.keys():
            return cc, lang
        return cc, list(languages.keys())[0]
    return 'us', 'en'

@register.simple_tag
def premium_plan_id(accept_lang):
    if settings.PREMIUM_PRICE_ID_OVERRIDE:
        return settings.PREMIUM_PRICE_ID_OVERRIDE
    cc, lang = get_premium_country_lang(accept_lang)
    return settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING[cc][lang]["id"]

@register.simple_tag
def premium_plan_price(accept_lang):
    cc, lang = get_premium_country_lang(accept_lang)
    return settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING[cc][lang]["price"]

@register.simple_tag
def premium_subscribe_url(accept_lang=None):
    plan_id = premium_plan_id(accept_lang)
    return f'{settings.FXA_SUBSCRIPTIONS_URL}/products/{settings.PREMIUM_PROD_ID}?plan={plan_id}'
