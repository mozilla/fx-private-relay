from django import template
from django.template.defaultfilters import stringfilter
from django.utils.html import conditional_escape
from django.utils.safestring import mark_safe

register = template.Library()


@register.simple_tag
def bold_violet_text(text):
    return (
        '<span style="font-family: sans-serif; font-weight: bolder; color: #20123a;'
        f' text-decoration: none; font-size: 13px;">{text}</span>'
    )


@register.simple_tag
def bold_violet_link(href, link_text):
    return (
        f'<a href="{href}" target="_blank" style="font-family: sans-serif;'
        " color: #20123a; text-decoration: underline; font-weight: bolder;"
        f' font-size: 13px;">{link_text}</a>'
    )


@register.filter(needs_autoescape=True)
@stringfilter
def convert_fsi_to_span(text, autoescape=True):
    """
    Replace Fluent's unicode isolating characters with HTML markup.

    U+2068 is FIRST-STRONG ISOLATE (FSI), direction depends on content
    U+2069 is POP DIRECTIONAL ISOLATE (PDI), ends FSI and other isolates
    HTML equivalent is <span dir="auto">...</span>

    See:
    https://www.w3.org/International/questions/qa-bidi-unicode-controls
    """
    try:
        pre_fsi, after_fsi = text.split("\u2068", 1)
        middle, post_pdi = after_fsi.split("\u2069", 1)
    except ValueError:
        # No FSI or POP DIRECTIONAL ISOLATE, or in wrong sequence
        return text
    if autoescape:
        esc = conditional_escape
    else:
        esc = lambda x: x  # noqa: E731
    result = f'{esc(pre_fsi)}<span dir="auto">{esc(middle)}</span>{esc(post_pdi)}'
    return mark_safe(result)
