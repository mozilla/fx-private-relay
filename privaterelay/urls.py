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
from decouple import config

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from . import views


urlpatterns = [
    path('accounts/profile/', views.profile, name='profile'),
    path('accounts/', include('allauth.urls')),
    path('', views.home),
]

if settings.ADMIN_ENABLED:
    urlpatterns += [
        path('admin/', admin.site.urls),
    ]

if settings.SENDGRID_API_KEY:
    urlpatterns += [
        path('emails/', include('emails.urls')),
    ]

if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
    urlpatterns += [
        path('phones/', include('phones.urls')),
    ]
