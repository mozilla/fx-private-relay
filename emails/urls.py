from django.urls import path

from . import views


urlpatterns = [
    path('', views.index, name='emails-index'),
    path('sns-inbound', views.sns_inbound),
]
