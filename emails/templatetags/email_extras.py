from django import template

register = template.Library()


@register.simple_tag
def bold_violet_text(text):
    return (
        '<span style="font-family: sans-serif; font-weight: bolder; color: #20123a; text-decoration: none; font-size: 13px;">%s</span>'
        % text
    )


@register.simple_tag
def bold_violet_link(href, link_text):
    return (
        '<a href="%s" target="_blank" style="font-family: sans-serif; color: #20123a; text-decoration: underline; font-weight: bolder; font-size: 13px;">%s</a>'
        % (href, link_text)
    )
