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


class TwiMLBaseRenderer(renderers.BaseRenderer):
    """
    Twilio POSTS its request with x-www-form-urlencoded but it wants
    responses in TwiML XML.

    This Base renderer also provides a default render() for all errors.
    """

    media_type = "text/xml"
    format = "xml"
    xml_header = '<?xml version="1.0" encoding="UTF-8"?>'

    def _get_resp_status_code(self, ctx):
        ctx_resp = ctx.get("response", None)
        status_code = getattr(ctx_resp, "status_code", None)
        return status_code

    def render(self, data, accepted_media_type=None, renderer_context=None):
        error = data[0]
        title = error.title()
        return f"{self.xml_header}<Error><code>{error.code}</code><title>{title}</title></Error>"


class TwilioInboundCallXMLRenderer(TwiMLBaseRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        status_code = self._get_resp_status_code(renderer_context)
        if status_code and status_code > 299:
            return super().render(data, accepted_media_type, renderer_context)

        return f'{self.xml_header}<Response><Dial callerId="{data["inbound_from"]}"><Number>{data["real_number"]}</Number></Dial></Response>'


class TwilioInboundSMSXMLRenderer(TwiMLBaseRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        status_code = self._get_resp_status_code(renderer_context)
        if status_code and status_code > 299:
            return super().render(data, accepted_media_type, renderer_context)

        return f"{self.xml_header}<Response/>"
