import pytest
from model_bakery import baker

from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from emails.models import (
    CannotMakeAddressException,
    RelayAddress,
    check_user_can_make_another_address,
)
from emails.tests.models_tests import make_free_test_user


@pytest.fixture
def free_api_client(db) -> APIClient:
    free_user = make_free_test_user()
    client = APIClient()
    client.force_authenticate(user=free_user)
    return client


def get_user(client: APIClient):
    return client.handler._force_user


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


def test_post_relayaddress_success(settings, free_api_client) -> None:
    """A free user is able to create an address."""
    origin = "https://login.example.com"
    data = {
        "enabled": True,
        "description": origin,
        "generated_for": origin,
        "used_on": origin,
    }

    response = free_api_client.post(reverse("relayaddress-list"), data, format="json")

    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]
    assert ret_data["description"] == origin


def test_post_relayaddress_free_mask_email_limit_error(
    settings, free_api_client
) -> None:
    """A JSON error is returned when a free user hits the mask limit"""
    free_user = get_user(free_api_client)
    free_profile = free_user.profile_set.get()
    for _ in range(settings.MAX_NUM_FREE_ALIASES):
        assert check_user_can_make_another_address(free_profile) is None
        baker.make(RelayAddress, user=free_user)
        del free_profile.relay_addresses  # Invalidate cached_property
    with pytest.raises(CannotMakeAddressException):
        check_user_can_make_another_address(free_profile)

    origin = "https://login.example.com"
    data = {
        "enabled": True,
        "description": origin,
        "generated_for": origin,
        "used_on": origin,
    }

    response = free_api_client.post(reverse("relayaddress-list"), data, format="json")

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
    with pytest.raises(CannotMakeAddressException):
        check_user_can_make_another_address(free_profile)

    origin = "https://login.example.com"
    data = {
        "enabled": True,
        "description": origin,
        "generated_for": origin,
        "used_on": origin,
    }

    response = free_api_client.post(reverse("relayaddress-list"), data, format="json")

    assert response.status_code == 400
    ret_data = response.json()
    assert ret_data == {
        "errorReason": "accountIsPaused",
        "detail": "Your account is on pause.",
    }
