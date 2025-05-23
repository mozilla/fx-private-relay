import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal
from unittest.mock import Mock, call, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.test.utils import override_settings

import pytest
from model_bakery import baker
from rest_framework.test import APIClient
from twilio.base.exceptions import TwilioRestException
from twilio.request_validator import RequestValidator
from twilio.rest import Client
from waffle.testutils import override_flag

from privaterelay.tests.glean_tests import assert_glean_record

if settings.PHONES_ENABLED:
    from api.views.phones import MatchByPrefix, _match_by_prefix
    from phones.models import InboundContact, RealPhone, RelayNumber
    from phones.tests.models_tests import make_phone_test_user


pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


@pytest.fixture()
def phone_user(db):
    return make_phone_test_user()


_REAL_PHONE = "+12223334444"
_RELAY_NUMBER = "+19998887777"


def _make_real_phone(phone_user, **kwargs):
    return RealPhone.objects.create(user=phone_user, number=_REAL_PHONE, **kwargs)


def _make_relay_number(phone_user, vendor="twilio", **kwargs):
    return RelayNumber.objects.create(
        user=phone_user, number=_RELAY_NUMBER, vendor=vendor, **kwargs
    )


@pytest.fixture()
def registered_phone_user(phone_user, mocked_twilio_client):
    _make_real_phone(phone_user, verified=True)
    _make_relay_number(phone_user)
    mocked_twilio_client.messages.create.reset_mock()  # Forget new user messages
    return phone_user


@pytest.fixture()
def mobile_app_flag(db):
    with override_flag("mobile_app", active=True):
        yield


@pytest.fixture()
def outbound_phone_flag(db):
    with override_flag("outbound_phone", active=True):
        yield


@pytest.fixture()
def mobile_app_user(phone_user, mobile_app_flag):
    return phone_user


@pytest.fixture()
def outbound_phone_user(registered_phone_user, mobile_app_flag, outbound_phone_flag):
    return registered_phone_user


@dataclass
class MockTwilioMessage:
    from_: str
    to: str
    date_sent: datetime
    body: str


@pytest.fixture()
def user_with_sms_activity(outbound_phone_user, mocked_twilio_client):
    """Return a user with SMS inbound and outbound activity."""
    relay_number = RelayNumber.objects.get(user=outbound_phone_user)

    # First SMS contact
    InboundContact.objects.create(
        relay_number=relay_number,
        inbound_number="+13015550001",
        last_inbound_date=datetime(2023, 3, 1, 12, 5, tzinfo=UTC),
        last_inbound_type="text",
        last_text_date=datetime(2023, 3, 1, 12, 5, tzinfo=UTC),
    )
    # Second SMS contact
    InboundContact.objects.create(
        relay_number=relay_number,
        inbound_number="+13015550002",
        last_inbound_date=datetime(2023, 3, 2, 13, 5, tzinfo=UTC),
        last_inbound_type="text",
        last_text_date=datetime(2023, 3, 2, 13, 5, tzinfo=UTC),
    )
    # Voice contact
    InboundContact.objects.create(
        relay_number=relay_number,
        inbound_number="+13015550003",
        last_inbound_date=datetime(2023, 3, 3, 8, 30, tzinfo=UTC),
        last_inbound_type="call",
        last_call_date=datetime(2023, 3, 3, 8, 30, tzinfo=UTC),
    )
    twilio_messages = [
        MockTwilioMessage(
            from_="+13015550001",
            to=relay_number.number,
            date_sent=datetime(2023, 3, 1, 12, 0, tzinfo=UTC),
            body="Send Y to confirm appointment",
        ),
        MockTwilioMessage(
            from_=relay_number.number,
            to="+13015550001",
            date_sent=datetime(2023, 3, 1, 12, 5, tzinfo=UTC),
            body="Y",
        ),
        MockTwilioMessage(
            from_="+13015550002",
            to=relay_number.number,
            date_sent=datetime(2023, 3, 2, 13, 0, tzinfo=UTC),
            body="Donate $100 to Senator Smith?",
        ),
        MockTwilioMessage(
            from_=relay_number.number,
            to="+13015550002",
            date_sent=datetime(2023, 3, 2, 13, 5, tzinfo=UTC),
            body="STOP STOP STOP",
        ),
        MockTwilioMessage(
            from_=relay_number.number,
            to="+13015550004",
            date_sent=datetime(2023, 3, 4, 20, 55, tzinfo=UTC),
            body="U Up?",
        ),
    ]

    def mock_list(to=None, from_=None):
        messages = []
        for msg in twilio_messages:
            if (not to or to == msg.to) and (not from_ or from_ == msg.from_):
                messages.append(msg)
        return messages

    mocked_twilio_client.messages.list.side_effect = mock_list

    return outbound_phone_user


@pytest.fixture(autouse=True)
def mocked_twilio_client():
    """
    Mock PhonesConfig with a mock twilio client
    """
    re_e164 = re.compile(
        r"""
    \+1                    # Initial code
    (?P<area_code>\d\d\d)  # Area code
    (?P<exchange>\d\d\d)   # Exchange code
    (?P<lastfour>\d\d\d\d) # Last 4 digits
    """,
        re.VERBOSE,
    )

    with patch(
        "phones.apps.PhonesConfig.twilio_client", spec=Client
    ) as mock_twilio_client:
        mock_twilio_client._pn_return = Mock()

        def mock_phone_lookup(number: str | None = None) -> Mock:
            """Return number details based on the number passed to phone_numbers()"""
            if number is None:
                # Allow mocked_twilio_client.lookups.v1.phone_numbers().fetch to work
                assert isinstance(mock_twilio_client._pn_return, Mock)
                return mock_twilio_client._pn_return
            match = re_e164.match(number)
            assert match
            national_format = (
                f"({match.group('area_code')}) "
                f"{match.group('exchange')}-{match.group('lastfour')}"
            )
            mock_details = Mock(
                country_code="US",
                phone_number=number,
                carrier="verizon",
                national_format=national_format,
            )
            mock_return = Mock(fetch=Mock(return_value=mock_details))
            mock_twilio_client._pn_return = mock_return
            return mock_return

        mock_twilio_client.lookups.v1.phone_numbers.side_effect = mock_phone_lookup
        yield mock_twilio_client
        mock_twilio_client._pn_return = Mock()


@pytest.fixture(autouse=True)
def mocked_twiml_app():
    with patch("api.views.phones.twiml_app") as mock_twiml_app:
        mock_twiml_app.sms_status_callback = "test_sms_status_callback"
        yield mock_twiml_app


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


@override_settings(IQ_ENABLED=False)
def test_iq_endpoint_without_iq_enabled_not_found():
    client = APIClient()
    path = "/api/v1/inbound_sms_iq/"
    response = client.post(path)
    assert response.status_code == 404


@pytest.mark.parametrize("endpoint", ("realphone", "relaynumber"))
@pytest.mark.django_db
def test_phone_get_endpoints_require_auth(endpoint):
    client = APIClient()
    path = f"/api/v1/{endpoint}/"
    response = client.get(path)
    assert response.status_code == 401

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
    expected = [
        "Relay Phone is currently only available for these country codes:"
        " ['CA', 'PR', 'US']. Your phone number country code is: 'NL'."
    ]
    assert response.json() == expected


def test_realphone_post_valid_us_es164_number(phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+12223334444"
    path = "/api/v1/realphone/"
    data = {"number": number}

    response = client.post(path, data, format="json")
    assert response.status_code == 201
    assert response.data["number"] == number
    assert response.data["verified"] is False
    assert response.data["verification_sent_date"] != ""
    assert "Sent verification" in response.data["message"]

    mocked_twilio_client.lookups.v1.phone_numbers.assert_called_once_with(number)
    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_called_once()
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == number
    assert "verification code" in call_kwargs["body"]

    real_phone = RealPhone.objects.get(number=number)
    assert real_phone.verified is False
    assert real_phone.country_code == "US"


def test_realphone_post_valid_ca_es164_number(phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+12505550199"
    path = "/api/v1/realphone/"
    data = {"number": number}

    mock_fetch = Mock(
        return_value=Mock(country_code="ca", phone_number=number, carrier="northwestel")
    )
    mocked_twilio_client.lookups.v1.phone_numbers = Mock(
        return_value=Mock(fetch=mock_fetch)
    )

    response = client.post(path, data, format="json")
    assert response.status_code == 201
    assert response.data["number"] == number
    assert response.data["verified"] is False
    assert response.data["verification_sent_date"] != ""
    assert "Sent verification" in response.data["message"]

    mocked_twilio_client.lookups.v1.phone_numbers.assert_called_once_with(number)
    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_called_once()
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == number
    assert "verification code" in call_kwargs["body"]

    real_phone = RealPhone.objects.get(number=number)
    assert real_phone.verified is False
    assert real_phone.country_code == "CA"


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
    assert response.data["verified"] is False
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
    mocked_twilio_client.messages.create.assert_not_called()


def test_realphone_post_canadian_number(phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(phone_user)
    number = "+12501234567"
    path = "/api/v1/realphone/"
    data = {"number": number}

    mock_fetch = Mock(
        return_value=Mock(country_code="CA", phone_number=number, carrier="telus")
    )
    mocked_twilio_client.lookups.v1.phone_numbers = Mock(
        return_value=Mock(fetch=mock_fetch)
    )

    response = client.post(path, data, format="json", HTTP_X_CLIENT_REGION="nl")
    assert response.status_code == 201
    assert response.data["number"] == number
    assert response.data["verified"] is False
    assert response.data["verification_sent_date"] != ""
    assert "Sent verification" in response.data["message"]


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
    assert response.data["verified"] is True
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
    assert real_phone.verified is False
    assert real_phone.verified_date is None

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
    assert response.data["verified"] is True
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
    assert response.data["verified"] is True
    assert response.data["verified_date"] != ""

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()

    response = client.patch(path, data, format="json")
    assert response.status_code == 200
    assert response.data["number"] == real_phone.number
    assert response.data["verified"] is True
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
    assert real_phone.verified is False
    assert real_phone.verified_date is None

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
    assert real_phone.verified is False
    assert real_phone.verified_date is None

    mocked_twilio_client.lookups.v1.phone_numbers().fetch.assert_not_called()


def test_realphone_delete_cant_delete_verified(phone_user):
    real_phone = _make_real_phone(phone_user, verified=True)
    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/realphone/{real_phone.id}/"

    response = client.delete(path, format="json")

    assert response.status_code == 400
    real_phone.refresh_from_db()
    assert real_phone.verified is True


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
    assert relay_number.enabled is True
    mock_create = Mock()
    mocked_twilio_client.incoming_phone_numbers.create = mock_create

    client = APIClient()
    client.force_authenticate(phone_user)
    path = f"/api/v1/relaynumber/{relay_number.id}/"
    data = {"enabled": False}
    response = client.patch(path, data, format="json")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.enabled is False
    mock_create.assert_not_called()

    data = {"enabled": True}
    response = client.patch(path, data, format="json")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.enabled is True
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
    assert "random_options" in data_keys


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


def test_relaynumber_search_by_location_canada(phone_user, mocked_twilio_client):
    mock_list = Mock(return_value=[])
    mocked_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )
    _make_real_phone(phone_user, country_code="CA", verified=True)

    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/search/?location=Ottawa, ON"

    response = client.get(path)

    assert response.status_code == 200
    available_numbers_calls = (
        mocked_twilio_client.available_phone_numbers.call_args_list
    )
    assert available_numbers_calls == [call("CA")]
    assert mock_list.call_args_list == [call(in_locality="Ottawa, ON", limit=10)]


def test_relaynumber_search_by_area_code_canada(phone_user, mocked_twilio_client):
    mock_list = Mock(return_value=[])
    mocked_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )
    _make_real_phone(phone_user, country_code="CA", verified=True)

    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/relaynumber/search/?area_code=613"

    response = client.get(path)

    assert response.status_code == 200
    available_numbers_calls = (
        mocked_twilio_client.available_phone_numbers.call_args_list
    )
    assert available_numbers_calls == [call("CA")]
    assert mock_list.call_args_list == [call(area_code="613", limit=10)]


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
    path = "/api/v1/realphone/resend_welcome_sms/"
    response = client.post(path)

    assert response.status_code == 401


def test_resend_welcome_sms(phone_user, mocked_twilio_client):
    mock_messages_create = mocked_twilio_client.messages.create
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)

    mocked_twilio_client.reset_mock()
    client = APIClient()
    client.force_authenticate(phone_user)
    path = "/api/v1/realphone/resend_welcome_sms/"
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


def test_inbound_sms_valid_twilio_signature_good_data_deactivated_user(
    phone_user, mocked_twilio_client
):
    phone_user.is_active = False
    phone_user.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)
    pre_inbound_remaining_texts = relay_number.remaining_texts
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+15556660000", "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_not_called()
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 0
    assert relay_number.remaining_texts == pre_inbound_remaining_texts


def test_inbound_sms_valid_twilio_signature_good_data(
    phone_user, mocked_twilio_client, caplog
):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user)
    pre_inbound_remaining_texts = relay_number.remaining_texts
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+15556660000", "To": relay_number.number, "Body": "test body"}

    with caplog.at_level("INFO"):
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

    for record in caplog.records:
        if record.name == "glean-server-event":
            assert_glean_record(record)
            payload = json.loads(getattr(record, "payload"))
            event = payload["events"][0]
            assert event["category"] == "phone"
            assert event["name"] == "text_received"
            assert event["extra"]["fxa_id"] == phone_user.profile.metrics_fxa_id


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

    assert response.status_code == 200
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    relay_number.refresh_from_db()
    assert relay_number.texts_blocked == 1
    assert "<Response/>" in decoded_content
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


def test_inbound_sms_reply_with_no_remaining_texts(phone_user, mocked_twilio_client):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    relay_number.remaining_texts = 0
    relay_number.save()
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": "+12223334444", "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    relay_number.refresh_from_db()
    assert "Number Is Out Of Texts" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()


def test_inbound_sms_valid_twilio_signature_no_phone_log(
    phone_user: User, mocked_twilio_client: Mock
) -> None:
    phone_user.profile.store_phone_log = False
    phone_user.profile.save()
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
    phone_user: User, mocked_twilio_client: Mock
) -> None:
    phone_user.profile.store_phone_log = True
    phone_user.profile.save()
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


def test_inbound_sms_to_unsubscribed_contact(
    phone_user: User, mocked_twilio_client: Mock, caplog: pytest.LogCaptureFixture
) -> None:
    phone_user.profile.store_phone_log = True
    phone_user.profile.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    inbound_number = "+15556660000"
    inbound_contact = InboundContact.objects.create(
        relay_number=relay_number, inbound_number=inbound_number
    )
    mocked_twilio_client.reset_mock()
    mocked_twilio_client.messages.create.side_effect = TwilioRestException(
        uri="/2010-04-01/Accounts/{AccountSid}/Messages.json",
        msg=("Unable to create record:" " Attempt to send to unsubscribed recipient"),
        method="POST",
        status=400,
        code=21610,
    )

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
    assert relay_number.texts_forwarded == 0
    assert relay_number.texts_blocked == 1
    assert (
        "eventsinfo",
        20,
        "User has blocked their Relay number",
    ) in caplog.record_tuples


def test_inbound_sms_message_too_long(
    phone_user: User, mocked_twilio_client: Mock, caplog: pytest.LogCaptureFixture
) -> None:
    phone_user.profile.store_phone_log = True
    phone_user.profile.save()
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    inbound_number = "+15556660000"
    inbound_contact = InboundContact.objects.create(
        relay_number=relay_number, inbound_number=inbound_number
    )
    mocked_twilio_client.reset_mock()
    mocked_twilio_client.messages.create.side_effect = TwilioRestException(
        uri="/2010-04-01/Accounts/{AccountSid}/Messages.json",
        msg=("Unable to create record:" " Message body is too long"),
        method="POST",
        status=400,
        code=21602,
    )

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
    assert relay_number.texts_forwarded == 0
    assert relay_number.texts_blocked == 0
    assert ("events", 40, "Twilio failed to forward message") in caplog.record_tuples


def test_inbound_sms_reply_not_storing_phone_log(
    phone_user: User, mocked_twilio_client: Mock
) -> None:
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    mocked_twilio_client.reset_mock()
    phone_user.profile.store_phone_log = False
    phone_user.profile.save()

    client = APIClient()
    path = "/api/v1/inbound_sms"
    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert "The reply feature requires " in decoded_content
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == real_phone.number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"].startswith("The reply feature requires \u2068Firefox ")
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
    assert "You can only reply to phone numbers " in decoded_content
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == real_phone.number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == (
        "Message failed to send. You can only reply to phone numbers that have sent"
        " you a text message."
    )


def test_inbound_sms_reply(phone_user: User, mocked_twilio_client: Client) -> None:
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Receive a text from a contact
    client = APIClient()
    path = "/api/v1/inbound_sms"
    contact_number = "+15556660000"
    data = {"From": contact_number, "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1

    # Test: Send text reply to the contact
    mocked_twilio_client.reset_mock()
    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == contact_number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 2


def test_inbound_sms_reply_to_first_caller(
    phone_user: User, mocked_twilio_client: Client
) -> None:
    """MPP-2581: A first contact that texts then calls is the last texter."""
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Receive a text from a contact
    client = APIClient()
    sms_path = "/api/v1/inbound_sms"
    contact_number = "+15556660000"
    data = {"From": contact_number, "To": relay_number.number, "Body": "test body"}
    response = client.post(sms_path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1

    # Setup: Receive a call from the same contact
    voice_path = "/api/v1/inbound_call"
    data = {"Caller": contact_number, "Called": relay_number.number}
    response = client.post(voice_path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.calls_forwarded == 1

    # Test: Send text reply to the contact
    mocked_twilio_client.reset_mock()
    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(sms_path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == contact_number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 2


def test_inbound_sms_reply_to_caller(
    phone_user: User, mocked_twilio_client: Client
) -> None:
    """MPP-2581: A later contact that texts then calls is still the last texter."""
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Receive a text from first contact
    client = APIClient()
    sms_path = "/api/v1/inbound_sms"
    contact1_number = "+13015550000"
    data = {
        "From": contact1_number,
        "To": relay_number.number,
        "Body": "Hi I'm contact1",
    }
    response = client.post(sms_path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1

    # Setup: Receive a text from second contact
    contact2_number = "+13025550001"
    data = {
        "From": contact2_number,
        "To": relay_number.number,
        "Body": "Hello I'm contact2, I'll call in a second.",
    }
    response = client.post(sms_path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 2

    # Setup: Receive a call from second contact
    voice_path = "/api/v1/inbound_call"
    data = {"Caller": contact2_number, "Called": relay_number.number}
    response = client.post(voice_path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.calls_forwarded == 1

    # Test: Send a reply to second contact
    mocked_twilio_client.reset_mock()
    data = {
        "From": real_phone.number,
        "To": relay_number.number,
        "Body": "Thanks for the call!",
    }
    response = client.post(sms_path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == contact2_number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "Thanks for the call!"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 3


def test_inbound_sms_reply_pre_transition(
    phone_user: User, mocked_twilio_client: Client
) -> None:
    """MPP-2581: A unmigrated server may not set last_text_date."""
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Create a text from a contact without last_text_date
    inbound_contact = InboundContact.objects.create(
        relay_number=relay_number,
        inbound_number="+15556660000",
        last_inbound_type="text",
    )

    # Test: Send a reply to contact
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


def test_inbound_sms_reply_no_multi_replies(
    phone_user: User, mocked_twilio_client: Mock
) -> None:
    """A user without multi_replies flag cannot use prefixes."""
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Contact with number ending in 0000
    path = "/api/v1/inbound_sms"
    contact1 = "+13015550000"
    data = {"From": contact1, "To": relay_number.number, "Body": "Hi!"}
    client = APIClient()
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1

    # Setup: Contact with number not ending in 0000
    contact2 = "+14015557354"
    data = {"From": contact2, "To": relay_number.number, "Body": "Hi!"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 2

    # Test: Reply starting with a prefix 0000
    mocked_twilio_client.reset_mock()
    data = {
        "From": real_phone.number,
        "To": relay_number.number,
        "Body": "0000: test reply",
    }
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == contact2
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "0000: test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 3


@dataclass
class MultiReplyFixture:
    """Bundle fixtures for multi_replies tests."""

    user: User
    real_phone: "RealPhone"
    relay_number: "RelayNumber"
    old_texts_forwarded: int
    mocked_twilio_client: Client


@pytest.fixture
def multi_reply(
    phone_user: User, mocked_twilio_client: Client
) -> Iterator[MultiReplyFixture]:
    """Setup data and mocked interfaces for multi-reply tests."""
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    mocked_twilio_client.reset_mock()
    contacts = (
        ("+13015550000", "text"),  # Oldest
        ("+13025550001", "text"),  # Same last 4 digits as below
        ("+13035550001", "text"),  # Same last 4 digits as above
        ("+13045551301", "text"),  # Last 4 match first 4 of oldest
        ("64192", "text"),  # shortcode
        ("+15062345678", "text"),  # CA number
        ("+13055550002", "text"),  # Text from number
        ("+13055550002", "call"),  # Call from same number
        ("+14045550003", "call"),  # Most recent call, never texted
    )
    client = APIClient()
    for number, contact_type in contacts:
        if contact_type == "text":
            response = client.post(
                "/api/v1/inbound_sms",
                {"From": number, "To": relay_number.number, "Body": "Hi!"},
                HTTP_X_TWILIO_SIGNATURE="valid",
            )
        else:
            assert contact_type == "call"
            response = client.post(
                "/api/v1/inbound_call",
                {"Caller": number, "Called": relay_number.number},
                HTTP_X_TWILIO_SIGNATURE="valid",
            )
        assert response.status_code == 201
    mocked_twilio_client.reset_mock()
    relay_number.refresh_from_db()

    with override_flag("multi_replies", active=True):
        yield MultiReplyFixture(
            user=phone_user,
            real_phone=real_phone,
            relay_number=relay_number,
            old_texts_forwarded=relay_number.texts_forwarded,
            mocked_twilio_client=mocked_twilio_client,
        )


@pytest.mark.parametrize(
    "prefix",
    (
        "0000",
        "0000:",
        "+13015550000",
        "+13015550000: ",
        "(301) 555-0000 ",
    ),
)
def test_inbound_sms_reply_one_match(
    multi_reply: MultiReplyFixture, prefix: str
) -> None:
    """A prefix that matches a single contact sends to that contact."""
    relay_number = multi_reply.relay_number
    path = "/api/v1/inbound_sms"
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": f"{prefix}test reply",
    }
    response = APIClient().post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == "+13015550000"
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded + 1


def test_inbound_sms_reply_full_number_wins(multi_reply: MultiReplyFixture) -> None:
    """If a prefix could be a short code or a full number, pick full number."""
    relay_number = multi_reply.relay_number
    path = "/api/v1/inbound_sms"
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": "1301 5550000 Isn't +13045551301 a jerk?",
    }
    response = APIClient().post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == "+13015550000"
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "Isn't +13045551301 a jerk?"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded + 1


def test_inbound_sms_reply_short_prefix_never_text(
    multi_reply: MultiReplyFixture,
) -> None:
    """A contact that only called can be texted via short prefix."""
    relay_number = multi_reply.relay_number
    path = "/api/v1/inbound_sms"
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": "0003: send reply to caller",
    }
    response = APIClient().post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == "+14045550003"
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "send reply to caller"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded + 1


def test_inbound_sms_reply_full_prefix_never_text(
    multi_reply: MultiReplyFixture,
) -> None:
    """A contact that only called can be texted via full number."""
    relay_number = multi_reply.relay_number
    path = "/api/v1/inbound_sms"
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": "(404)555-0003: can we continue over text?",
    }
    response = APIClient().post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == "+14045550003"
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "can we continue over text?"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded + 1


def test_inbound_sms_reply_invalid_contact_does_not_break_prefix(
    multi_reply: MultiReplyFixture,
) -> None:
    """A previous contact with an invalid phone number is ignored."""
    relay_number = multi_reply.relay_number
    InboundContact.objects.create(
        relay_number=relay_number,
        inbound_number="+0000",
    )
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": "0000: test reply",
    }
    response = APIClient().post(
        "/api/v1/inbound_sms", data, HTTP_X_TWILIO_SIGNATURE="valid"
    )

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == "+13015550000"
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded + 1


_sms_reply_error_test_cases = {
    "short prefix with multiple matching contacts": (
        "0001 test reply to ambiguous number",
        (
            "Message failed to send. There is more than one phone number in this"
            " thread ending in \u20680001\u2069. To retry, start your message with the"
            " complete number."
        ),
    ),
    "short prefix without matching contact": (
        "0404: test reply to unknown number",
        (
            "Message failed to send. There is no phone number in this thread ending in"
            " \u20680404\u2069. Please check the number and try again."
        ),
    ),
    "full number without matching contact": (
        "+14045550404: test reply to unknown number",
        (
            "Message failed to send. There is no previous sender with the phone number"
            " \u2068+14045550404\u2069. Please check the number and try again."
        ),
    ),
    "short prefix without message": (
        "0002:",
        (
            "Message failed to send. Please include a message after the phone number"
            " ending in \u20680002\u2069."
        ),
    ),
    "full number without message": (
        "+13055550002",
        (
            "Message failed to send. Please include a message after the phone number"
            " \u2068+13055550002\u2069."
        ),
    ),
}


@pytest.mark.parametrize(
    "incoming_message, error_message",
    _sms_reply_error_test_cases.values(),
    ids=_sms_reply_error_test_cases.keys(),
)
def test_inbound_sms_reply_prefix_errors(
    multi_reply: MultiReplyFixture, incoming_message: str, error_message: str
) -> None:
    """If a prefixed message has an issue, the user gets advice."""
    relay_number = multi_reply.relay_number
    path = "/api/v1/inbound_sms"
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": incoming_message,
    }
    response = APIClient().post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == multi_reply.real_phone.number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == error_message
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded


def test_inbound_sms_reply_no_prefix_last_sender(
    multi_reply: MultiReplyFixture,
) -> None:
    """If there is no detected prefix, send message to the last text contact."""
    relay_number = multi_reply.relay_number
    path = "/api/v1/inbound_sms"
    data = {
        "From": multi_reply.real_phone.number,
        "To": relay_number.number,
        "Body": "1 2 3 4 is this on?",
    }
    response = APIClient().post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    msg_create_api = multi_reply.mocked_twilio_client.messages.create
    msg_create_api.assert_called_once()
    call_kwargs = msg_create_api.call_args.kwargs
    assert call_kwargs["to"] == "+13055550002"
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == data["Body"]
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == multi_reply.old_texts_forwarded + 1


def test_inbound_sms_reply_to_unsubscribed(
    phone_user: User, mocked_twilio_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Receive a text from a contact
    client = APIClient()
    path = "/api/v1/inbound_sms"
    contact_number = "+15556660000"
    data = {"From": contact_number, "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1

    # Test: Send text reply to the contact, get exception
    mocked_twilio_client.reset_mock()
    mocked_twilio_client.messages.create.side_effect = TwilioRestException(
        uri="/2010-04-01/Accounts/{AccountSid}/Messages.json",
        msg=("Unable to create record:" " Attempt to send to unsubscribed recipient"),
        method="POST",
        status=400,
        code=21610,
    )

    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == contact_number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert ("events", 40, "Twilio failed to send reply") in caplog.record_tuples


def test_inbound_sms_reply_too_long(
    phone_user: User, mocked_twilio_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)

    # Setup: Receive a text from a contact
    client = APIClient()
    path = "/api/v1/inbound_sms"
    contact_number = "+15556660000"
    data = {"From": contact_number, "To": relay_number.number, "Body": "test body"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 201
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1

    # Test: Send text reply to the contact, get exception
    mocked_twilio_client.reset_mock()
    mocked_twilio_client.messages.create.side_effect = TwilioRestException(
        uri="/2010-04-01/Accounts/{AccountSid}/Messages.json",
        msg="Unable to create record: Message body is too long",
        method="POST",
        status=400,
        code=21602,
    )

    data = {"From": real_phone.number, "To": relay_number.number, "Body": "test reply"}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once()
    call_kwargs = mocked_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == contact_number
    assert call_kwargs["from_"] == relay_number.number
    assert call_kwargs["body"] == "test reply"
    relay_number.refresh_from_db()
    assert relay_number.texts_forwarded == 1
    assert ("events", 40, "Twilio failed to send reply") in caplog.record_tuples


_match_by_prefix_candidates = {
    "+13015550000",
    "+13025550001",
    "+13035550001",  # Same last 4 digits as above
    "+13045551301",  # Last 4 match first 4 of oldest
}


MatchByPrefixParams = tuple[
    str,  # text message
    Literal["short", "full"],  # match_type
    str,  # prefix
    str,  # detected number
    list[str],  # numbers
]

_match_by_prefix_tests: dict[str, MatchByPrefixParams] = {
    "4 digits, no message": ("0000 ", "short", "0000 ", "0000", ["+13015550000"]),
    "4 digit multiple matches": (
        "0001 the message",
        "short",
        "0001 ",
        "0001",
        ["+13025550001", "+13035550001"],
    ),
    "Two prefixes first match": (
        "0000 0001 the message",
        "short",
        "0000 ",
        "0000",
        ["+13015550000"],
    ),
    "4 digit, no match": ("0010 the message", "short", "0010 ", "0010", []),
    "4 digit with space": (
        "0000 the message",
        "short",
        "0000 ",
        "0000",
        ["+13015550000"],
    ),
    "4 digit without space": (
        "0000the message",
        "short",
        "0000",
        "0000",
        ["+13015550000"],
    ),
    "4 digit with colon": (
        "0000:the message",
        "short",
        "0000:",
        "0000",
        ["+13015550000"],
    ),
    "4 digit with colon space": (
        "0000: the message",
        "short",
        "0000: ",
        "0000",
        ["+13015550000"],
    ),
    "leading spaces 4 digits": (
        "  1301  the message",
        "short",
        "  1301  ",
        "1301",
        ["+13045551301"],
    ),
    "4 digit with two colons": (
        "0000 :: the message",
        "short",
        "0000 :",
        "0000",
        ["+13015550000"],
    ),
    "4 digits newline": (
        "1301\nthe message",
        "short",
        "1301\n",
        "1301",
        ["+13045551301"],
    ),
    "first 4 of 6 digits": (
        "130178 the message",
        "short",
        "1301",
        "1301",
        ["+13045551301"],
    ),
    "4 digit with dash": (
        "0000 - the message",
        "short",
        "0000 ",
        "0000",
        ["+13015550000"],
    ),
    "4 digit with slash": (
        "0000 / the message",
        "short",
        "0000 ",
        "0000",
        ["+13015550000"],
    ),
    "4 digit with backslash": (
        r"0000 \ the message",
        "short",
        r"0000 ",
        "0000",
        ["+13015550000"],
    ),
    "4 digit with right bracket": (
        "0000] the message",
        "short",
        "0000",
        "0000",
        ["+13015550000"],
    ),
    "4 digit with pipe": (
        "0000 | the message",
        "short",
        "0000 ",
        "0000",
        ["+13015550000"],
    ),
    "e.164, no message": (
        "+13015550000",
        "full",
        "+13015550000",
        "+13015550000",
        ["+13015550000"],
    ),
    "e.164, no match": (
        "+14045550000 no match",
        "full",
        "+14045550000 ",
        "+14045550000",
        [],
    ),
    "e.164, colon": (
        "+13025550001: the message",
        "full",
        "+13025550001: ",
        "+13025550001",
        ["+13025550001"],
    ),
    "e.164, double colon": (
        "+13025550001 :: the message",
        "full",
        "+13025550001 :",
        "+13025550001",
        ["+13025550001"],
    ),
    "e.164, dash": (
        "+13035550001 - the message",
        "full",
        "+13035550001 ",
        "+13035550001",
        ["+13035550001"],
    ),
    "e.164, slash": (
        "+13035550001 / the message",
        "full",
        "+13035550001 ",
        "+13035550001",
        ["+13035550001"],
    ),
    "e.164, backslash": (
        r"+13035550001 \ the message",
        "full",
        r"+13035550001 ",
        "+13035550001",
        ["+13035550001"],
    ),
    "e.164, right bracket": (
        "+13045551301]the message",
        "full",
        "+13045551301",
        "+13045551301",
        ["+13045551301"],
    ),
    "e.164, pipe": (
        "+13045551301|the message",
        "full",
        "+13045551301",
        "+13045551301",
        ["+13045551301"],
    ),
    "Full without plus": (
        "13045551301 the message",
        "full",
        "13045551301 ",
        "+13045551301",
        ["+13045551301"],
    ),
    "US format": (
        "1 (304) 555-1301 the message",
        "full",
        "1 (304) 555-1301 ",
        "+13045551301",
        ["+13045551301"],
    ),
    "US format no country code": (
        "(304)555-1301the message",
        "full",
        "(304)555-1301",
        "+13045551301",
        ["+13045551301"],
    ),
    "Full no country code": (
        "3015550000 a message",
        "full",
        "3015550000 ",
        "+13015550000",
        ["+13015550000"],
    ),
    "Full spaces": (
        "+1 301 555 0000 the message",
        "full",
        "+1 301 555 0000 ",
        "+13015550000",
        ["+13015550000"],
    ),
    "Two e.164, first match": (
        "(301) 555-0000 +13045551301",
        "full",
        "(301) 555-0000 ",
        "+13015550000",
        ["+13015550000"],
    ),
}


@pytest.mark.parametrize(
    "text, match_type, prefix, detected, numbers",
    _match_by_prefix_tests.values(),
    ids=list(_match_by_prefix_tests.keys()),
)
def test_match_by_prefix(
    text: str,
    match_type: Literal["short", "full"],
    prefix: str,
    detected: str,
    numbers: list[str],
) -> None:
    """_match_by_prefix returns the matching candidates and the detected prefix."""
    match = _match_by_prefix(text, _match_by_prefix_candidates)
    expected_match = MatchByPrefix(
        match_type=match_type, prefix=prefix, detected=detected, numbers=numbers
    )
    assert match == expected_match


_match_by_prefix_no_match_tests: dict[str, str] = {
    "no prefix": "no prefix",
    "3 digits is not a prefix": "000 the message",
    "digits with spaces is not a prefix": "00 01 the message",
    "letter + digits is not a prefix": "x0000 the message",
    "e.164 with extra num, no match": "+130155500007 message",
}


@pytest.mark.parametrize(
    "text",
    _match_by_prefix_no_match_tests.values(),
    ids=list(_match_by_prefix_no_match_tests.keys()),
)
def test_match_by_prefix_no_match(text: str) -> None:
    match = _match_by_prefix(text, _match_by_prefix_candidates)
    assert match is None


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


def test_inbound_call_valid_twilio_signature_good_data_deactivated_user(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    phone_user.is_active = False
    phone_user.save()
    pre_call_calls_forwarded = relay_number.calls_forwarded
    caller_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_call"
    data = {"Caller": caller_number, "Called": relay_number.number}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    decoded_content = response.content.decode()
    assert "<Response/>" in decoded_content
    relay_number.refresh_from_db()
    assert relay_number.calls_forwarded == pre_call_calls_forwarded
    with pytest.raises(InboundContact.DoesNotExist):
        InboundContact.objects.get(
            relay_number=relay_number, inbound_number=caller_number
        )


def test_inbound_call_valid_twilio_signature_good_data(
    phone_user, mocked_twilio_client, caplog
):
    real_phone = _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True)
    pre_call_calls_forwarded = relay_number.calls_forwarded
    caller_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_call"
    data = {"Caller": caller_number, "Called": relay_number.number}
    with caplog.at_level("INFO"):
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

    for record in caplog.records:
        if record.name == "glean-server-event":
            assert_glean_record(record)
            payload = json.loads(getattr(record, "payload"))
            event = payload["events"][0]
            assert event["category"] == "phone"
            assert event["name"] == "call_received"
            assert event["extra"]["fxa_id"] == phone_user.profile.metrics_fxa_id


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

    assert response.status_code == 200
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    assert "<Say>" in decoded_content
    assert "that number is not available" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()


def test_inbound_call_valid_twilio_signature_no_remaining_seconds(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, remaining_seconds=0)
    caller_number = "+15556660000"
    mocked_twilio_client.reset_mock()

    client = APIClient()
    path = "/api/v1/inbound_call"
    data = {"Caller": caller_number, "Called": relay_number.number}
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    decoded_content = response.content.decode()
    assert decoded_content.startswith("<?xml")
    assert "Number Is Out Of Seconds" in decoded_content
    mocked_twilio_client.messages.create.assert_not_called()


@pytest.mark.django_db
def test_voice_status_invalid_twilio_signature(mocked_twilio_validator):
    mocked_twilio_validator.validate = Mock(return_value=False)

    client = APIClient()
    path = "/api/v1/voice_status"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="invalid")

    assert response.status_code == 400
    assert "Invalid Signature" in response.data[0].title()


def test_voice_status_missing_required_params_error():
    client = APIClient()
    path = "/api/v1/voice_status"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 400
    assert "Missing Called, Callstatus" in response.data[0].title()


def test_voice_status_not_completed_does_nothing(phone_user):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=False)
    pre_request_remaining_seconds = relay_number.remaining_seconds

    client = APIClient()
    path = "/api/v1/voice_status"
    data = {
        "CallSid": "CA1234567890abcdef1234567890abcdef",
        "Called": relay_number.number,
        "CallStatus": "in-progress",
    }
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.remaining_seconds == pre_request_remaining_seconds


def test_voice_status_completed_no_duration_error(phone_user):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=False)
    pre_request_remaining_seconds = relay_number.remaining_seconds

    client = APIClient()
    path = "/api/v1/voice_status"
    data = {
        "CallSid": "CA1234567890abcdef1234567890abcdef",
        "Called": relay_number.number,
        "CallStatus": "completed",
    }
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 400
    assert "Missing Callduration" in response.data[0].title()
    relay_number.refresh_from_db()
    assert relay_number.remaining_seconds == pre_request_remaining_seconds


@patch("api.views.phones.info_logger.info")
def test_voice_status_completed_reduces_remaining_seconds(
    mocked_events_info, phone_user
):
    # TODO: This test should fail since the Relay Number is disabled and the
    # POST to our /api/v1/voice_status should ignore the the reduced remaining
    # seconds.
    #
    # This is currently passing because the voice_status() is not checking if
    # the user's Relay Number has hit the limit or is disabled (bug logged in
    # MPP-2452).
    #
    # Keeping this test so we can correct it once MPP-2452 is completed.

    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=False)
    pre_request_remaining_seconds = relay_number.remaining_seconds

    client = APIClient()
    path = "/api/v1/voice_status"
    data = {
        "CallSid": "CA1234567890abcdef1234567890abcdef",
        "Called": relay_number.number,
        "CallStatus": "completed",
        "CallDuration": "27",
    }
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.remaining_seconds == pre_request_remaining_seconds - 27
    mocked_events_info.assert_not_called()


@patch("api.views.phones.info_logger.info")
def test_voice_status_completed_reduces_remaining_seconds_to_negative_value(
    mocked_events_info, phone_user
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=True, remaining_seconds=0)

    client = APIClient()
    path = "/api/v1/voice_status"
    data = {
        "CallSid": "CA1234567890abcdef1234567890abcdef",
        "Called": relay_number.number,
        "CallStatus": "completed",
        "CallDuration": "27",
    }
    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    relay_number.refresh_from_db()
    assert relay_number.remaining_seconds == -27
    mocked_events_info.assert_called_once_with(
        "phone_limit_exceeded",
        extra={
            "fxa_uid": phone_user.profile.fxa.uid,
            "call_duration_in_seconds": 27,
            "relay_number_enabled": True,
            "remaining_seconds": -27,
            "remaining_minutes": 0,
        },
    )


def test_voice_status_completed_deletes_call_from_twilio(
    phone_user, mocked_twilio_client
):
    _make_real_phone(phone_user, verified=True)
    relay_number = _make_relay_number(phone_user, enabled=False)
    call_sid = "CA1234567890abcdef1234567890abcdef"

    client = APIClient()
    path = "/api/v1/voice_status"
    data = {
        "CallSid": call_sid,
        "Called": relay_number.number,
        "CallStatus": "completed",
        "CallDuration": "27",
    }
    mock_call = Mock(spec=["delete"])
    mocked_twilio_client.calls = Mock(return_value=mock_call)

    response = client.post(path, data, HTTP_X_TWILIO_SIGNATURE="valid")

    assert response.status_code == 200
    mocked_twilio_client.calls.assert_called_once_with(call_sid)
    mock_call.delete.assert_called_once()


@pytest.mark.django_db
def test_sms_status_invalid_twilio_signature(mocked_twilio_validator):
    mocked_twilio_validator.validate = Mock(return_value=False)

    client = APIClient()
    path = "/api/v1/sms_status"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="invalid")

    assert response.status_code == 400
    assert "Invalid Signature" in response.data[0].title()


def test_sms_status_missing_required_params_error():
    client = APIClient()
    path = "/api/v1/sms_status"
    response = client.post(path, {}, HTTP_X_TWILIO_SIGNATURE="valid")
    assert response.status_code == 400
    assert "Missing Smsstatus Or Messagesid" in response.data[0].title()


def test_sms_status_before_delivered_does_nothing(mocked_twilio_client):
    client = APIClient()
    path = "/api/v1/sms_status"
    response = client.post(
        path,
        {
            "SmsStatus": "sent",
            "MessageSid": "SM1234567890abcdef1234567890abcdef",
        },
        HTTP_X_TWILIO_SIGNATURE="valid",
    )
    assert response.status_code == 200
    mocked_twilio_client.messages.assert_not_called()


def test_sms_status_delivered_deletes_message_from_twilio(mocked_twilio_client):
    client = APIClient()
    path = "/api/v1/sms_status"
    message_sid = "SM1234567890abcdef1234567890abcdef"
    mock_message = Mock(spec=["delete"])
    mocked_twilio_client.messages = Mock(return_value=mock_message)
    response = client.post(
        path,
        {
            "SmsStatus": "delivered",
            "MessageSid": message_sid,
        },
        HTTP_X_TWILIO_SIGNATURE="valid",
    )
    assert response.status_code == 200
    mocked_twilio_client.messages.assert_called_once_with(message_sid)
    mock_message.delete.assert_called_once()


def test_outbound_call_fails_with_no_auth():
    response = APIClient().post("/api/v1/call/", {"to": "+14045551234"})
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_outbound_call_fails_without_outbound_phone_flag(mobile_app_user):
    client = APIClient()
    client.force_authenticate(mobile_app_user)
    response = client.post("/api/v1/call/", {"to": "+14045551234"})
    assert response.status_code == 403
    assert response.json() == {"detail": "Requires outbound_phone waffle flag."}


def test_outbound_call_fails_without_real_phone(phone_user, outbound_phone_flag):
    client = APIClient()
    client.force_authenticate(phone_user)
    response = client.post("/api/v1/call/", {"to": "+14045551234"})
    assert response.status_code == 400
    assert response.json() == {
        "detail": "Requires a verified real phone and phone mask."
    }


def test_outbound_call_fails_without_phone_mask(phone_user, outbound_phone_flag):
    _make_real_phone(phone_user, verified=True)
    client = APIClient()
    client.force_authenticate(phone_user)
    response = client.post("/api/v1/call/", {"to": "+14045551234"})
    assert response.status_code == 400
    assert response.json() == {"detail": "Requires a phone mask."}


def test_outbound_call_fails_without_number(outbound_phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/call/", {})
    assert response.status_code == 400
    assert response.json() == {"to": "A number is required."}


def test_outbound_call_fails_with_short_phone_number(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/call/", {"to": "555-1234"})
    assert response.status_code == 400
    assert response.json() == [
        "number must be in E.164 format, or in local national format of the country "
        "detected: None"
    ]


def test_outbound_call(outbound_phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/call/", {"to": "+14045551234"})
    assert response.status_code == 200
    mocked_twilio_client.calls.create.assert_called_once_with(
        twiml=(
            "<Response><Say>Dialing (404) 555-1234 ...</Say>"
            "<Dial>+14045551234</Dial></Response>"
        ),
        to=_REAL_PHONE,
        from_=_RELAY_NUMBER,
    )


def test_outbound_call_fails_with_us_format_number_but_no_country(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/call/", {"to": "(404) 555-1111"})
    assert response.status_code == 400
    assert response.json() == [
        "number must be in E.164 format, or in local national format of the country "
        "detected: None"
    ]


def test_outbound_call_with_us_format_and_country(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/call/", {"to": "(404) 555-1111"}, HTTP_X_CLIENT_REGION="US"
    )
    assert response.status_code == 200
    mocked_twilio_client.calls.create.assert_called_once_with(
        twiml=(
            "<Response><Say>Dialing (404) 555-1111 ...</Say>"
            "<Dial>+14045551111</Dial></Response>"
        ),
        to=_REAL_PHONE,
        from_=_RELAY_NUMBER,
    )


def test_outbound_call_to_service_number_from_unknown_country_fails(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/call/", {"to": "511"})
    mocked_twilio_client.lookups.v1.phone_numbers.assert_not_called()
    assert response.status_code == 400
    assert response.json() == [
        "number must be in E.164 format, or in local national format of the country "
        "detected: None"
    ]


def test_outbound_call_to_service_number_from_us_fails(
    outbound_phone_user, mocked_twilio_client
):
    service_num = "911"
    phone_num_service = mocked_twilio_client.lookups.v1.phone_numbers
    phone_num_service.side_effect = None
    phone_num_service.return_value.fetch.side_effect = TwilioRestException(
        uri="/PhoneNumbers/{service_num}",
        msg=(
            "Unable to fetch record:"
            " The requested resource /PhoneNumbers/{service_num} was not found"
        ),
        method="GET",
        status=404,
        code=20404,
    )

    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/call/", {"to": service_num}, HTTP_X_CLIENT_REGION="US"
    )
    phone_num_service.assert_called_once_with("+1911")
    assert response.status_code == 400
    assert response.json() == ["Could not get number details for +1911"]


def test_outbound_sms_fails_with_no_auth():
    response = APIClient().post("/api/v1/message/", {"to": "+14045551234"})
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_outbound_sms_fails_without_outbound_phone_flag(mobile_app_user):
    client = APIClient()
    client.force_authenticate(mobile_app_user)
    response = client.post("/api/v1/message/", {"to": "+14045551234"})
    assert response.status_code == 403
    assert response.json() == {"detail": "Requires outbound_phone waffle flag."}


def test_outbound_sms_fails_without_phone_mask(phone_user, outbound_phone_flag):
    _make_real_phone(phone_user, verified=True)
    client = APIClient()
    client.force_authenticate(phone_user)
    response = client.post("/api/v1/message/", {"to": "+14045551234"})
    assert response.status_code == 400
    assert response.json() == {"detail": "Requires a phone mask."}


def test_outbound_sms_fails_without_params(outbound_phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/message/", {})
    assert response.status_code == 400
    assert response.json() == {
        "body": "A message body is required.",
        "destination": "A destination number is required.",
    }


def test_outbound_sms_fails_with_short_phone_number(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/message/", {"destination": "555-1234", "body": "Hello!"}
    )
    assert response.status_code == 400
    assert response.json() == [
        "number must be in E.164 format, or in local national format of the country "
        "detected: None"
    ]


def test_outbound_sms(outbound_phone_user, mocked_twilio_client):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/message/", {"destination": "+14045551234", "body": "Hi!"}
    )
    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once_with(
        to="+14045551234", from_=_RELAY_NUMBER, body="Hi!"
    )


def test_outbound_sms_fails_with_us_format_number_but_no_country(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/message/", {"destination": "(404) 555-1111", "body": "Hey you!"}
    )
    assert response.status_code == 400
    assert response.json() == [
        "number must be in E.164 format, or in local national format of the country "
        "detected: None"
    ]


def test_outbound_sms_with_us_format_and_country(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/message/",
        {"destination": "(404) 555-1111", "body": "Hi from US!"},
        HTTP_X_CLIENT_REGION="US",
    )
    assert response.status_code == 200
    mocked_twilio_client.messages.create.assert_called_once_with(
        to="+14045551111", from_=_RELAY_NUMBER, body="Hi from US!"
    )


def test_outbound_sms_to_service_number_from_unknown_country_fails(
    outbound_phone_user, mocked_twilio_client
):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post("/api/v1/message/", {"destination": "511", "body": "Help!"})
    mocked_twilio_client.lookups.v1.phone_numbers.assert_not_called()
    assert response.status_code == 400
    assert response.json() == [
        "number must be in E.164 format, or in local national format of the country "
        "detected: None"
    ]


def test_outbound_sms_to_service_number_from_us_fails(
    outbound_phone_user, mocked_twilio_client
):
    service_num = "811"
    phone_num_service = mocked_twilio_client.lookups.v1.phone_numbers
    phone_num_service.side_effect = None
    phone_num_service.return_value.fetch.side_effect = TwilioRestException(
        uri="/PhoneNumbers/{service_num}",
        msg=(
            "Unable to fetch record:"
            " The requested resource /PhoneNumbers/{service_num} was not found"
        ),
        method="GET",
        status=404,
        code=20404,
    )

    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.post(
        "/api/v1/message/",
        {"destination": service_num, "body": "I'd like to dig!"},
        HTTP_X_CLIENT_REGION="US",
    )
    phone_num_service.assert_called_once_with("+1811")
    assert response.status_code == 400
    assert response.json() == ["Could not get number details for +1811"]


def test_list_messages_fails_with_no_auth():
    response = APIClient().get("/api/v1/messages/")
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_list_messages_fails_without_outbound_phone_flag(mobile_app_user):
    client = APIClient()
    client.force_authenticate(mobile_app_user)
    response = client.get("/api/v1/messages/")
    assert response.status_code == 403
    assert response.json() == {"detail": "Requires outbound_phone waffle flag."}


def test_list_messages_fails_without_phone_mask(phone_user, outbound_phone_flag):
    _make_real_phone(phone_user, verified=True)
    client = APIClient()
    client.force_authenticate(phone_user)
    response = client.get("/api/v1/messages/")
    assert response.status_code == 400
    assert response.json() == {"detail": "Requires a phone mask."}


def test_list_messages_no_data(outbound_phone_user):
    client = APIClient()
    client.force_authenticate(outbound_phone_user)
    response = client.get("/api/v1/messages/")
    assert response.status_code == 200
    assert response.json() == {"inbound_messages": [], "outbound_messages": []}


def test_list_messages(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/")
    assert response.status_code == 200
    assert response.json() == {
        "inbound_messages": [
            {
                "body": "Send Y to confirm appointment",
                "date_sent": "2023-03-01T12:00:00Z",
                "from": "+13015550001",
                "to": _RELAY_NUMBER,
            },
            {
                "body": "Donate $100 to Senator Smith?",
                "date_sent": "2023-03-02T13:00:00Z",
                "from": "+13015550002",
                "to": _RELAY_NUMBER,
            },
        ],
        "outbound_messages": [
            {
                "body": "Y",
                "date_sent": "2023-03-01T12:05:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550001",
            },
            {
                "body": "STOP STOP STOP",
                "date_sent": "2023-03-02T13:05:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550002",
            },
            {
                "body": "U Up?",
                "date_sent": "2023-03-04T20:55:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550004",
            },
        ],
    }


def test_list_messages_only_inbound(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/", {"direction": "inbound"})
    assert response.status_code == 200
    assert response.json() == {
        "inbound_messages": [
            {
                "body": "Send Y to confirm appointment",
                "date_sent": "2023-03-01T12:00:00Z",
                "from": "+13015550001",
                "to": _RELAY_NUMBER,
            },
            {
                "body": "Donate $100 to Senator Smith?",
                "date_sent": "2023-03-02T13:00:00Z",
                "from": "+13015550002",
                "to": _RELAY_NUMBER,
            },
        ],
    }


def test_list_messages_only_outbound(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/", {"direction": "outbound"})
    assert response.status_code == 200
    assert response.json() == {
        "outbound_messages": [
            {
                "body": "Y",
                "date_sent": "2023-03-01T12:05:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550001",
            },
            {
                "body": "STOP STOP STOP",
                "date_sent": "2023-03-02T13:05:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550002",
            },
            {
                "body": "U Up?",
                "date_sent": "2023-03-04T20:55:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550004",
            },
        ],
    }


def test_list_messages_with_contact(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/", {"with": "+13015550001"})
    assert response.status_code == 200
    assert response.json() == {
        "inbound_messages": [
            {
                "body": "Send Y to confirm appointment",
                "date_sent": "2023-03-01T12:00:00Z",
                "from": "+13015550001",
                "to": _RELAY_NUMBER,
            },
        ],
        "outbound_messages": [
            {
                "body": "Y",
                "date_sent": "2023-03-01T12:05:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550001",
            },
        ],
    }


def test_list_messages_with_contact_only_inbound(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get(
        "/api/v1/messages/", {"with": "+13015550001", "direction": "inbound"}
    )
    assert response.status_code == 200
    assert response.json() == {
        "inbound_messages": [
            {
                "body": "Send Y to confirm appointment",
                "date_sent": "2023-03-01T12:00:00Z",
                "from": "+13015550001",
                "to": _RELAY_NUMBER,
            },
        ],
    }


def test_list_messages_with_contact_only_outbound(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get(
        "/api/v1/messages/", {"with": "+13015550001", "direction": "outbound"}
    )
    assert response.status_code == 200
    assert response.json() == {
        "outbound_messages": [
            {
                "body": "Y",
                "date_sent": "2023-03-01T12:05:00Z",
                "from": _RELAY_NUMBER,
                "to": "+13015550001",
            },
        ],
    }


def test_list_messages_voice_only_contact_has_empty_response(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/", {"with": "+13015550003"})
    assert response.status_code == 200
    assert response.json() == {"inbound_messages": [], "outbound_messages": []}


def test_list_messages_fails_with_outbound_only_contact(user_with_sms_activity):
    # TODO: This feels like a bug. The contact is shown in the unfiltered view,
    # but can't be filtered with 'with' because there is no InboundContact
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/", {"with": "+13015550004"})
    assert response.status_code == 400
    assert response.json() == {"with": "No inbound contacts matching the number"}


def test_list_messages_fails_with_invalid_direction(user_with_sms_activity):
    client = APIClient()
    client.force_authenticate(user_with_sms_activity)
    response = client.get("/api/v1/messages/", {"direction": "out"})
    assert response.status_code == 400
    assert response.json() == {
        "direction": "Invalid value, valid values are 'inbound' or 'outbound'"
    }
