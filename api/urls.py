from django.urls import include, path

from rest_framework import routers

from .views import (
    DomainAddressViewSet, ProfileViewSet, RelayAddressViewSet, schema_view
)


api_router = routers.DefaultRouter()
api_router.register(
    r'domainaddresses', DomainAddressViewSet, 'domainaddress'
)
api_router.register(
    r'relayaddresses', RelayAddressViewSet, 'relayaddress'
)
api_router.register(
    r'profiles', ProfileViewSet, 'profiles'
)

urlpatterns = [
    path('swagger(?P<format>\.json|\.yaml)',
        schema_view.without_ui(cache_timeout=0),
        name='schema-json'
    ),
    path('docs/',
        schema_view.with_ui('swagger', cache_timeout=0),
        name='schema-swagger-ui'
    ),
    path('', include(api_router.urls)),
]
