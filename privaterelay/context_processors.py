from datetime import datetime, timedelta, timezone
from functools import lru_cache

from django.conf import settings

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

    first_visit = request.COOKIES.get("first_visit")
    show_nps = (
        first_visit is not None and
        not request.user.is_anonymous and
        (datetime.now(timezone.utc) > datetime.fromisoformat(first_visit) + timedelta(days = 3))
    )

    common_vars = {
        'avatar': avatar,
        'ftl_mode': 'server',
        'accept_language': accept_language,
        'country_code': country_code,
        'show_nps': show_nps,
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
