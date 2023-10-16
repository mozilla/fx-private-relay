from django.conf import settings
from django.urls import path

from . import views


urlpatterns = [
    path("sns-inbound", views.sns_inbound),
]

if settings.DEBUG:
    urlpatterns += [
        path("wrapped_email_test", views.wrapped_email_test),
        path("first_time_user_test", views.first_time_user_test),
        path("reply_requires_premium_test", views.reply_requires_premium_test),
        path("first_forwarded_email", views.first_forwarded_email_test),
    ]
