import vobject

from django.conf import settings

from rest_framework import renderers


class vCardRenderer(renderers.BaseRenderer):
    media_type = "text/x-vcard"
    format = "vcf"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        vCard = vobject.vCard()
        vCard.add("FN").value = "Firefox Relay"
        # TODO: fix static urls
        photo_url = settings.SITE_ORIGIN + "/static/images/relay-logo.svg"
        vCard.add("PHOTO").value = photo_url
        vCard.add("LOGO").value = photo_url
        vCard.add("EMAIL").value = "support@relay.firefox.com"
        vCard.add("tel")
        vCard.tel.value = data.get("number", "")
        return vCard.serialize().encode()


class TwilioCallForwardXMLRenderer(renderers.BaseRenderer):
    """
    Twilio POSTS its request with x-www-form-urlencoded but it wants responses
    in TwiML XML.
    """

    media_type = "text/xml"
    format = "xml"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        xml_header = '<?xml version="1.0" encoding="UTF-8"?>'
        if renderer_context["response"].status_code != 201:
            error = data[0]
            title = error.title()
            return f"{xml_header}<Error><code>{error.code}</code><title>{title}</title></Error>"
        return f'{xml_header}<Response><Dial callerId="{data["inbound_from"]}"><Number>{data["real_number"]}</Number></Dial></Response>'
