from functools import lru_cache

from django.conf import settings

from .templatetags.relay_tags import premium_plan_price


def django_settings(request):
    return {'settings': settings}

def common(request):
    fxa = _get_fxa(request)
    avatar = fxa.extra_data['avatar'] if fxa else None
    accept_language = request.headers.get('Accept-Language', 'en-US')
    return {
        'avatar': avatar,
        'ftl_mode': 'server',
        'accept_language': accept_language,
        'monthly_price': premium_plan_price(accept_language)
    }

@lru_cache(maxsize=None)
def _get_fxa(request):
    try:
        fxa = request.user.socialaccount_set.filter(provider='fxa').first()
        return fxa
    except AttributeError:
        return None
