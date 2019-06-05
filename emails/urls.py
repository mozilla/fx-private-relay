from django.urls import path

from . import views


urlpatterns = [
    path('', views.index),
    path('inbound', views.inbound),
    path('messages/', views.messages),
]
