import pytest

from django.conf import settings

pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)
pytestmark = pytest.mark.skipif(not settings.IQ_ENABLED, reason="IQ_ENABLED is False")

import phonenumbers
import responses
from unittest.mock import Mock, patch

from twilio.rest import Client


from rest_framework.test import RequestsClient

if settings.PHONES_ENABLED:
    from api.views.phones import compute_iq_mac

from phones.tests.models_tests import make_phone_test_user
from api.tests.phones_views_tests import _make_real_phone, _make_relay_number


API_ROOT = "http://127.0.0.1:8000"
INBOUND_SMS_PATH = f"{API_ROOT}/api/v1/inbound_sms_iq/"


@pytest.fixture()
def phone_user(db):
    yield make_phone_test_user()


@pytest.fixture(autouse=True)
def mocked_twilio_client():
    """
    Mock PhonesConfig with a mock twilio client
    """
    with patch(
        "phones.apps.PhonesConfig.twilio_client", spec_set=Client
    ) as mock_twilio_client:
        mock_fetch = Mock(
            return_value=Mock(
                country_code="US", phone_number="+12223334444", carrier="verizon"
            )
        )
        mock_twilio_client.lookups.v1.phone_numbers = Mock(
            return_value=Mock(fetch=mock_fetch)
        )
        yield mock_twilio_client


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_missing_verificationtoken_header():
    client = RequestsClient()
    response = client.post(INBOUND_SMS_PATH)
    assert response.status_code == 401
    response_body = response.json()
    assert "missing Verificationtoken header" in response_body["detail"]


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_missing_messageid_header():
    client = RequestsClient()
    client.headers.update({"Verificationtoken": "valid"})
    response = client.post(INBOUND_SMS_PATH)

    assert response.status_code == 401
    response_body = response.json()
    assert "missing MessageId header" in response_body["detail"]


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_invalid_hash():
    message_id = "9a09df23-01f3-4e0f-adbc-2a783878a574"
    client = RequestsClient()
    client.headers.update({"Verificationtoken": "invalid value"})
    client.headers.update({"MessageId": message_id})
    response = client.post(INBOUND_SMS_PATH)

    assert response.status_code == 401
    response_body = response.json()
    assert "verficiationToken != computed sha256" in response_body["detail"]


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_valid_hash_no_auth_failed_status():
    message_id = "9a09df23-01f3-4e0f-adbc-2a783878a574"
    token = compute_iq_mac(message_id)
    client = RequestsClient()
    client.headers.update({"Verificationtoken": token})
    client.headers.update({"MessageId": message_id})
    response = client.post(INBOUND_SMS_PATH)

    assert response.status_code == 400


def _prepare_valid_iq_request_client() -> RequestsClient:
    message_id = "9a09df23-01f3-4e0f-adbc-2a783878a574"
    token = compute_iq_mac(message_id)
    client = RequestsClient()
    client.headers.update({"Verificationtoken": token})
    client.headers.update({"MessageId": message_id})
    return client


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_missing_required_params():
    client = _prepare_valid_iq_request_client()

    resp = client.post(INBOUND_SMS_PATH, {})

    assert resp.status_code == 400
    resp_body = resp.json()

    # FIXME: why is this a list?
    assert "Request missing from, to, or text" in resp_body[0]


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_unknown_number():
    unknown_number = "234567890"
    client = _prepare_valid_iq_request_client()
    data = {
        "from": "5556660000",
        "to": [
            unknown_number,
        ],
        "text": "test body",
    }

    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 400
    resp_body = resp.json()
    assert "Could not find relay number." in resp_body[0]


@pytest.mark.django_db(transaction=True)
def test_iq_endpoint_disabled_number(phone_user, mocked_twilio_client):
    # TODO: should we return empty 200 to iQ when number is disabled?
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    relay_number.enabled = False
    relay_number.save()
    client = _prepare_valid_iq_request_client()
    formatted_to = str(phonenumbers.parse(relay_number.number, "E164").national_number)
    data = {
        "from": "5556660000",
        "to": [
            formatted_to,
        ],
        "text": "test body",
    }

    resp = client.post(INBOUND_SMS_PATH, json=data)
    assert resp.status_code == 200


@pytest.mark.django_db(transaction=True)
@responses.activate()
def test_iq_endpoint_success(phone_user):
    iq_message_path = (
        "https://messagebroker.inteliquent.com/msgbroker/rest/publishMessages"
    )
    responses.add(responses.POST, iq_message_path, status=200)
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    pre_inbound_remaining_texts = relay_number.remaining_texts
    client = _prepare_valid_iq_request_client()
    formatted_to = str(phonenumbers.parse(relay_number.number, "E164").national_number)
    data = {
        "from": "5556660000",
        "to": [
            formatted_to,
        ],
        "text": "test body",
    }

    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert relay_number.remaining_texts == pre_inbound_remaining_texts - 1
