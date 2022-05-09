from .models import get_domains_from_settings
from .utils import get_email_domain_from_settings


def relay_from_domain(request):
    return {
        "RELAY_DOMAIN": get_email_domain_from_settings(),
        "MOZMAIL_DOMAIN": get_domains_from_settings().get("MOZMAIL_DOMAIN"),
    }
