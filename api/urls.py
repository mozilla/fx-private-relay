from django.conf import settings
from django.urls import include, path, register_converter

from rest_framework import routers

from .views import (
    DomainAddressViewSet,
    RelayAddressViewSet,
    ProfileViewSet,
    UserViewSet,
    premium_countries,
    runtime_data,
    schema_view,
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


urlpatterns = [
    path("v1/premium_countries", premium_countries, name="premium_countries"),
    path("v1/runtime_data", runtime_data, name="runtime_data"),
    path(
        "v1/swagger<swagger_format:format>",
        schema_view.without_ui(cache_timeout=0),
        name="schema-json",
    ),
    path(
        "v1/docs/",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
]

if settings.PHONES_ENABLED:
    from .views.phones import (
        RealPhoneViewSet,
        RelayNumberViewSet,
        InboundContactViewSet,
        inbound_call,
        inbound_sms,
        vCard,
    )

    api_router.register(r"realphone", RealPhoneViewSet, "real_phone")
    api_router.register(r"relaynumber", RelayNumberViewSet, "relay_number")
    api_router.register(r"inboundcontact", InboundContactViewSet, "inbound_contact")
    urlpatterns += [
        path("v1/inbound_sms", inbound_sms, name="inbound_sms"),
        path("v1/inbound_call", inbound_call, name="inbound_call"),
        path("v1/vCard/<lookup_key>", vCard, name="vCard"),
    ]

urlpatterns += [
    path("v1/", include(api_router.urls)),
]
