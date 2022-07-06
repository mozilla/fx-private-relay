from unittest.mock import Mock, patch
import pytest

from twilio.rest import Client

from django.contrib.auth.models import User
from model_bakery import baker
from rest_framework.test import APIClient

from phones.tests.models_tests import make_phone_test_user


@pytest.fixture()
def phone_user():
    yield make_phone_test_user()


@pytest.fixture(autouse=True)
def mocked_twilio_client():
    """
    Mock PhonesConfig with a mock twilio client
    """
    with patch(
        "phones.apps.PhonesConfig.twilio_client", spec_set=Client
    ) as mock_twilio_client:
        yield mock_twilio_client


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


@pytest.mark.django_db
def test_realphone_get_requires_auth():
    client = APIClient()
    path = "/api/v1/realphone/"
    response = client.get(path)
    assert response.status_code == 403


@pytest.mark.django_db
def test_realphone_get_requires_phone_service():
    free_user = baker.make(User)
    client = APIClient()
    client.force_authenticate(free_user)
    path = "/api/v1/realphone/"
    response = client.get(path)
    assert response.status_code == 403


@pytest.mark.django_db
def test_realphone_get_responds_200(phone_user):
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/"
    response = client.get(path)
    assert response.status_code == 200


@pytest.mark.django_db
def test_realphone_post_valid_es164_number(phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+12223334444"
    path = "/api/v1/realphone/"
    data = {"number": number}

    mock_fetch = Mock(return_value=Mock(
        country_code="US", phone_number=number, carrier="verizon"
    ))
    mocked_twilio_client.lookups.v1.phone_numbers = Mock(
        return_value=Mock(fetch=mock_fetch)
    )

    response = client.post(path, data, format='json')
    assert response.status_code == 201
    assert response.data['number'] == number
    assert response.data['verified'] == False
    assert response.data['verification_sent_date'] != ''
    assert "Sent verification" in response.data['message']

    mocked_twilio_client.lookups.v1.phone_numbers.assert_called_once_with(number)
    mock_fetch.assert_called_once()
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs['to'] == number
    assert "verification code" in call_kwargs['body']
