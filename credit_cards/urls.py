from django.urls import path

from . import views


urlpatterns = [
    path('', views.index, name='credit-cards-index'),
    path('funding-source/', views.funding_source, name='funding-source'),
]
