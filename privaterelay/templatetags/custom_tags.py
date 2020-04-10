from django import template

register = template.Library()


@register.simple_tag
def remaining_free_aliases(aliases):
  return 5-len(aliases)
