from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
import random
from unittest.mock import Mock, patch, call

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import BadRequest, ValidationError

from allauth.socialaccount.models import SocialAccount, SocialToken
from model_bakery import baker
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from emails.models import Profile

if settings.PHONES_ENABLED:
    from ..models import (
        InboundContact,
        RealPhone,
        RelayNumber,
        area_code_numbers,
        get_expired_unverified_realphone_records,
        get_valid_realphone_verification_record,
        get_last_text_sender,
        location_numbers,
        suggested_numbers,
    )


pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


@pytest.fixture(autouse=True)
def mocked_twilio_client():
    """
    Mock PhonesConfig with a mock twilio client
    """
    with patch(
        "phones.apps.PhonesConfig.twilio_client", spec_set=Client
    ) as mock_twilio_client:
        yield mock_twilio_client


def make_phone_test_user():
    phone_user = baker.make(User)
    phone_user_profile = Profile.objects.get(user=phone_user)
    phone_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    phone_user_profile.save()
    upgrade_test_user_to_phone(phone_user)
    return phone_user


def upgrade_test_user_to_phone(user):
    random_sub = random.choice(
        list(filter(None, settings.SUBSCRIPTIONS_WITH_PHONE.split(",")))
    )
    account = baker.make(
        SocialAccount,
        user=user,
        provider="fxa",
        extra_data={"avatar": "avatar.png", "subscriptions": [random_sub]},
    )
    baker.make(
        SocialToken,
        account=account,
        expires_at=datetime.now(timezone.utc) + timedelta(1),
    )
    return user


@pytest.fixture(autouse=True)
def phone_user(db):
    yield make_phone_test_user()


def test_get_valid_realphone_verification_record_returns_object(phone_user):
    number = "+12223334444"
    real_phone = RealPhone.objects.create(
        user=phone_user,
        number=number,
        verification_sent_date=datetime.now(timezone.utc),
    )
    record = get_valid_realphone_verification_record(
        phone_user, number, real_phone.verification_code
    )
    assert record.user == phone_user
    assert record.number == number


def test_get_valid_realphone_verification_record_returns_none(phone_user):
    number = "+12223334444"
    real_phone = RealPhone.objects.create(
        user=phone_user,
        number=number,
        verification_sent_date=(
            datetime.now(timezone.utc)
            - timedelta(0, 60 * settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE + 1)
        ),
    )
    record = get_valid_realphone_verification_record(
        phone_user, number, real_phone.verification_code
    )
    assert record == None


def test_create_realphone_creates_twilio_message(phone_user, mocked_twilio_client):
    number = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=number)
    mock_twilio_client = mocked_twilio_client
    mock_twilio_client.messages.create.assert_called_once()
    call_kwargs = mock_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == number
    assert "verification code" in call_kwargs["body"]


def test_create_second_realphone_for_user_raises_exception(
    phone_user, mocked_twilio_client
):
    RealPhone.objects.create(user=phone_user, verified=True, number="+12223334444")
    mock_twilio_client = mocked_twilio_client
    mock_twilio_client.messages.create.assert_called_once()
    mock_twilio_client.reset_mock()

    with pytest.raises(BadRequest):
        RealPhone.objects.create(user=phone_user, number="+12223335555")
    mock_twilio_client.messages.assert_not_called()


def test_create_realphone_deletes_expired_unverified_records(
    phone_user, mocked_twilio_client
):
    # create an expired unverified record
    number = "+12223334444"
    RealPhone.objects.create(
        user=phone_user,
        number=number,
        verified=False,
        verification_sent_date=(
            datetime.now(timezone.utc)
            - timedelta(0, 60 * settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE + 1)
        ),
    )
    expired_verification_records = get_expired_unverified_realphone_records(number)
    assert len(expired_verification_records) >= 1
    mock_twilio_client = mocked_twilio_client
    mock_twilio_client.messages.create.assert_called_once()

    # now try to create the new record
    RealPhone.objects.create(user=baker.make(User), number=number)
    expired_verification_records = get_expired_unverified_realphone_records(number)
    assert len(expired_verification_records) == 0
    mock_twilio_client.messages.create.assert_called()


def test_mark_realphone_verified_sets_verified_and_date(phone_user):
    real_phone = RealPhone.objects.create(user=phone_user, verified=False)
    real_phone.mark_verified()
    assert real_phone.verified
    assert real_phone.verified_date


def test_create_relaynumber_without_realphone_raises_error(
    phone_user, mocked_twilio_client
):
    with pytest.raises(ValidationError) as exc_info:
        RelayNumber.objects.create(user=phone_user, number="+19998887777")
    assert exc_info.value.message == "User does not have a verified real phone."
    mocked_twilio_client.messages.create.assert_not_called()
    mocked_twilio_client.incoming_phone_numbers.create.assert_not_called()


def test_create_relaynumber_when_user_already_has_one_raises_error(
    phone_user, mocked_twilio_client
):
    mock_twilio_client = mocked_twilio_client
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create

    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    relay_number = "+19998887777"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)

    mock_number_create.assert_called_once()
    call_kwargs = mock_number_create.call_args.kwargs
    assert call_kwargs["phone_number"] == relay_number
    assert call_kwargs["sms_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID
    assert call_kwargs["voice_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID

    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone
    assert relay_number_obj.vcard_lookup_key in call_kwargs["media_url"][0]

    mock_number_create.reset_mock()
    mock_messages_create.reset_mock()
    second_relay_number = "+14445556666"
    with pytest.raises(ValidationError) as exc_info:
        RelayNumber.objects.create(user=phone_user, number=second_relay_number)
    assert exc_info.value.message == "User can have only one relay number."
    mock_number_create.assert_not_called()
    mock_messages_create.assert_not_called()

    # Creating RelayNumber with same number is also an error
    with pytest.raises(ValidationError) as exc_info:
        RelayNumber.objects.create(user=phone_user, number=relay_number)
    assert exc_info.value.message == "User can have only one relay number."
    mock_number_create.assert_not_called()
    mock_messages_create.assert_not_called()


def test_create_duplicate_relaynumber_raises_error(phone_user, mocked_twilio_client):
    mock_twilio_client = mocked_twilio_client
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create

    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    relay_number = "+19998887777"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)

    mock_number_create.assert_called_once()
    call_kwargs = mock_number_create.call_args.kwargs
    assert call_kwargs["phone_number"] == relay_number
    assert call_kwargs["sms_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID
    assert call_kwargs["voice_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID

    mock_messages_create.assert_called_once()
    mock_number_create.reset_mock()
    mock_messages_create.reset_mock()

    second_user = make_phone_test_user()
    second_phone = "+15553334444"
    RealPhone.objects.create(user=second_user, verified=True, number=second_phone)
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    with pytest.raises(ValidationError) as exc_info:
        RelayNumber.objects.create(user=second_user, number=relay_number)
    assert exc_info.value.message == "This number is already claimed."
    mock_number_create.assert_not_called()
    mock_messages_create.assert_not_called()


def test_create_relaynumber_creates_twilio_incoming_number_and_sends_welcome(
    phone_user, mocked_twilio_client
):
    twilio_incoming_number_sid = "PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    mock_twilio_client = mocked_twilio_client
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create
    mock_number_create.return_value = SimpleNamespace(sid=twilio_incoming_number_sid)
    mock_services = mock_twilio_client.messaging.v1.services

    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    relay_number = "+19998887777"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)

    mock_number_create.assert_called_once()
    call_kwargs = mock_number_create.call_args.kwargs
    assert call_kwargs["phone_number"] == relay_number
    assert call_kwargs["sms_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID
    assert call_kwargs["voice_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID

    mock_services.assert_called_once()
    call_args = mock_services.call_args
    assert call_args[0][0] == settings.TWILIO_MESSAGING_SERVICE_SID
    mock_messaging_number_create = (
        mock_twilio_client.messaging.v1.services().phone_numbers.create
    )
    mock_messaging_number_create.assert_called_once()
    call_kwargs = mock_messaging_number_create.call_args.kwargs
    assert call_kwargs["phone_number_sid"] == twilio_incoming_number_sid

    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone
    assert relay_number_obj.vcard_lookup_key in call_kwargs["media_url"][0]


def test_create_relaynumber_already_registered_with_service(
    phone_user, mocked_twilio_client
):
    twilio_incoming_number_sid = "PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    mock_twilio_client = mocked_twilio_client
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create
    mock_number_create.return_value = SimpleNamespace(sid=twilio_incoming_number_sid)
    mock_services = mock_twilio_client.messaging.v1.services
    mock_messaging_number_create = mock_services.return_value.phone_numbers.create

    # Twilio responds that the phone number is already registered
    mock_messaging_number_create.side_effect = TwilioRestException(
        uri=f"/Services/{settings.TWILIO_MESSAGING_SERVICE_SID}/PhoneNumbers",
        msg=(
            "Unable to create record:"
            " Phone Number or Short Code is already in the Messaging Service."
        ),
        method="POST",
        status=409,
        code=21710,
    )

    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    relay_number = "+19998887777"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)

    mock_number_create.assert_called_once()
    call_kwargs = mock_number_create.call_args.kwargs
    assert call_kwargs["phone_number"] == relay_number
    assert call_kwargs["sms_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID
    assert call_kwargs["voice_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID

    mock_services.assert_called_once()
    call_args = mock_services.call_args
    assert call_args[0][0] == settings.TWILIO_MESSAGING_SERVICE_SID
    mock_messaging_number_create.assert_called_once()
    call_kwargs = mock_messaging_number_create.call_args.kwargs
    assert call_kwargs["phone_number_sid"] == twilio_incoming_number_sid

    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone
    assert relay_number_obj.vcard_lookup_key in call_kwargs["media_url"][0]


def test_create_relaynumber_canada(phone_user, mocked_twilio_client):
    twilio_incoming_number_sid = "PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    mock_twilio_client = mocked_twilio_client
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create
    mock_number_create.return_value = SimpleNamespace(sid=twilio_incoming_number_sid)
    mock_services = mock_twilio_client.messaging.v1.services

    real_phone = "+14035551234"
    RealPhone.objects.create(
        user=phone_user, verified=True, number=real_phone, country_code="CA"
    )
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    relay_number = "+17805551234"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)
    assert relay_number_obj.country_code == "CA"

    mock_number_create.assert_called_once()
    call_kwargs = mock_number_create.call_args.kwargs
    assert call_kwargs["phone_number"] == relay_number
    assert call_kwargs["sms_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID
    assert call_kwargs["voice_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID

    # Omit Canadian numbers for US A2P 10DLC messaging service
    mock_services.assert_not_called()

    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone
    assert relay_number_obj.vcard_lookup_key in call_kwargs["media_url"][0]


def test_relaynumber_remaining_minutes_returns_properly_formats_remaining_seconds(
    phone_user, mocked_twilio_client
):
    twilio_incoming_number_sid = "PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    mock_twilio_client = mocked_twilio_client
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create
    mock_number_create.return_value = SimpleNamespace(sid=twilio_incoming_number_sid)

    real_phone = "+14035551234"
    RealPhone.objects.create(
        user=phone_user, verified=True, number=real_phone, country_code="CA"
    )

    relay_number = "+17805551234"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)
    assert relay_number_obj.country_code == "CA"
    # Freshly created RelayNumber should have 3000 seconds => 50 minutes
    assert relay_number_obj.remaining_minutes == 50

    # After receiving calls remaining_minutes property should return the rounded down positive integer
    relay_number_obj.remaining_seconds = 522
    relay_number_obj.save()
    assert relay_number_obj.remaining_minutes == 8

    # If more call time is spent than alotted (negative remaining_seconds),
    # the remaining_minutes property should return zero
    relay_number_obj.remaining_seconds = -522
    relay_number_obj.save()
    assert relay_number_obj.remaining_minutes == 0


def test_suggested_numbers_bad_request_for_user_without_real_phone(
    phone_user, mocked_twilio_client
):
    with pytest.raises(BadRequest):
        suggested_numbers(phone_user)
    mocked_twilio_client.available_phone_numbers.assert_not_called()


def test_suggested_numbers_bad_request_for_user_who_already_has_number(
    phone_user, mocked_twilio_client
):
    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    relay_number = "+19998887777"
    RelayNumber.objects.create(user=phone_user, number=relay_number)
    with pytest.raises(BadRequest):
        suggested_numbers(phone_user)
    mocked_twilio_client.available_phone_numbers.assert_not_called()


def test_suggested_numbers(phone_user, mocked_twilio_client):
    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    mock_twilio_client = mocked_twilio_client
    mock_list = Mock(return_value=[Mock() for i in range(5)])
    mock_twilio_client.available_phone_numbers = Mock(
        return_value=Mock(local=Mock(list=mock_list))
    )

    suggested_numbers(phone_user)
    available_numbers_calls = mock_twilio_client.available_phone_numbers.call_args_list
    assert available_numbers_calls == [call("US")]
    assert mock_list.call_args_list == [
        call(contains="+1222333****", limit=10),
        call(contains="+122233***44", limit=10),
        call(contains="+12223******", limit=10),
        call(contains="+1***3334444", limit=10),
        call(contains="+1222*******", limit=10),
        call(limit=10),
    ]


def test_suggested_numbers_ca(phone_user, mocked_twilio_client):
    real_phone = "+14035551234"
    RealPhone.objects.create(
        user=phone_user, verified=True, number=real_phone, country_code="CA"
    )
    mock_twilio_client = mocked_twilio_client
    mock_list = Mock(return_value=[Mock() for i in range(5)])
    mock_twilio_client.available_phone_numbers = Mock(
        return_value=Mock(local=Mock(list=mock_list))
    )

    suggested_numbers(phone_user)
    available_numbers_calls = mock_twilio_client.available_phone_numbers.call_args_list
    assert available_numbers_calls == [call("CA")]
    assert mock_list.call_args_list == [
        call(contains="+1403555****", limit=10),
        call(contains="+140355***34", limit=10),
        call(contains="+14035******", limit=10),
        call(contains="+1***5551234", limit=10),
        call(contains="+1403*******", limit=10),
        call(limit=10),
    ]


def test_location_numbers(mocked_twilio_client):
    mock_twilio_client = mocked_twilio_client
    mock_list = Mock(return_value=[Mock() for i in range(5)])
    mock_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )

    location_numbers("Miami, FL")

    available_numbers_calls = mock_twilio_client.available_phone_numbers.call_args_list
    assert available_numbers_calls == [call("US")]
    assert mock_list.call_args_list == [call(in_locality="Miami, FL", limit=10)]


def test_area_code_numbers(mocked_twilio_client):
    mock_twilio_client = mocked_twilio_client
    mock_list = Mock(return_value=[Mock() for i in range(5)])
    mock_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )

    area_code_numbers("918")

    available_numbers_calls = mock_twilio_client.available_phone_numbers.call_args_list
    assert available_numbers_calls == [call("US")]
    assert mock_list.call_args_list == [call(area_code="918", limit=10)]


def test_save_store_phone_log_no_relay_number_does_nothing():
    user = make_phone_test_user()
    profile = Profile.objects.get(user=user)
    profile.store_phone_log = True
    profile.save()

    profile.refresh_from_db()
    assert profile.store_phone_log

    profile.store_phone_log = False
    profile.save()
    assert not profile.store_phone_log


def test_save_store_phone_log_true_doesnt_delete_data():
    user = make_phone_test_user()
    profile = Profile.objects.get(user=user)
    baker.make(RealPhone, user=user, verified=True)
    relay_number = baker.make(RelayNumber, user=user)
    inbound_contact = baker.make(InboundContact, relay_number=relay_number)
    profile.store_phone_log = True
    profile.save()

    inbound_contact.refresh_from_db()
    assert inbound_contact


def test_save_store_phone_log_false_deletes_data():
    user = make_phone_test_user()
    profile = Profile.objects.get(user=user)
    baker.make(RealPhone, user=user, verified=True)
    relay_number = baker.make(RelayNumber, user=user)
    inbound_contact = baker.make(InboundContact, relay_number=relay_number)
    profile.store_phone_log = False
    profile.save()

    with pytest.raises(InboundContact.DoesNotExist):
        inbound_contact.refresh_from_db()


def test_get_last_text_sender_returning_None():
    user = make_phone_test_user()
    baker.make(RealPhone, user=user, verified=True)
    relay_number = baker.make(RelayNumber, user=user)

    assert get_last_text_sender(relay_number) == None


def test_get_last_text_sender_returning_one():
    user = make_phone_test_user()
    baker.make(RealPhone, user=user, verified=True)
    relay_number = baker.make(RelayNumber, user=user)
    inbound_contact = baker.make(
        InboundContact, relay_number=relay_number, last_inbound_type="text"
    )

    assert get_last_text_sender(relay_number) == inbound_contact


def test_get_last_text_sender_lots_of_inbound_returns_one():
    user = make_phone_test_user()
    baker.make(RealPhone, user=user, verified=True)
    relay_number = baker.make(RelayNumber, user=user)
    baker.make(
        InboundContact,
        relay_number=relay_number,
        last_inbound_type="call",
        last_inbound_date=datetime.now(timezone.utc) - timedelta(days=4),
    )
    baker.make(
        InboundContact,
        relay_number=relay_number,
        last_inbound_type="text",
        last_inbound_date=datetime.now(timezone.utc) - timedelta(days=3),
    )
    baker.make(
        InboundContact,
        relay_number=relay_number,
        last_inbound_type="call",
        last_inbound_date=datetime.now(timezone.utc) - timedelta(days=2),
    )
    baker.make(
        InboundContact,
        relay_number=relay_number,
        last_inbound_type="text",
        last_inbound_date=datetime.now(timezone.utc) - timedelta(days=1),
    )
    inbound_contact = baker.make(
        InboundContact,
        relay_number=relay_number,
        last_inbound_type="text",
        last_inbound_date=datetime.now(timezone.utc),
    )

    assert get_last_text_sender(relay_number) == inbound_contact
