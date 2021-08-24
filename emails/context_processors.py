from emails.utils import get_email_domain_from_settings


def relay_from_domain(request):
    return {'RELAY_DOMAIN': get_email_domain_from_settings()}
