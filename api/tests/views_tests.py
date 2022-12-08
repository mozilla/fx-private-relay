import pytest
from model_bakery import baker

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from emails.models import RelayAddress
from emails.tests.models_tests import make_free_test_user, make_premium_test_user


@pytest.fixture
def free_user(db) -> User:
    return make_free_test_user()


@pytest.fixture
def free_api_client(free_user: User) -> APIClient:
    """Return an APIClient for a newly created free user."""
    client = APIClient()
    client.force_authenticate(user=free_user)
    return client


@pytest.fixture
def premium_user(db) -> User:
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


@pytest.mark.parametrize("format", ("yaml", "json"))
@override_settings(API_DOCS_ENABLED=True)
def test_swagger_format(client, format):
    path = f"/api/v1/swagger.{format}"
    response = client.get(path)
    assert response.status_code == 200
    assert response["Content-Type"].startswith(f"application/{format}")


@pytest.mark.parametrize("subpath", ("swagger", "swagger.", "swagger.txt"))
def test_swagger_unknown_format(client, subpath):
    path = f"/api/v1/{subpath}"
    response = client.get(path)
    assert response.status_code == 404


@pytest.mark.django_db
def test_runtime_data(client):
    path = "/api/v1/runtime_data"
    response = client.get(path)
    assert response.status_code == 200


def test_post_domainaddress_success(prem_api_client) -> None:
    """A premium user can create a domain address."""
    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )
    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]
    assert ret_data["full_address"].startswith("my-new-mask@premium.")


def test_post_domainaddress_no_subdomain_error(premium_user, prem_api_client) -> None:
    """A premium user needs to select a subdomain before creating a domain address."""
    premium_profile = premium_user.profile
    premium_profile.subdomain = ""
    premium_profile.save()

    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )

    assert response.status_code == 400
    ret_data = response.json()
    assert ret_data == {
        "detail": ("Please select a subdomain before creating a custom email address."),
        "error_code": "need_subdomain",
    }


def test_post_domainaddress_user_flagged_error(premium_user, prem_api_client) -> None:
    """A flagged user cannot create a new domain address."""
    premium_profile = premium_user.profile
    premium_profile.last_account_flagged = timezone.now()
    premium_profile.save()

    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "detail": "Your account is on pause.",
        "error_code": "account_is_paused",
    }


def test_post_domainaddress_bad_address_error(prem_api_client) -> None:
    """A domain address can be rejected due to the address format or content."""
    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "myNewAlias"},
        format="json",
    )

    assert response.status_code == 400
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation.
    # See https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation for more info
    assert ret_data == {
        "detail": "“\u2068myNewAlias\u2069” could not be created. Please try again with a different mask name.",
        "error_code": "address_unavailable",
        "error_context": {"unavailable_address": "myNewAlias"},
    }


def test_post_domainaddress_free_user_error(free_api_client):
    """A free user is not allowed to create a domain address."""
    response = free_api_client.post(
        reverse("domainaddress-list"), data={"address": "my-new-alias"}, format="json"
    )

    assert response.status_code == 403
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation.
    # See https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation for more info
    assert ret_data == {
        "detail": "Your free account does not include custom subdomains for masks. To create custom masks, upgrade to \u2068Relay Premium\u2069.",
        "error_code": "free_tier_no_subdomain_masks",
    }


def test_post_relayaddress_success(settings, free_api_client) -> None:
    """A free user is able to create a random address."""
    response = free_api_client.post(
        reverse("relayaddress-list"), data={}, format="json"
    )

    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]


def test_post_relayaddress_free_mask_email_limit_error(
    settings, free_user, free_api_client
) -> None:
    """A free user is unable to exceed the mask limit."""
    for _ in range(settings.MAX_NUM_FREE_ALIASES):
        baker.make(RelayAddress, user=free_user)

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 403
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation.
    # See https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation for more info

    assert ret_data == {
        "detail": (
            "You’ve used all"
            f" \u2068{settings.MAX_NUM_FREE_ALIASES}\u2069 email masks included with your free account. You can reuse an existing mask, but using a unique mask for each account is the most secure option."
        ),
        "error_code": "free_tier_limit",
        "error_context": {"free_tier_limit": 5},
    }


def test_post_relayaddress_flagged_error(free_user, free_api_client) -> None:
    """A flagged user is unable to create a random mask."""
    free_profile = free_user.profile
    free_profile.last_account_flagged = timezone.now()
    free_profile.save()

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "detail": "Your account is on pause.",
        "error_code": "account_is_paused",
    }
