from datetime import datetime, timedelta, timezone
import pytest
import random
from twilio.rest import Client
from unittest.mock import Mock, patch, call

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import BadRequest, ValidationError

from allauth.socialaccount.models import SocialAccount, SocialToken
from model_bakery import baker

from emails.models import Profile
from phones.models import InboundContact

if settings.PHONES_ENABLED:
    from ..models import (
        RealPhone,
        RelayNumber,
        area_code_numbers,
        get_expired_unverified_realphone_records,
        get_valid_realphone_verification_record,
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
    random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_PHONE.split(","))
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
    try:
        RealPhone.objects.create(user=phone_user, number="+12223335555")
    except BadRequest:
        # make sure RealPhone did not create a message for the second number
        mock_twilio_client.messages.create.assert_called_once()
        return
    pytest.fail("Should have raised BadRequest exception")


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
    mock_twilio_client = mocked_twilio_client
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create

    relay_number = "+19998887777"
    try:
        RelayNumber.objects.create(user=phone_user, number=relay_number)
    except ValidationError:
        mock_twilio_client = mocked_twilio_client
        mock_number_create.assert_not_called()
        mock_messages_create.assert_not_called()
        return


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
    try:
        RelayNumber.objects.create(user=phone_user, number=second_relay_number)
    except ValidationError:
        mock_number_create.assert_not_called()
        mock_messages_create.assert_not_called()
        return


def test_create_relaynumber_creates_twilio_incoming_number_and_sends_welcome(
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


def test_suggested_numbers_bad_request_for_user_without_real_phone(
    phone_user, mocked_twilio_client
):
    try:
        suggested_numbers(phone_user)
    except BadRequest:
        mock_twilio_client = mocked_twilio_client
        mock_twilio_client.available_phone_numbers.assert_not_called()
        return
    pytest.fail("Should have raised BadRequest exception")


def test_suggested_numbers_bad_request_for_user_who_already_has_number(
    phone_user, mocked_twilio_client
):
    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    relay_number = "+19998887777"
    RelayNumber.objects.create(user=phone_user, number=relay_number)
    try:
        suggested_numbers(phone_user)
    except BadRequest:
        mock_twilio_client = mocked_twilio_client
        mock_twilio_client.available_phone_numbers.assert_not_called()
        return
    pytest.fail("Should have raised BadRequest exception")


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
        call(contains="+122233*44", limit=10),
        call(contains="+12223******", limit=10),
        call(contains="***3334444", limit=10),
        call(contains="+1222*******", limit=10),
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
