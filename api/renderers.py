import vobject

from django.conf import settings
from django.templatetags.static import static

from rest_framework import renderers


class vCardRenderer(renderers.BaseRenderer):
    media_type = 'text/x-vcard'
    format = 'vcf'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        vCard = vobject.vCard()
        vCard.add("FN").value = "Firefox Relay"
        # TODO: fix static urls
        photo_url = settings.SITE_ORIGIN + static("placeholder-logo.svg")
        import ipdb; ipdb.set_trace()
        vCard.add("PHOTO").value = photo_url
        vCard.add("LOGO").value = photo_url
        vCard.add("EMAIL").value = "support@relay.firefox.com"
        vCard.add("tel")
        vCard.tel.value = data["number"]
        return vCard.serialize().encode()
