from django import template
from django.template.defaultfilters import stringfilter
from django.utils.html import conditional_escape
from django.utils.safestring import SafeString, mark_safe

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
def convert_fsi_to_span(text: str | SafeString, autoescape=True) -> str | SafeString:
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
        result = (
            f"{conditional_escape(pre_fsi)}"
            f'<span dir="auto">{conditional_escape(middle)}</span>'
            f"{conditional_escape(post_pdi)}"
        )
    else:
        result = f'{pre_fsi}<span dir="auto">{middle}</span>{post_pdi}'
    return mark_safe(result)
