from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
import random
import responses
from uuid import uuid4
from unittest.mock import Mock, patch, call

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import BadRequest, ValidationError
from django.test import override_settings

from allauth.socialaccount.models import SocialAccount, SocialToken
from model_bakery import baker
from twilio.base.exceptions import TwilioRestException
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
        iq_fmt,
    )


pytestmark = pytest.mark.skipif(
    not settings.PHONES_ENABLED, reason="PHONES_ENABLED is False"
)


@pytest.fixture(autouse=True)
def test_settings(settings):
    settings.TWILIO_MESSAGING_SERVICE_SID = [f"MG{uuid4().hex}"]
    return settings


@pytest.fixture
def twilio_number_sid():
    """A Twilio Incoming Number ID"""
    return f"PN{uuid4().hex}"


@pytest.fixture(autouse=True)
def mock_twilio_client(twilio_number_sid: str):
    """Mock PhonesConfig with a mock twilio client"""
    with patch(
        "phones.apps.PhonesConfig.twilio_client",
        spec_set=[
            "available_phone_numbers",
            "incoming_phone_numbers",
            "messages",
            "messaging",
        ],
    ) as mock_twilio_client:
        mock_twilio_client.available_phone_numbers = Mock(spec_set=[])
        mock_twilio_client.incoming_phone_numbers = Mock(spec_set=["create"])
        mock_twilio_client.incoming_phone_numbers.create = Mock(
            spec_set=[], return_value=SimpleNamespace(sid=twilio_number_sid)
        )
        mock_twilio_client.messages = Mock(spec_set=["create"])
        mock_twilio_client.messages.create = Mock(spec_set=[])
        mock_twilio_client.messaging = Mock(spec_set=["v1"])
        mock_twilio_client.messaging.v1 = Mock(spec_set=["services"])
        mock_twilio_client.messaging.v1.services = Mock(spec_set=[])
        yield mock_twilio_client


def make_phone_test_user():
    phone_user = baker.make(User)
    phone_user_profile = Profile.objects.get(user=phone_user)
    phone_user_profile.date_subscribed = datetime.now(tz=timezone.utc)
    phone_user_profile.save()
    upgrade_test_user_to_phone(phone_user)
    return phone_user


def upgrade_test_user_to_phone(user):
    random_sub = random.choice(settings.SUBSCRIPTIONS_WITH_PHONE)
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
    return make_phone_test_user()


@pytest.fixture
def django_cache():
    """Return a cleared Django cache as a fixture."""
    cache.clear()
    yield cache
    cache.clear()


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
    assert record is None


def test_create_realphone_creates_twilio_message(phone_user, mock_twilio_client):
    number = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=number)
    mock_twilio_client.messages.create.assert_called_once()
    call_kwargs = mock_twilio_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == number
    assert "verification code" in call_kwargs["body"]


@override_settings(IQ_FOR_VERIFICATION=True)
@responses.activate()
@pytest.mark.skipif(not settings.IQ_ENABLED, reason="IQ_ENABLED is false")
def test_create_realphone_creates_iq_message(phone_user):
    number = "+12223334444"
    iq_number = iq_fmt(number)
    resp = responses.add(
        responses.POST,
        settings.IQ_PUBLISH_MESSAGE_URL,
        status=200,
        match=[
            responses.matchers.json_params_matcher(
                {
                    "to": [iq_number],
                    "from": settings.IQ_MAIN_NUMBER,
                },
                strict_match=False,
            )
        ],
    )

    RealPhone.objects.create(user=phone_user, verified=True, number=number)

    assert resp.call_count == 1


def test_create_second_realphone_for_user_raises_exception(
    phone_user, mock_twilio_client
):
    RealPhone.objects.create(user=phone_user, verified=True, number="+12223334444")
    mock_twilio_client.messages.create.assert_called_once()
    mock_twilio_client.reset_mock()

    with pytest.raises(BadRequest):
        RealPhone.objects.create(user=phone_user, number="+12223335555")
    mock_twilio_client.messages.assert_not_called()


def test_create_realphone_deletes_expired_unverified_records(
    phone_user, mock_twilio_client
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
    phone_user, mock_twilio_client
):
    with pytest.raises(ValidationError) as exc_info:
        RelayNumber.objects.create(user=phone_user, number="+19998887777")
    assert exc_info.value.message == "User does not have a verified real phone."
    mock_twilio_client.messages.create.assert_not_called()
    mock_twilio_client.incoming_phone_numbers.create.assert_not_called()


def test_create_relaynumber_when_user_already_has_one_raises_error(
    phone_user, mock_twilio_client
):
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


def test_create_duplicate_relaynumber_raises_error(phone_user, mock_twilio_client):
    mock_messages_create = mock_twilio_client.messages.create
    mock_number_create = mock_twilio_client.incoming_phone_numbers.create

    real_phone = "+12223334444"
    RealPhone.objects.create(user=phone_user, verified=True, number=real_phone)
    mock_messages_create.assert_called_once()
    mock_messages_create.reset_mock()

    relay_number = "+19998887777"
    RelayNumber.objects.create(user=phone_user, number=relay_number)

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


@pytest.fixture
def real_phone_us(phone_user, mock_twilio_client):
    """Create a US-based RealPhone for phone_user, with a reset twilio_client."""
    real_phone = RealPhone.objects.create(
        user=phone_user,
        number="+12223334444",
        verified=True,
        verification_sent_date=datetime.now(timezone.utc),
    )
    mock_twilio_client.messages.create.assert_called_once()
    mock_twilio_client.messages.create.reset_mock()
    return real_phone


def test_create_relaynumber_creates_twilio_incoming_number_and_sends_welcome(
    phone_user, real_phone_us, mock_twilio_client, settings, twilio_number_sid
):
    """A successful relay phone creation sends a welcome message."""
    relay_number = "+19998887777"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)

    mock_twilio_client.incoming_phone_numbers.create.assert_called_once_with(
        phone_number=relay_number,
        sms_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
        voice_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
    )
    mock_services = mock_twilio_client.messaging.v1.services
    mock_services.assert_called_once_with(settings.TWILIO_MESSAGING_SERVICE_SID[0])
    mock_services.return_value.phone_numbers.create.assert_called_once_with(
        phone_number_sid=twilio_number_sid
    )

    mock_messages_create = mock_twilio_client.messages.create
    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone_us.number
    assert relay_number_obj.vcard_lookup_key in call_kwargs["media_url"][0]


def test_create_relaynumber_already_registered_with_service(
    phone_user, real_phone_us, mock_twilio_client, caplog, settings, twilio_number_sid
):
    """
    It is OK if the relay phone is already registered with a messaging service.

    This is not likely in production, since relay phone acquisition and registration
    is a single step, but can happen when manually moving relay phones between users.
    """
    twilio_service_sid = settings.TWILIO_MESSAGING_SERVICE_SID[0]

    # Twilio responds that the phone number is already registered
    mock_services = mock_twilio_client.messaging.v1.services
    mock_messaging_number_create = mock_services.return_value.phone_numbers.create
    mock_messaging_number_create.side_effect = TwilioRestException(
        uri=f"/Services/{twilio_service_sid}/PhoneNumbers",
        msg=(
            "Unable to create record:"
            " Phone Number or Short Code is already in the Messaging Service."
        ),
        method="POST",
        status=409,
        code=21710,
    )

    # Does not raise exception
    relay_number = "+19998887777"
    RelayNumber.objects.create(user=phone_user, number=relay_number)

    mock_twilio_client.incoming_phone_numbers.create.assert_called_once_with(
        phone_number=relay_number,
        sms_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
        voice_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
    )
    mock_services.assert_called_once_with(twilio_service_sid)
    mock_messaging_number_create.assert_called_once_with(
        phone_number_sid=twilio_number_sid
    )
    mock_twilio_client.messages.create.assert_called_once()
    assert caplog.messages == ["twilio_messaging_service"]
    assert caplog.records[0].code == 21710


def test_create_relaynumber_fail_if_all_services_are_full(
    phone_user, real_phone_us, mock_twilio_client, settings, caplog, twilio_number_sid
):
    """If the Twilio Messaging Service pool is full, an exception is raised."""
    twilio_service_sid = settings.TWILIO_MESSAGING_SERVICE_SID[0]

    # Twilio responds that the pool is full
    mock_services = mock_twilio_client.messaging.v1.services
    mock_messaging_number_create = mock_services.return_value.phone_numbers.create
    mock_messaging_number_create.side_effect = TwilioRestException(
        uri=f"/Services/{twilio_service_sid}/PhoneNumbers",
        msg=("Unable to create record: Number Pool size limit reached"),
        method="POST",
        status=412,
        code=21714,
    )

    # "Pool full" exception is raised
    with pytest.raises(Exception) as exc_info:
        RelayNumber.objects.create(user=phone_user, number="+19998887777")
    assert (
        str(exc_info.value) == "All services in TWILIO_MESSAGING_SERVICE_SID are full"
    )

    mock_messaging_number_create.assert_called_once_with(
        phone_number_sid=twilio_number_sid
    )
    mock_twilio_client.messages.create.assert_not_called()
    assert caplog.messages == ["twilio_messaging_service"]
    assert caplog.records[0].code == 21714


def test_create_relaynumber_no_service(
    phone_user, real_phone_us, mock_twilio_client, settings, caplog
):
    """If no Twilio Messaging Service IDs are defined, registration is skipped."""
    settings.TWILIO_MESSAGING_SERVICE_SID = []

    RelayNumber.objects.create(user=phone_user, number="+19998887777")

    mock_services = mock_twilio_client.messaging.v1.services
    mock_services.return_value.phone_numbers.create.assert_not_called()
    mock_twilio_client.messages.create.assert_called_once()
    assert caplog.messages == [
        "Skipping Twilio Messaging Service registration, since"
        " TWILIO_MESSAGING_SERVICE_SID is empty."
    ]


def test_create_relaynumber_fallback_to_second_service(
    phone_user,
    real_phone_us,
    mock_twilio_client,
    settings,
    django_cache,
    caplog,
    twilio_number_sid,
):
    """The fallback messaging pool if the first is full."""
    twilio_service1_sid = f"MG{uuid4().hex}"
    twilio_service2_sid = f"MG{uuid4().hex}"
    settings.TWILIO_MESSAGING_SERVICE_SID = [twilio_service1_sid, twilio_service2_sid]
    django_cache.set("twilio_messaging_service_closed", "")

    # Twilio responds that pool 1 is full, pool 2 is OK
    mock_services = mock_twilio_client.messaging.v1.services
    mock_messaging_number_create = mock_services.return_value.phone_numbers.create
    mock_messaging_number_create.side_effect = [
        TwilioRestException(
            uri=f"/Services/{twilio_service1_sid}/PhoneNumbers",
            msg=("Unable to create record: Number Pool size limit reached"),
            method="POST",
            status=412,
            code=21714,
        ),
        None,
    ]

    RelayNumber.objects.create(user=phone_user, number="+19998887777")

    mock_services.assert_has_calls(
        [
            call(twilio_service1_sid),
            call().phone_numbers.create(phone_number_sid=twilio_number_sid),
            call(twilio_service2_sid),
            call().phone_numbers.create(phone_number_sid=twilio_number_sid),
        ]
    )
    mock_twilio_client.messages.create.assert_called_once()

    assert django_cache.get("twilio_messaging_service_closed") == twilio_service1_sid
    assert caplog.messages == ["twilio_messaging_service"]
    assert caplog.records[0].code == 21714


def test_create_relaynumber_skip_known_full_service(
    phone_user,
    real_phone_us,
    mock_twilio_client,
    settings,
    django_cache,
    caplog,
    twilio_number_sid,
):
    """If a pool has been marked as full, it is skipped."""
    twilio_service1_sid = f"MG{uuid4().hex}"
    twilio_service2_sid = f"MG{uuid4().hex}"
    settings.TWILIO_MESSAGING_SERVICE_SID = [twilio_service1_sid, twilio_service2_sid]
    django_cache.set("twilio_messaging_service_closed", twilio_service1_sid)

    RelayNumber.objects.create(user=phone_user, number="+19998887777")

    mock_services = mock_twilio_client.messaging.v1.services
    mock_services.assert_called_once_with(twilio_service2_sid)
    mock_services.return_value.phone_numbers.create.assert_called_once_with(
        phone_number_sid=twilio_number_sid
    )
    mock_twilio_client.messages.create.assert_called_once()
    assert django_cache.get("twilio_messaging_service_closed") == twilio_service1_sid
    assert caplog.messages == []


def test_create_relaynumber_other_messaging_error_raised(
    phone_user,
    real_phone_us,
    mock_twilio_client,
    settings,
    caplog,
    django_cache,
    twilio_number_sid,
):
    """If adding to a pool raises a different error, it is skipped."""
    twilio_service_sid = settings.TWILIO_MESSAGING_SERVICE_SID[0]

    # Twilio responds that pool 1 is full, pool 2 is OK
    mock_services = mock_twilio_client.messaging.v1.services
    mock_messaging_number_create = mock_services.return_value.phone_numbers.create
    mock_messaging_number_create.side_effect = TwilioRestException(
        uri=f"/Services/{twilio_service_sid}/PhoneNumbers",
        msg=(
            "Unable to create record:"
            " Phone Number is associated with another Messaging Service"
        ),
        method="POST",
        status=409,
        code=21712,
    )

    with pytest.raises(TwilioRestException):
        RelayNumber.objects.create(user=phone_user, number="+19998887777")

    mock_services.assert_called_once_with(twilio_service_sid)
    mock_messaging_number_create.assert_called_once_with(
        phone_number_sid=twilio_number_sid
    )
    mock_twilio_client.messages.create.assert_not_called()
    assert django_cache.get("twilio_messaging_service_closed") is None
    assert caplog.messages == ["twilio_messaging_service"]
    assert caplog.records[0].code == 21712


@pytest.fixture
def real_phone_ca(phone_user, mock_twilio_client):
    """Create a CA-based RealPhone for phone_user, with a reset twilio_client."""
    real_phone = RealPhone.objects.create(
        user=phone_user,
        number="+14035551234",
        verified=True,
        verification_sent_date=datetime.now(timezone.utc),
        country_code="CA",
    )
    mock_twilio_client.messages.create.assert_called_once()
    mock_twilio_client.messages.create.reset_mock()
    return real_phone


def test_create_relaynumber_canada(
    phone_user, real_phone_ca, mock_twilio_client, twilio_number_sid
):
    relay_number = "+17805551234"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)
    assert relay_number_obj.country_code == "CA"

    mock_number_create = mock_twilio_client.incoming_phone_numbers.create
    mock_number_create.assert_called_once()
    call_kwargs = mock_number_create.call_args.kwargs
    assert call_kwargs["phone_number"] == relay_number
    assert call_kwargs["sms_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID
    assert call_kwargs["voice_application_sid"] == settings.TWILIO_SMS_APPLICATION_SID

    # Omit Canadian numbers for US A2P 10DLC messaging service
    mock_twilio_client.messaging.v1.services.assert_not_called()

    # A welcome message is sent
    mock_messages_create = mock_twilio_client.messages.create
    mock_messages_create.assert_called_once()
    call_kwargs = mock_messages_create.call_args.kwargs
    assert "Welcome" in call_kwargs["body"]
    assert call_kwargs["to"] == real_phone_ca.number
    assert relay_number_obj.vcard_lookup_key in call_kwargs["media_url"][0]


def test_relaynumber_remaining_minutes_returns_properly_formats_remaining_seconds(
    phone_user, real_phone_us, mock_twilio_client
):
    relay_number = "+13045551234"
    relay_number_obj = RelayNumber.objects.create(user=phone_user, number=relay_number)

    # Freshly created RelayNumber should have 3000 seconds => 50 minutes
    assert relay_number_obj.remaining_minutes == 50

    # After receiving calls remaining_minutes property should return the rounded down
    # to a positive integer
    relay_number_obj.remaining_seconds = 522
    relay_number_obj.save()
    assert relay_number_obj.remaining_minutes == 8

    # If more call time is spent than alotted (negative remaining_seconds),
    # the remaining_minutes property should return zero
    relay_number_obj.remaining_seconds = -522
    relay_number_obj.save()
    assert relay_number_obj.remaining_minutes == 0


def test_suggested_numbers_bad_request_for_user_without_real_phone(
    phone_user, mock_twilio_client
):
    with pytest.raises(BadRequest):
        suggested_numbers(phone_user)
    mock_twilio_client.available_phone_numbers.assert_not_called()


def test_suggested_numbers_bad_request_for_user_who_already_has_number(
    phone_user, real_phone_us, mock_twilio_client
):
    RelayNumber.objects.create(user=phone_user, number="+19998887777")
    with pytest.raises(BadRequest):
        suggested_numbers(phone_user)
    mock_twilio_client.available_phone_numbers.assert_not_called()


def test_suggested_numbers(phone_user, real_phone_us, mock_twilio_client):
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


def test_suggested_numbers_ca(phone_user, mock_twilio_client):
    real_phone = "+14035551234"
    RealPhone.objects.create(
        user=phone_user, verified=True, number=real_phone, country_code="CA"
    )
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


def test_location_numbers(mock_twilio_client):
    mock_list = Mock(return_value=[Mock() for i in range(5)])
    mock_twilio_client.available_phone_numbers = Mock(
        return_value=(Mock(local=Mock(list=mock_list)))
    )

    location_numbers("Miami, FL")

    available_numbers_calls = mock_twilio_client.available_phone_numbers.call_args_list
    assert available_numbers_calls == [call("US")]
    assert mock_list.call_args_list == [call(in_locality="Miami, FL", limit=10)]


def test_area_code_numbers(mock_twilio_client):
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

    assert get_last_text_sender(relay_number) is None


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
