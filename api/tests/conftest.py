"""Shared fixtures for API tests."""

from django.contrib.auth.models import User
from django.contrib.sites.models import Site

import pytest
from allauth.socialaccount.models import SocialApp
from rest_framework.test import APIClient

from privaterelay.tests.utils import make_free_test_user, make_premium_test_user


@pytest.fixture
def free_user(db: None) -> User:
    return make_free_test_user()


@pytest.fixture
def free_api_client(free_user: User) -> APIClient:
    """Return an APIClient for a newly created free user."""
    client = APIClient()
    client.force_authenticate(user=free_user)
    return client


@pytest.fixture
def premium_user(db: None) -> User:
    premium_user = make_premium_test_user()
    premium_profile = premium_user.profile
    premium_profile.subdomain = "premium"
    premium_profile.save()
    return premium_user


@pytest.fixture
def prem_api_client(premium_user: User) -> APIClient:
    """Return an APIClient for a newly created premium user."""
    client = APIClient()
    client.force_authenticate(user=premium_user)
    return client


@pytest.fixture
def fxa_social_app(db: None) -> SocialApp:
    social_app, _created = SocialApp.objects.get_or_create(provider="fxa")
    if _created:
        social_app.sites.set((Site.objects.first(),))
    return social_app
