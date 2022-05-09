from django.conf import settings


def get_premium_countries_info_from_request(request):
    country_code = _get_cc_from_request(request)
    premium_countries = settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING.keys()
    premium_available_in_country = country_code in premium_countries
    return {
        "country_code": country_code,
        "premium_countries": premium_countries,
        "premium_available_in_country": premium_available_in_country,
        "plan_country_lang_mapping": settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING,
    }


def _get_cc_from_request(request):
    if "X-Client-Region" in request.headers:
        return request.headers["X-Client-Region"].lower()
    if "Accept-Language" in request.headers:
        return get_premium_country_lang(request.headers["Accept-Language"])[0]
    if settings.DEBUG:
        return "us"
    return "us"


def get_premium_country_lang(accept_lang, cc=None):
    lang = accept_lang.split(",")[0]
    lang_parts = lang.split("-") if lang and "-" in lang else [lang]
    lang = lang_parts[0].lower()
    if cc is None:
        cc = lang_parts[1] if len(lang_parts) == 2 else lang_parts[0]
        cc = cc.lower()
        # if the language was just "en", default to US
        if cc == "en":
            cc = "us"

    if cc in settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING.keys():
        languages = settings.PREMIUM_PLAN_COUNTRY_LANG_MAPPING[cc]
        if lang in languages.keys():
            return cc, lang
        return cc, list(languages.keys())[0]
    return cc, "en"
