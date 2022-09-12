from django.conf import settings
from django.urls import path

from . import views


urlpatterns = [
    path("sns-inbound", views.sns_inbound),
]

if settings.DEBUG:
    urlpatterns += [
        path("wrapped_email_test", views.wrapped_email_test),
    ]
