import pytest
from model_bakery import baker

from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from emails.models import RelayAddress
from emails.tests.models_tests import make_free_test_user, make_premium_test_user


@pytest.fixture
def free_api_client(db) -> APIClient:
    """Return an APIClient for a newly created free user."""
    free_user = make_free_test_user()
    client = APIClient()
    client.force_authenticate(user=free_user)
    return client


@pytest.fixture
def prem_api_client(db) -> APIClient:
    """Return an APIClient for a newly created premium user."""
    premium_user = make_premium_test_user()
    premium_profile = premium_user.profile_set.get()
    premium_profile.subdomain = "premium"
    premium_profile.save()
    client = APIClient()
    client.force_authenticate(user=premium_user)
    return client


def get_user(client: APIClient) -> User:
    """Get user from APIClient.force_authenticate()"""
    user = client.handler._force_user
    assert isinstance(user, User)
    return user


@pytest.mark.parametrize("format", ("yaml", "json"))
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


def test_post_domainaddress_no_subdomain_error(prem_api_client) -> None:
    """A premium user needs to select a subdomain before creating a domain address."""
    premium_profile = get_user(prem_api_client).profile_set.get()
    premium_profile.subdomain = ""
    premium_profile.save()

    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "errorReason": "needSubdomain",
        "detail": (
            "You must select a subdomain before creating email address with subdomain."
        ),
    }


def test_post_domainaddress_user_flagged_error(prem_api_client) -> None:
    """A premium user needs to select a subdomain before creating a domain address."""
    premium_profile = get_user(prem_api_client).profile_set.get()
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
        "errorReason": "accountIsPaused",
        "detail": "Your account is on pause.",
    }


def test_post_domainaddress_bad_address_error(prem_api_client) -> None:
    """A premium user needs to select a subdomain before creating a domain address."""
    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "myNewAlias"},
        format="json",
    )

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "errorReason": "addressUnavailable",
        "detail": 'Domain address "myNewAlias" could not be created, try using a different value.',
    }


def test_post_domainaddress_free_user_error(free_api_client):
    """A free user is not allowed to create a domain address."""
    response = free_api_client.post(
        reverse("domainaddress-list"), data={"address": "my-new-alias"}, format="json"
    )

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "errorReason": "freeTierNoDomainAddress",
        "detail": "You must be a premium subscriber to create subdomain aliases.",
    }


def test_post_relayaddress_success(settings, free_api_client) -> None:
    """A free user is able to create an address."""
    response = free_api_client.post(
        reverse("relayaddress-list"), data={}, format="json"
    )

    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]


def test_post_relayaddress_free_mask_email_limit_error(
    settings, free_api_client
) -> None:
    """A JSON error is returned when a free user hits the mask limit"""
    free_user = get_user(free_api_client)
    for _ in range(settings.MAX_NUM_FREE_ALIASES):
        baker.make(RelayAddress, user=free_user)

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 400
    ret_data = response.json()
    assert ret_data == {
        "errorReason": "freeTierLimit",
        "detail": (
            "You must be a premium subscriber to make more than"
            f" {settings.MAX_NUM_FREE_ALIASES} aliases."
        ),
    }


def test_post_relayaddress_flagged_error(free_api_client) -> None:
    """A JSON error is returned when a free user hits the mask limit"""
    free_profile = get_user(free_api_client).profile_set.get()
    free_profile.last_account_flagged = timezone.now()
    free_profile.save()

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 400
    ret_data = response.json()
    assert ret_data == {
        "errorReason": "accountIsPaused",
        "detail": "Your account is on pause.",
    }
