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

from allauth.account import views as allauth_views
from allauth.socialaccount.providers.fxa import views as fxa_views

from . import views

urlpatterns = [
    # Dockerflow endpoint
    path("__version__", views.version),
    path("__heartbeat__", views.heartbeat),
    path("__lbheartbeat__", views.lbheartbeat),
    # FXA endpoints
    path("fxa-rp-events", views.fxa_rp_events),
    path("metrics-event", views.metrics_event),
    path("accounts/fxa/login/", fxa_views.oauth2_login, name="fxa_login"),
    path(
        "accounts/fxa/login/callback/", fxa_views.oauth2_callback, name="fxa_callback"
    ),
    path("accounts/logout/", allauth_views.logout, name="account_logout"),
    path(
        "accounts/profile/subdomain", views.profile_subdomain, name="profile_subdomain"
    ),
    path("accounts/profile/refresh", views.profile_refresh, name="profile_refresh"),
    path("api/", include("api.urls")),
    path(".well-known/repute-template", views.repute_template, name="repute_template"),
    path(".well-known/openrep/<address>", views.openrep, name="openrep"),
    path("<application>/<subject>", views.reputons, name="reputons"),
    path(
        "<application>/<subject>/<requested_assertions>",
        views.reputons,
        name="reputons",
    ),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        path("__debug__/", include(debug_toolbar.urls)),
        path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    ]
if settings.USE_SILK:
    import silk

    urlpatterns.append(path("silk/", include("silk.urls", namespace="silk")))

if settings.ADMIN_ENABLED:
    urlpatterns += [
        path("admin/", admin.site.urls),
    ]

if settings.AWS_SES_CONFIGSET and settings.AWS_SNS_TOPIC:
    urlpatterns += [
        path("emails/", include("emails.urls")),
    ]
