from email.utils import parseaddr

from django.conf import settings


def relay_from_domain(request):
    display_name, address = parseaddr(settings.RELAY_FROM_ADDRESS)
    relay_from_domain = address.split('@')[1]
    return {'RELAY_DOMAIN': relay_from_domain}
