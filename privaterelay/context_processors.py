from datetime import datetime, timezone
from functools import lru_cache

from django.conf import settings

from ..emails.models import Profile
from .templatetags.relay_tags import premium_plan_price
from .utils import get_premium_countries_info_from_request


def django_settings(request):
    return {'settings': settings}

def common(request):
    fxa = _get_fxa(request)
    avatar = fxa.extra_data['avatar'] if fxa else None
    accept_language = request.headers.get('Accept-Language', 'en-US')
    country_code = request.headers.get('X-Client-Region', 'us').lower()
    premium_countries_vars = (
        get_premium_countries_info_from_request(request)
    )

    csat_dismissal_cookie, csat_reason = _get_csat_cookie_and_reason(request)

    lang = accept_language.split(',')[0]
    lang_parts = lang.split("-") if lang and "-" in lang else [lang]
    lang = lang_parts[0].lower()
    show_csat = (
        csat_reason is not None and
        (lang == 'en' or lang == 'fr' or lang == 'de')
    )

    common_vars = {
        'avatar': avatar,
        'ftl_mode': 'server',
        'accept_language': accept_language,
        'country_code': country_code,
        'show_csat': show_csat,
        'csat_dismissal_cookie': csat_dismissal_cookie,
        'monthly_price': premium_plan_price(
            accept_language, premium_countries_vars['country_code']
        ),
    }
    return {**common_vars, **premium_countries_vars}

@lru_cache(maxsize=None)
def _get_fxa(request):
    try:
        fxa = request.user.socialaccount_set.filter(provider='fxa').first()
        return fxa
    except AttributeError:
        return None


@lru_cache(maxsize=None)
def _get_csat_cookie_and_reason(request):
    if request.user.is_anonymous:
        return '', None

    day_periods = [7, 30, 90]
    profile = request.user.profile_set.first()
    first_visit = request.COOKIES.get("first_visit")
    reasons = ['free', 'premium']
    days_since_args = {
        'free': first_visit,
        'premium': profile,
    }

    for reason in reasons:
        days_since = _get_days_since(days_since_args[reason])
        if reason == 'premium' and days_since == None:
            return '', None
        for num_days in day_periods:
            if (days_since >= num_days):
                csat_dismissal_cookie = (
                    f'csat-survey-{reason}-{num_days}days_dismissed'
                )
                if (request.COOKIES.get(csat_dismissal_cookie)):
                    return csat_dismissal_cookie, None
                return csat_dismissal_cookie, f'{reason}{num_days}days'

    return '', None


def _get_days_since(days_since_arg):
    now = datetime.now(timezone.utc)
    if type(days_since_arg == Profile):
        profile = days_since_arg
        if not profile.has_premium or not profile.date_subscribed:
            return None
        return (now - profile.date_subscribed).days
    first_visit = days_since_arg
    return (now - first_visit).days
