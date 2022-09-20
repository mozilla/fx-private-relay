import pytest
from unittest.mock import Mock, patch, call

from twilio.request_validator import RequestValidator
from twilio.rest import Client

from django.conf import settings
from django.contrib.auth.models import User

from model_bakery import baker
from rest_framework.test import APIClient
from emails.models import Profile


if settings.PHONES_ENABLED:
    from phones.models import InboundContact, RealPhone, RelayNumber
    from phones.tests.models_tests import make_phone_test_user


pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


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


@pytest.fixture(autouse=True)
def mocked_twilio_validator():
    """
    Mock PhonesConfig with a mock twilio validator
    """
    with patch(
        "phones.apps.PhonesConfig.twilio_validator", spec_set=RequestValidator
    ) as mock_twilio_validator:
        mock_twilio_validator.validate = Mock(return_value=True)
        yield mock_twilio_validator


def _make_real_phone(phone_user, **kwargs):
    number = "+12223334444"
    return RealPhone.objects.create(user=phone_user, number=number, **kwargs)


def _make_relay_number(phone_user, **kwargs):
    relay_number = "+19998887777"
    return RelayNumber.objects.create(user=phone_user, number=relay_number, **kwargs)


@pytest.mark.parametrize("endpoint", ("realphone", "relaynumber"))
@pytest.mark.django_db
def test_phone_get_endpoints_require_auth(endpoint):
    client = APIClient()
    path = f"/api/v1/{endpoint}/"
    response = client.get(path)
    assert response.status_code == 403

    free_user = baker.make(User)
    client.force_authenticate(free_user)
    response = client.get(path)
    assert response.status_code == 200


def test_realphone_get_responds_200(phone_user):
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/"
    response = client.get(path)
    assert response.status_code == 200


def test_realphone_post_invalid_e164_number_no_request_country(phone_user):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "2223334444"
    path = "/api/v1/realphone/"
    data = {"number": number}

    response = client.post(path, data, format="json")
    assert response.status_code == 400
    assert "Number Must Be In E.164 Format" in response.data[0].title()


def test_realphone_post_valid_e164_number_in_unsupported_country(
    phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+31612345678"
    path = "/api/v1/realphone/"
    data = {"number": number}

    mock_fetch = Mock(
        return_value=Mock(country_code="nl", phone_number=number, carrier="telfort")
    )
    mocked_twilio_client.lookups.v1.phone_numbers = Mock(
        return_value=Mock(fetch=mock_fetch)
    )

    response = client.post(path, data, format="json", HTTP_X_CLIENT_REGION="nl")
    assert response.status_code == 400
    assert "Available In The Us" in response.data[0].title()


def test_realphone_post_valid_es164_number(phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+12223334444"
    path = "/api/v1/realphone/"
    data = {"number": number}

    response = client.post(path, data, format="json")
    assert response.status_code == 201
    assert response.data["number"] == number
    assert response.data["verified"] == False
    assert response.data["verification_sent_date"] != ""
    assert "Sent verification" in response.data["message"]

    mocked_twilio_client.lookups.v1.phone_numbers.assert_called_once_with(number)
    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_called_once()
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == number
    assert "verification code" in call_kwargs["body"]


def test_realphone_post_valid_es164_number_already_sent_code(
    phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+12223334444"
    path = "/api/v1/realphone/"
    data = {"number": number}

    # the first POST should work fine
    response = client.post(path, data, format="json")
    assert response.status_code == 201
    assert response.data["number"] == number
    assert response.data["verified"] == False
    assert response.data["verification_sent_date"] != ""
    assert "Sent verification" in response.data["message"]

    mocked_twilio_client.lookups.v1.phone_numbers.assert_called_once_with(number)
    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_called_once()
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == number
    assert "verification code" in call_kwargs["body"]

    mocked_twilio_client.reset_mock()
    # the second POST should not send a new verification code
    response = client.post(path, data, format="json")
    assert response.status_code == 409
    mocked_twilio_client.lookups.v1.phone_numbers.assert_not_called()
    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()
    mocked_twilio_client.messages.create.assert_not_called()


def test_realphone_post_valid_verification_code(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/"
    data = {
        "number": real_phone.number,
        "verification_code": real_phone.verification_code,
    }

    response = client.post(path, data, format="json")
    assert response.status_code == 201
    assert response.data["number"] == real_phone.number
    assert response.data["verified"] == True
    assert response.data["verified_date"] != ""

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_post_invalid_verification_code(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/"
    data = {"number": real_phone.number, "verification_code": "invalid"}

    response = client.post(path, data, format="json")
    assert response.status_code == 400
    assert "Could Not Find" in response.data[0].title()
    real_phone.refresh_from_db()
    assert real_phone.verified == False
    assert real_phone.verified_date == None

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_post_existing_verified_number(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/"
    data = {"number": real_phone.number}

    response = client.post(path, data, format="json")
    assert response.status_code == 409
    assert "verified record already exists" in response.content.decode()
    real_phone.refresh_from_db()

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_patch_verification_code(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user, verified=False)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"
    data = {
        "number": real_phone.number,
        "verification_code": real_phone.verification_code,
    }

    response = client.patch(path, data, format="json")
    assert response.status_code == 200
    assert response.data["number"] == real_phone.number
    assert response.data["verified"] == True
    assert response.data["verified_date"] != ""

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_patch_verification_code_twice(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user, verified=False)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"
    data = {
        "number": real_phone.number,
        "verification_code": real_phone.verification_code,
    }

    response = client.patch(path, data, format="json")
    assert response.status_code == 200
    assert response.data["number"] == real_phone.number
    assert response.data["verified"] == True
    assert response.data["verified_date"] != ""

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()

    response = client.patch(path, data, format="json")
    assert response.status_code == 200
    assert response.data["number"] == real_phone.number
    assert response.data["verified"] == True
    assert response.data["verified_date"] != ""


def test_realphone_patch_invalid_number(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"
    data = {"number": "+98887776666", "verification_code": "invalid"}

    response = client.patch(path, data, format="json")
    assert response.status_code == 400
    real_phone.refresh_from_db()
    assert real_phone.verified == False
    assert real_phone.verified_date == None

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_patch_invalid_verification_code(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"
    data = {"number": real_phone.number, "verification_code": "invalid"}

    response = client.patch(path, data, format="json")
    assert response.status_code == 400
    real_phone.refresh_from_db()
    assert real_phone.verified == False
    assert real_phone.verified_date == None

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_delete_cant_delete_verified(phone_user):
    real_phone = _make_real_phone(phone_user, verified=True)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"

    response = client.delete(path, format="json")

    assert response.status_code == 400
    real_phone.refresh_from_db()
    assert real_phone.verified == True


def test_realphone_delete_non_verified(phone_user):
    real_phone = _make_real_phone(phone_user, verified=False)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"

    response = client.delete(path, format="json")

    assert response.status_code == 204
    with pytest.raises(RealPhone.DoesNotExist):
        real_phone.refresh_from_db()


def test_relaynumber_post_with_existing_returns_error(phone_user, mocked_twilio_client):
    _make_real_phone(phone_user, verified=True)
    _make_relay_number(phone_user)
    mock_create = Mock()
    mocked_twilio_client.incoming_phone_numbers.create = mock_create

    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/"
    data = {"number": "+15556660000"}
    response = client.post(path, data, format="json")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert "already has" in decoded_content
    mock_create.assert_not_called()


def test_relaynumber_patch_to_toggle(phone_user, mocked_twilio_client):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)
    assert relay_number.enabled == True
    mock_create = Mock()
    mocked_twilio_client.incoming_phone_numbers.create = mock_create

    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/relaynumber/{relay_number.id}/"
    data = {"enabled": False}
    response = client.patch(path, data, format="json")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.enabled == False
    mock_create.assert_not_called()

    data = {"enabled": True}
    response = client.patch(path, data, format="json")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.enabled == True
    mock_create.assert_not_called()


def test_relaynumber_suggestions_bad_request_for_user_without_real_phone(phone_user):
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/suggestions/"

    response = client.get(path)

    assert response.status_code == 400


def test_relaynumber_suggestions_bad_request_for_user_already_with_number(phone_user):
    _make_real_phone(phone_user, verified=True)
    _make_relay_number(phone_user)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/suggestions/"

    response = client.get(path)

    assert response.status_code == 400


def test_relaynumber_suggestions(phone_user):
    real_phone = _make_real_phone(phone_user, verified=True)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/suggestions/"

    response = client.get(path)

    assert response.status_code == 200
    data_keys = list(response.data.keys())
    assert response.data["real_num"] == real_phone.number
    assert "same_prefix_options" in data_keys
    assert "other_areas_options" in data_keys
    assert "same_area_options" in data_keys


def test_relaynumber_search_requires_param(phone_user):
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/search/"

    response = client.get(path)

    assert response.status_code == 404


def test_relaynumber_search_by_location(phone_user, mocked_twilio_client):
    mock_list = Mock(return_value=[])
    mocked_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )

    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/search/?location=Miami, FL"

    response = client.get(path)

    assert response.status_code == 200
    available_numbers_calls = (
        mocked_twilio_client.available_phone_numbers.call_args_list
    )
    assert available_numbers_calls == [call("US")]
    assert mock_list.call_args_list == [call(in_locality="Miami, FL", limit=10)]


def test_relaynumber_search_by_area_code(phone_user, mocked_twilio_client):
    mock_list = Mock(return_value=[])
    mocked_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )

    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/search/?area_code=918"

    response = client.get(path)

    assert response.status_code == 200
    available_numbers_calls = (
        mocked_twilio_client.available_phone_numbers.call_args_list
    )
    assert available_numbers_calls == [call("US")]
    assert mock_list.call_args_list == [call(area_code="918", limit=10)]


def test_vcard_no_lookup_key():
    client = APIClient()
    path = "/api/v1/vCard/"

    response = client.get(path)

    assert response.status_code == 404


@pytest.mark.django_db
def test_vcard_wrong_lookup_key():
    client = APIClient()
    path = "/api/v1/vCard/wrong-lookup-key"

    response = client.get(path)

    assert response.status_code == 404


def test_vcard_valid_lookup_key(phone_user):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)

    client = APIClient()
    path = f"/api/v1/vCard/{relay_number.vcard_lookup_key}"
    response = client.get(path)

    assert response.status_code == 200
    assert response.data["number"] == relay_number.number
    assert (
        response.headers["Content-Disposition"]
        == "attachment; filename=+19998887777.vcf"
    )


def test_resend_welcome_sms_requires_phone_user():
    client = APIClient()
    path = "/api/v1/realphone/resend_welcome_sms"
    response = client.post(path)

    assert response.status_code == 403


def test_resend_welcome_sms(phone_user, mocked_twilio_client):
    mock_messages_create = mocked_twilio_client.messages.create
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)

    mocked_twilio_client.reset_mock()
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/resend_welcome_sms"
    response = client.post(path)

    assert response.status_code == 201
    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone.number
    assert relay_number.vcard_lookup_key in call_kwargs["media_url"][0]


@pytest.mark.django_db
def test_inbound_sms_no_twilio_signature():
    client = APIClient()
    path = "/api/v1/inbound_sms"
    response = client.post(path)

    assert response.status_code == 400
    assert "Missing X-Twilio-Signature" in response.data[0].title()


@pytest.mark.django_db
def test_inbound_sms_invalid_twilio_signature(mocked_twilio_validator):
    mocked_twilio_validator.validate = Mock(return_value=False)

    client = APIClient()
    path = "/api/v1/inbound_sms"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="invalid")

    assert response.status_code == 400
    assert "Invalid Signature" in response.data[0].title()


@pytest.mark.django_db
def test_inbound_sms_valid_twilio_signature_bad_data():
    client = APIClient()
    path = "/api/v1/inbound_sms"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    assert "Missing From, To, Or Body." in response.data[0].title()


def test_inbound_sms_valid_twilio_signature_unknown_number(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    _make_relay_number(phone_user)
    unknown_number = "+1234567890"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+15556660000", "To": unknown_number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    assert "Could Not Find Relay Number." in response.data[0].title()


def test_inbound_sms_valid_twilio_signature_good_data(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)
    pre_inbound_remaining_texts = relay_number.remaining_texts
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+15556660000", "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 201
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == real_phone.number
    assert call_kwargs["from_"] == relay_number.number
    assert "[Relay" in call_kwargs["body"]
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert relay_number.remaining_texts == pre_inbound_remaining_texts - 1


def test_inbound_sms_valid_twilio_signature_disabled_number(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=False)
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+15556660000", "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    relay_number.refresh_from_db()
    assert relay_number.texts_blocked == 1
    assert "Not Accepting Texts" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()


def test_inbound_sms_to_number_with_no_remaining_texts(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    relay_number.remaining_texts = 0
    relay_number.save()
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+15556660000", "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    relay_number.refresh_from_db()
    assert "Number Is Out Of Texts" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()


def test_inbound_sms_valid_twilio_signature_no_phone_log(
    phone_user, mocked_twilio_client
):
    profile = Profile.objects.get(user=phone_user)
    profile.store_phone_log = False
    profile.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    inbound_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": inbound_number, "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 201
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    assert "<Response/>" in decoded_content
    mocked_twilio_client.messages.create.assert_called_once()
    assert InboundContact.objects.filter(relay_number=relay_number).count() == 0


def test_inbound_sms_valid_twilio_signature_blocked_contact(
    phone_user, mocked_twilio_client
):
    profile = Profile.objects.get(user=phone_user)
    profile.store_phone_log = True
    profile.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    inbound_number = "+15556660000"
    inbound_contact = InboundContact.objects.create(
        relay_number=relay_number, inbound_number=inbound_number
    )
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": inbound_number, "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 201
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    assert "<Response/>" in decoded_content
    mocked_twilio_client.messages.create.assert_called_once()
    inbound_contact.refresh_from_db()
    assert inbound_contact.num_texts == 1
    assert inbound_contact.last_inbound_type == "text"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert relay_number.texts_blocked == 0
    pre_block_contact_date = inbound_contact.last_inbound_date

    inbound_contact.blocked = True
    inbound_contact.save()
    mocked_twilio_client.reset_mock()
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    assert "Not Accepting Texts" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()
    inbound_contact.refresh_from_db()
    assert inbound_contact.num_texts == 1
    assert inbound_contact.num_texts_blocked == 1
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert relay_number.texts_blocked == 1
    assert inbound_contact.last_inbound_date == pre_block_contact_date


def test_inbound_sms_reply_not_storing_phone_log(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    mocked_twilio_client.reset_mock()
    profile = Profile.objects.get(user=phone_user)
    profile.store_phone_log = False
    profile.save()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert "You Can Only Reply" in decoded_content
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == real_phone.number
    assert call_kwargs["from_"] == relay_number.number
    assert "You can only reply" in call_kwargs["body"]
    assert f"{settings.SITE_ORIGIN}" in call_kwargs["body"]


def test_inbound_sms_reply_no_previous_sender(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert "Could Not Find A Previous Text Sender" in decoded_content
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == real_phone.number
    assert call_kwargs["from_"] == relay_number.number
    assert "Could not find a previous text sender" in call_kwargs["body"]


def test_inbound_sms_reply(phone_user, mocked_twilio_client):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    inbound_contact = InboundContact.objects.create(
        relay_number=relay_number,
        inbound_number="+15556660000",
        last_inbound_type="text",
    )
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == inbound_contact.inbound_number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1


@pytest.mark.django_db
def test_phone_get_inbound_contact_requires_relay_number(phone_user):
    client = APIClient()
    path = "/api/v1/inboundcontact/"
    free_user = baker.make(User)
    client.force_authenticate(free_user)
    response = client.get(path)
    assert response.status_code == 404

    client.force_authenticate(phone_user)
    response = client.get(path)
    assert response.status_code == 404

    _make_real_phone(phone_user, verified=True)
    _make_relay_number(phone_user, enabled=True)
    response = client.get(path)
    assert response.status_code == 200


@pytest.mark.django_db
def test_inbound_call_no_twilio_signature():
    client = APIClient()
    path = "/api/v1/inbound_call"
    response = client.post(path)

    assert response.status_code == 400
    assert "Missing X-Twilio-Signature" in response.data[0].title()


@pytest.mark.django_db
def test_inbound_call_invalid_twilio_signature(mocked_twilio_validator):
    mocked_twilio_validator.validate = Mock(return_value=False)

    client = APIClient()
    path = "/api/v1/inbound_call"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="invalid")

    assert response.status_code == 400
    assert "Invalid Signature" in response.data[0].title()


@pytest.mark.django_db
def test_inbound_call_valid_twilio_signature_bad_data():
    client = APIClient()
    path = "/api/v1/inbound_call"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    assert "Missing Caller Or Called." in response.data[0].title()


def test_inbound_call_valid_twilio_signature_unknown_number(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    _make_relay_number(phone_user, enabled=True)
    unknown_number = "+1234567890"
    caller_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_call"
    data = {"Caller": caller_number, "Called": unknown_number}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    assert "Could Not Find Relay Number." in response.data[0].title()


def test_inbound_call_valid_twilio_signature_good_data(
    phone_user, mocked_twilio_client
):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    pre_call_calls_forwarded = relay_number.calls_forwarded
    caller_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_call"
    data = {"Caller": caller_number, "Called": relay_number.number}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 201
    decoded_content = response.content.decode()
    assert f'callerId="{caller_number}"' in decoded_content
    assert f"<Number>{real_phone.number}</Number>" in decoded_content
    relay_number.refresh_from_db()
    assert relay_number.calls_forwarded == pre_call_calls_forwarded + 1
    inbound_contact = InboundContact.objects.get(
        relay_number=relay_number, inbound_number=caller_number
    )
    assert inbound_contact.num_calls == 1
    assert inbound_contact.last_inbound_type == "call"


def test_inbound_call_valid_twilio_signature_disabled_number(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=False)
    caller_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_call"
    data = {"Caller": caller_number, "Called": relay_number.number}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    assert "Not Accepting Calls" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()
