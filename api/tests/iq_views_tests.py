from allauth.socialaccount.models import SocialAccount
import pytest

from django.conf import settings

pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)
pytestmark = pytest.mark.skipif(not settings.IQ_ENABLED, reason="IQ_ENABLED is False")

import responses
from unittest.mock import Mock, patch

from twilio.rest import Client


from rest_framework.test import RequestsClient

if settings.PHONES_ENABLED:
    from api.views.phones import compute_iq_mac
    from phones.models import InboundContact, iq_fmt

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


def _make_real_phone_with_mock_iq(phone_user, **kwargs):
    responses.add(responses.POST, settings.IQ_PUBLISH_MESSAGE_URL, status=200)
    real_phone = _make_real_phone(phone_user, **kwargs)
    responses.reset()
    return real_phone


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
def test_iq_endpoint_disabled_number(phone_user):
    # TODO: should we return empty 200 to iQ when number is disabled?
    _make_real_phone_with_mock_iq(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    relay_number.enabled = False
    relay_number.save()
    client = _prepare_valid_iq_request_client()
    formatted_to = iq_fmt(relay_number.number)
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
    _make_real_phone_with_mock_iq(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    pre_inbound_remaining_texts = relay_number.remaining_texts
    client = _prepare_valid_iq_request_client()
    formatted_to = iq_fmt(relay_number.number)
    data = {
        "from": "5556660000",
        "to": [
            formatted_to,
        ],
        "text": "test body",
    }

    # add response for forwarded text
    rsp = responses.add(responses.POST, settings.IQ_PUBLISH_MESSAGE_URL, status=200)
    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert relay_number.remaining_texts == pre_inbound_remaining_texts - 1
    assert rsp.call_count == 1


@pytest.mark.django_db(transaction=True)
@responses.activate()
def test_reply_with_no_remaining_texts(phone_user):
    real_phone = _make_real_phone_with_mock_iq(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    relay_number.remaining_texts = 0
    relay_number.save()
    # add a response for error message sent to user
    rsp = responses.add(responses.POST, settings.IQ_PUBLISH_MESSAGE_URL, status=200)

    client = _prepare_valid_iq_request_client()
    formatted_to = iq_fmt(relay_number.number)
    formatted_from = iq_fmt(real_phone.number)
    data = {
        "from": formatted_from,
        "to": [
            formatted_to,
        ],
        "text": "test reply",
    }
    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 400
    decoded_content = resp.content.decode()
    assert "Number is out of texts" in decoded_content
    assert rsp.call_count == 0
    relay_number.refresh_from_db()
    assert relay_number.remaining_texts == 0


@pytest.mark.django_db(transaction=True)
@responses.activate()
def test_reply_with_no_phone_capability(phone_user):
    real_phone = _make_real_phone_with_mock_iq(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    sa = SocialAccount.objects.get(user=phone_user)
    sa.extra_data = {"avatar": "avatar.png", "subscriptions": []}
    sa.save()
    # add response that should NOT be called
    rsp = responses.add(responses.POST, settings.IQ_PUBLISH_MESSAGE_URL, status=200)

    client = _prepare_valid_iq_request_client()
    formatted_to = iq_fmt(relay_number.number)
    formatted_from = iq_fmt(real_phone.number)
    data = {
        "from": formatted_from,
        "to": [
            formatted_to,
        ],
        "text": "test reply",
    }
    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 400
    decoded_content = resp.content.decode()
    assert "Number owner does not have phone service" in decoded_content
    assert rsp.call_count == 0


@pytest.mark.django_db(transaction=True)
@responses.activate()
def test_reply_without_previous_sender_error(phone_user):
    real_phone = _make_real_phone_with_mock_iq(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    client = _prepare_valid_iq_request_client()
    formatted_to = iq_fmt(relay_number.number)
    formatted_from = iq_fmt(real_phone.number)

    # add a response for sending error back to user
    error_msg = "You can only reply to phone numbers that have sent you a text message."
    rsp = responses.add(
        responses.POST,
        settings.IQ_PUBLISH_MESSAGE_URL,
        status=200,
        match=[
            responses.matchers.json_params_matcher(
                {
                    "from": formatted_to,
                    "to": [formatted_from],
                    "text": f"Message failed to send. {error_msg}",
                }
            )
        ],
    )

    data = {
        "from": formatted_from,
        "to": [
            formatted_to,
        ],
        "text": "test reply",
    }
    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 400
    decoded_content = resp.content.decode()
    assert error_msg in decoded_content
    assert rsp.call_count == 1


@pytest.mark.django_db(transaction=True)
@responses.activate()
def test_reply_with_previous_sender_works(phone_user):
    real_phone = _make_real_phone_with_mock_iq(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, "inteliquent")
    inbound_contact = InboundContact.objects.create(
        relay_number=relay_number, inbound_number="+15556660000"
    )
    client = _prepare_valid_iq_request_client()
    formatted_contact = iq_fmt(inbound_contact.inbound_number)
    formatted_relay = iq_fmt(relay_number.number)
    formatted_real = iq_fmt(real_phone.number)

    # add a response for sending error back to user
    rsp = responses.add(
        responses.POST,
        settings.IQ_PUBLISH_MESSAGE_URL,
        status=200,
        match=[
            responses.matchers.json_params_matcher(
                {
                    "from": formatted_relay,
                    "to": [formatted_contact],
                    "text": "test reply",
                }
            )
        ],
    )

    data = {
        "from": formatted_real,
        "to": [
            formatted_relay,
        ],
        "text": "test reply",
    }
    resp = client.post(INBOUND_SMS_PATH, json=data)

    assert resp.status_code == 200
    assert rsp.call_count == 1
