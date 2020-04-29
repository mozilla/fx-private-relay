from django import template
from django.conf import settings

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
    return settings.MAX_NUM_BETA_ALIASES-len(aliases)
