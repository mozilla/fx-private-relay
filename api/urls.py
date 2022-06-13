from django.conf import settings
from django.urls import include, path, register_converter

from rest_framework import routers

from . import views


class SwaggerFormatConverter:
    regex = r"\.(json|yaml)"

    def to_python(self, value):
        return value

    def to_url(self, value):
        return value


register_converter(SwaggerFormatConverter, "swagger_format")


api_router = routers.DefaultRouter()
api_router.register(r"domainaddresses", views.DomainAddressViewSet, "domainaddress")
api_router.register(r"relayaddresses", views.RelayAddressViewSet, "relayaddress")
api_router.register(r"profiles", views.ProfileViewSet, "profiles")
api_router.register(r"users", views.UserViewSet, "user")
if "phones.apps.PhonesConfig" in settings.INSTALLED_APPS:
    api_router.register(r"realphone", views.RealPhoneViewSet, "real_phone")
    api_router.register(r"relaynumber", views.RelayNumberViewSet, "relay_number")


urlpatterns = [
    path("v1/premium_countries", views.premium_countries, name="premium_countries"),
    path("v1/runtime_data", views.runtime_data, name="runtime_data"),
    path("v1/inbound_sms", views.inbound_sms, name="inbound_sms"),
    path("v1/vCard/<number>", views.vCard, name="vCard"),
    path(
        "v1/swagger<swagger_format:format>",
        views.schema_view.without_ui(cache_timeout=0),
        name="schema-json",
    ),
    path(
        "v1/docs/",
        views.schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
    path("v1/", include(api_router.urls)),
]
