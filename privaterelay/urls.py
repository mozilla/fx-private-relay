"""privaterelay URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from datetime import datetime, timezone

from . import views


urlpatterns = [
    # Dockerflow endpoint
    path('__version__', views.version),
    path('__heartbeat__', views.heartbeat),
    path('__lbheartbeat__', views.lbheartbeat),

    # FXA endpoints
    path('fxa-rp-events', views.fxa_rp_events),
    path('metrics-event', views.metrics_event),

    path('accounts/profile/', views.profile, name='profile'),
    path(
        'accounts/profile/subdomain',
        views.profile_subdomain,
        name='profile_subdomain'
    ),
    path('accounts/settings/', views.settings_view, name='settings'),
    # This redirects users back to the homepage after updating settings
    path('accounts/profile/settings_update', views.settings_update_view, name='settings-update'),
    path('accounts/', include('allauth.urls')),
    path('faq', views.faq, name='faq'),
    path('', views.home, name='home'),
    path('api/', include('api.urls')),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        path('__debug__/', include(debug_toolbar.urls)),
        path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    ]

if settings.ADMIN_ENABLED:
    urlpatterns += [
        path('admin/', admin.site.urls),
    ]

if settings.AWS_SES_CONFIGSET and settings.AWS_SNS_TOPIC:
    urlpatterns += [
        path('emails/', include('emails.urls')),
    ]

if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
    urlpatterns += [
        path('phones/', include('phones.urls')),
    ]
