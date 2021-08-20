import functools
import re
import time

import markus


metrics = markus.get_metrics('fx-private-relay')


class FxAToRequest:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            return self.get_response(request)

        fxa_account = (
            request.user.socialaccount_set.filter(provider='fxa').first()
        )

        if not fxa_account:
            return self.get_response(request)

        request.fxa_account = fxa_account
        return self.get_response(request)


def _get_metric_view_name(request):
    if request.resolver_match:
        view = request.resolver_match.func
        return f'{view.__module__}.{view.__name__}'
    return '<unknown_view>'


class ResponseMetrics:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        delta = time.time() - start_time

        view_name = _get_metric_view_name(request)

        metrics.timing('response', value=delta * 1000.0, tags=[
            f'status:{response.status_code}',
            f'view:{view_name}',
            f'method:{request.method}',
        ])

        return response


class FixLanguageCodeForDjangoFtl:
    # Django converts all zh-* codes into either zh-hans or zh-hant
    # django_ftl looks for zh-cn, zh-tw, etc.
    # So, restore the zh- code that django_ftl expects
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.LANGUAGE_CODE in ['zh-hans', 'zh-hant']:
            request.LANGUAGE_CODE = parse_accept_lang_header(
                request.headers['Accept-Language']
            )[0][0]
        return self.get_response(request)


# Uplifted from django.utils.translation
accept_language_re = re.compile(r'''
        ([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*|\*)      # "en", "en-au", "x-y-z", "es-419", "*"
        (?:\s*;\s*q=(0(?:\.\d{,3})?|1(?:\.0{,3})?))?  # Optional "q=1.00", "q=0.8"
        (?:\s*,\s*|$)                                 # Multiple accepts per header.
        ''', re.VERBOSE)


# Uplifted from django.utils.translation
@functools.lru_cache(maxsize=1000)
def parse_accept_lang_header(lang_string):
    """
    Parse the lang_string, which is the body of an HTTP Accept-Language
    header, and return a tuple of (lang, q-value), ordered by 'q' values.

    Return an empty tuple if there are any format errors in lang_string.
    """
    result = []
    pieces = accept_language_re.split(lang_string.lower())
    if pieces[-1]:
        return ()
    for i in range(0, len(pieces) - 1, 3):
        first, lang, priority = pieces[i:i + 3]
        if first:
            return ()
        if priority:
            priority = float(priority)
        else:
            priority = 1.0
        result.append((lang, priority))
    result.sort(key=lambda k: k[1], reverse=True)
    return result
