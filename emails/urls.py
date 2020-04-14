from django.urls import path

from . import views


urlpatterns = [
    path('', views.index, name='emails-index'),
    path('inbound', views.inbound),
    path('toggle-forwarding', views.toggle_forwarding, name='emails-toggle-forwarding')
]
