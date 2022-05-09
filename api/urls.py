from django.urls import include, path, register_converter

from rest_framework import routers

from .views import (
    DomainAddressViewSet,
    ProfileViewSet,
    UserViewSet,
    RelayAddressViewSet,
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
    path("v1/", include(api_router.urls)),
]
