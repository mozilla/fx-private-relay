from django.conf import settings
from django.urls import include, path, register_converter

from rest_framework import routers

from privaterelay.utils import enable_if_setting
from .views import (
    DomainAddressViewSet,
    RelayAddressViewSet,
    ProfileViewSet,
    UserViewSet,
    FlagViewSet,
    report_webcompat_issue,
    runtime_data,
    schema_view,
    terms_accepted_user,
)


class SwaggerFormatConverter:
    regex = r"\.(json|yaml)"

    def to_python(self, value):
        return value

    def to_url(self, value):
        return value


register_converter(SwaggerFormatConverter, "swagger_format")


api_router = routers.DefaultRouter()
api_router.register(r"domainaddresses", DomainAddressViewSet, "domainaddress")
api_router.register(r"relayaddresses", RelayAddressViewSet, "relayaddress")
api_router.register(r"profiles", ProfileViewSet, "profiles")
api_router.register(r"users", UserViewSet, "user")
api_router.register(r"flags", FlagViewSet, "flag")


urlpatterns = [
    path(
        "v1/runtime_data",
        runtime_data,
        name="runtime_data_deprecate_after_updating_clients",
    ),
    path("v1/runtime_data/", runtime_data, name="runtime_data"),
    path(
        "v1/report_webcompat_issue",
        report_webcompat_issue,
        name="report_webcompat_issue_deprecate_after_updating_clients",
    ),
    path(
        "v1/report_webcompat_issue/",
        report_webcompat_issue,
        name="report_webcompat_issue",
    ),
    path(
        "v1/swagger<swagger_format:format>/",
        enable_if_setting("API_DOCS_ENABLED")(schema_view.without_ui(cache_timeout=0)),
        name="schema-json",
    ),
    path(
        "v1/terms-accepted-user/",
        terms_accepted_user,
        name="terms_accepted_user",
    ),
    path(
        "v1/docs/",
        enable_if_setting("API_DOCS_ENABLED")(
            schema_view.with_ui("swagger", cache_timeout=0)
        ),
        name="schema-swagger-ui",
    ),
]

if settings.PHONES_ENABLED:
    from .views.phones import (
        outbound_call,
        list_messages,
        outbound_sms,
        RealPhoneViewSet,
        RelayNumberViewSet,
        InboundContactViewSet,
        inbound_call,
        inbound_sms,
        vCard,
        sms_status,
        voice_status,
        resend_welcome_sms,
    )

if settings.PHONES_ENABLED:
    api_router.register(r"realphone", RealPhoneViewSet, "real_phone")
    api_router.register(r"relaynumber", RelayNumberViewSet, "relay_number")
    api_router.register(r"inboundcontact", InboundContactViewSet, "inbound_contact")
    urlpatterns += [
        # TODO: Update Twilio webhooks to versions with trailing slashes,
        #       then remove versions without trailing slashes (Django's
        #       APPEND_SLASH option will then make those redirect).
        path(
            "v1/inbound_sms",
            inbound_sms,
            name="inbound_sms_deprecate_after_updating_clients",
        ),
        path("v1/inbound_sms/", inbound_sms, name="inbound_sms"),
        path(
            "v1/inbound_call",
            inbound_call,
            name="inbound_call_deprecate_after_updating_clients",
        ),
        path("v1/inbound_call/", inbound_call, name="inbound_call"),
        path(
            "v1/voice_status",
            voice_status,
            name="voice_status_deprecate_after_updating_clients",
        ),
        path("v1/voice_status/", voice_status, name="voice_status"),
        path("v1/call/", outbound_call, name="outbound_call"),
        path("v1/messages/", list_messages, name="list_messages"),
        path("v1/message/", outbound_sms, name="outbound_sms"),
        path(
            "v1/sms_status",
            sms_status,
            name="sms_status_deprecate_after_updating_clients",
        ),
        path("v1/sms_status/", sms_status, name="sms_status"),
        path(
            "v1/vCard/<lookup_key>",
            vCard,
            name="vCard_deprecate_after_updating_clients",
        ),
        path("v1/vCard/<lookup_key>/", vCard, name="vCard"),
        path(
            "v1/realphone/resend_welcome_sms",
            resend_welcome_sms,
            name="resend_welcome_sms_deprecate_after_updating_clients",
        ),
        path(
            "v1/realphone/resend_welcome_sms/",
            resend_welcome_sms,
            name="resend_welcome_sms",
        ),
    ]


if settings.PHONES_ENABLED and settings.IQ_ENABLED:
    from .views.phones import inbound_sms_iq

    urlpatterns += [
        path(
            "v1/inbound_sms_iq/",
            enable_if_setting("IQ_ENABLED")(inbound_sms_iq),
            name="inbound_sms",
        ),
    ]


urlpatterns += [
    path("v1/", include(api_router.urls)),
]
