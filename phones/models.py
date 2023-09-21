from datetime import datetime, timedelta, timezone
from math import floor
from typing import Iterator, Optional
import logging
import phonenumbers
import secrets
import string

from django.apps import apps
from django.contrib.auth.models import User
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import BadRequest, ValidationError
from django.db.migrations.recorder import MigrationRecorder
from django.db import models
from django.db.models.signals import post_save
from django.dispatch.dispatcher import receiver
from django.urls import reverse

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from emails.utils import incr_if_enabled
from phones.iq_utils import send_iq_sms

logger = logging.getLogger("eventsinfo")


MAX_MINUTES_TO_VERIFY_REAL_PHONE = 5
LAST_CONTACT_TYPE_CHOICES = [
    ("call", "call"),
    ("text", "text"),
]


def twilio_client() -> Client:
    from .apps import PhonesConfig

    phones_config = apps.get_app_config("phones")
    assert isinstance(phones_config, PhonesConfig)
    assert not settings.PHONES_NO_CLIENT_CALLS_IN_TEST
    return phones_config.twilio_client


def verification_code_default():
    return str(secrets.randbelow(1000000)).zfill(6)


def verification_sent_date_default():
    return datetime.now(timezone.utc)


def get_expired_unverified_realphone_records(number):
    return RealPhone.objects.filter(
        number=number,
        verified=False,
        verification_sent_date__lt=(
            datetime.now(timezone.utc)
            - timedelta(0, 60 * settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE)
        ),
    )


def get_pending_unverified_realphone_records(number):
    return RealPhone.objects.filter(
        number=number,
        verified=False,
        verification_sent_date__gt=(
            datetime.now(timezone.utc)
            - timedelta(0, 60 * settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE)
        ),
    )


def get_verified_realphone_records(user):
    return RealPhone.objects.filter(user=user, verified=True)


def get_verified_realphone_record(number):
    return RealPhone.objects.filter(number=number, verified=True).first()


def get_valid_realphone_verification_record(user, number, verification_code):
    return RealPhone.objects.filter(
        user=user,
        number=number,
        verification_code=verification_code,
        verification_sent_date__gt=(
            datetime.now(timezone.utc)
            - timedelta(0, 60 * settings.MAX_MINUTES_TO_VERIFY_REAL_PHONE)
        ),
    ).first()


def get_last_text_sender(relay_number: "RelayNumber") -> Optional["InboundContact"]:
    """
    Get the last text sender.

    MPP-2581 introduces a last_text_date column for determining the last sender.
    Before MPP-2581, the last_inbound_date with last_inbound_type=text was used.
    During the transition, look at both methods.
    """
    try:
        latest = InboundContact.objects.filter(
            relay_number=relay_number, last_text_date__isnull=False
        ).latest("last_text_date")
    except InboundContact.DoesNotExist:
        latest = None

    try:
        latest_by_old_method = InboundContact.objects.filter(
            relay_number=relay_number, last_inbound_type="text"
        ).latest("last_inbound_date")
    except InboundContact.DoesNotExist:
        latest_by_old_method = None

    if (latest is None and latest_by_old_method is not None) or (
        latest
        and latest_by_old_method
        and latest != latest_by_old_method
        and latest.last_text_date
        and latest_by_old_method.last_inbound_date > latest.last_text_date
    ):
        # Pre-MPP-2581 server handled the latest text message
        return latest_by_old_method

    return latest


def iq_fmt(e164_number: str) -> str:
    return "1" + str(phonenumbers.parse(e164_number, "E164").national_number)


class RealPhone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    number = models.CharField(max_length=15)
    verification_code = models.CharField(
        max_length=8, default=verification_code_default
    )
    verification_sent_date = models.DateTimeField(
        blank=True, null=True, default=verification_sent_date_default
    )
    verified = models.BooleanField(default=False)
    verified_date = models.DateTimeField(blank=True, null=True)
    country_code = models.CharField(max_length=2, default="US")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["number", "verified"],
                condition=models.Q(verified=True),
                name="unique_verified_number",
            )
        ]

    def save(self, *args, **kwargs):
        # delete any expired unverified RealPhone records for this number
        # note: it doesn't matter which user is trying to create a new
        # RealPhone record - any expired unverified record for the number
        # should be deleted
        expired_verification_records = get_expired_unverified_realphone_records(
            self.number
        )
        expired_verification_records.delete()

        # We are not ready to support multiple real phone numbers per user,
        # so raise an exception if this save() would create a second
        # RealPhone record for the user
        user_verified_number_records = get_verified_realphone_records(self.user)
        for verified_number in user_verified_number_records:
            if (
                verified_number.number == self.number
                and verified_number.verification_code == self.verification_code
            ):
                # User is verifying the same number twice
                return super().save(*args, **kwargs)
            else:
                raise BadRequest("User already has a verified number.")

        # call super save to save into the DB
        # See also: realphone_post_save receiver below
        return super().save(*args, **kwargs)

    def mark_verified(self):
        incr_if_enabled("phones_RealPhone.mark_verified")
        self.verified = True
        self.verified_date = datetime.now(timezone.utc)
        self.save(force_update=True)
        return self


@receiver(post_save, sender=RealPhone)
def realphone_post_save(sender, instance, created, **kwargs):
    # don't do anything if running migrations
    if type(instance) == MigrationRecorder.Migration:
        return

    if created:
        # only send verification_code when creating new record
        incr_if_enabled("phones_RealPhone.post_save_created_send_verification")
        text_body = (
            f"Your Firefox Relay verification code is {instance.verification_code}"
        )
        if settings.PHONES_NO_CLIENT_CALLS_IN_TEST:
            return
        if settings.IQ_FOR_VERIFICATION:
            send_iq_sms(instance.number, settings.IQ_MAIN_NUMBER, text_body)
            return
        client = twilio_client()
        client.messages.create(
            body=text_body,
            from_=settings.TWILIO_MAIN_NUMBER,
            to=instance.number,
        )


def vcard_lookup_key_default():
    return "".join(
        secrets.choice(string.ascii_letters + string.digits) for i in range(6)
    )


class RelayNumber(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    number = models.CharField(max_length=15, db_index=True, unique=True)
    vendor = models.CharField(max_length=15, default="twilio")
    location = models.CharField(max_length=255)
    country_code = models.CharField(max_length=2, default="US")
    vcard_lookup_key = models.CharField(
        max_length=6, default=vcard_lookup_key_default, unique=True
    )
    enabled = models.BooleanField(default=True)
    remaining_seconds = models.IntegerField(
        default=settings.MAX_MINUTES_PER_BILLING_CYCLE * 60
    )
    remaining_texts = models.IntegerField(default=settings.MAX_TEXTS_PER_BILLING_CYCLE)
    calls_forwarded = models.IntegerField(default=0)
    calls_blocked = models.IntegerField(default=0)
    texts_forwarded = models.IntegerField(default=0)
    texts_blocked = models.IntegerField(default=0)

    @property
    def remaining_minutes(self):
        # return a 0 or positive int for remaining minutes
        return floor(max(self.remaining_seconds, 0) / 60)

    @property
    def calls_and_texts_forwarded(self):
        return self.calls_forwarded + self.texts_forwarded

    @property
    def calls_and_texts_blocked(self):
        return self.calls_blocked + self.texts_blocked

    @property
    def storing_phone_log(self) -> bool:
        return bool(self.user.profile.store_phone_log)

    def save(self, *args, **kwargs):
        realphone = get_verified_realphone_records(self.user).first()
        if not realphone:
            raise ValidationError("User does not have a verified real phone.")

        # if this number exists for this user, this is an update call
        existing_numbers = RelayNumber.objects.filter(user=self.user)
        this_number = existing_numbers.filter(number=self.number).first()
        if this_number and this_number.id == self.id:
            return super().save(*args, **kwargs)
        elif existing_numbers.exists():
            raise ValidationError("User can have only one relay number.")

        if RelayNumber.objects.filter(number=self.number).exists():
            raise ValidationError("This number is already claimed.")

        use_twilio = (
            self.vendor == "twilio" and not settings.PHONES_NO_CLIENT_CALLS_IN_TEST
        )

        if use_twilio:
            # Before saving into DB provision the number in Twilio
            phones_config = apps.get_app_config("phones")
            client = twilio_client()

            # Since this will charge the Twilio account, first see if this
            # is running with TEST creds to avoid charges.
            if settings.TWILIO_TEST_ACCOUNT_SID:
                client = phones_config.twilio_test_client

            twilio_incoming_number = client.incoming_phone_numbers.create(
                phone_number=self.number,
                sms_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
                voice_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
            )

        # Assume number was selected through suggested_numbers, so same country
        # as realphone
        self.country_code = realphone.country_code.upper()

        # Add US numbers to the Relay messaging service, so it goes into our
        # US A2P 10DLC campaign
        if use_twilio and self.country_code == "US":
            if settings.TWILIO_MESSAGING_SERVICE_SID:
                register_with_messaging_service(client, twilio_incoming_number.sid)
            else:
                logger.warning(
                    "Skipping Twilio Messaging Service registration, since"
                    " TWILIO_MESSAGING_SERVICE_SID is empty.",
                    extra={"number_sid": twilio_incoming_number.sid},
                )

        return super().save(*args, **kwargs)


class CachedList:
    """A list that is stored in a cache."""

    def __init__(self, cache_key: str) -> None:
        self.cache_key = cache_key
        cache_value = cache.get(self.cache_key, "")
        if cache_value:
            self.data = cache_value.split(",")
        else:
            self.data = []

    def __iter__(self) -> Iterator[str]:
        return (item for item in self.data)

    def append(self, item: str) -> None:
        self.data.append(item)
        self.data.sort()
        cache.set(self.cache_key, ",".join(self.data))


def register_with_messaging_service(client: Client, number_sid: str) -> None:
    """Register a Twilio US phone number with a Messaging Service."""

    assert settings.TWILIO_MESSAGING_SERVICE_SID

    closed_sids = CachedList("twilio_messaging_service_closed")

    for service_sid in settings.TWILIO_MESSAGING_SERVICE_SID:
        if service_sid in closed_sids:
            continue
        try:
            client.messaging.v1.services(service_sid).phone_numbers.create(
                phone_number_sid=number_sid
            )
        except TwilioRestException as err:
            log_extra = {
                "err_msg": err.msg,
                "status": err.status,
                "code": err.code,
                "service_sid": service_sid,
                "number_sid": number_sid,
            }
            if err.status == 409 and err.code == 21710:
                # Log "Phone Number is already in the Messaging Service"
                # https://www.twilio.com/docs/api/errors/21710
                logger.warning("twilio_messaging_service", extra=log_extra)
                return
            elif err.status == 412 and err.code == 21714:
                # Log "Number Pool size limit reached", continue to next service
                # https://www.twilio.com/docs/api/errors/21714
                closed_sids.append(service_sid)
                logger.warning("twilio_messaging_service", extra=log_extra)
            else:
                # Log and re-raise other Twilio errors
                logger.error("twilio_messaging_service", extra=log_extra)
                raise
        else:
            return  # Successfully registered with service

    raise Exception("All services in TWILIO_MESSAGING_SERVICE_SID are full")


@receiver(post_save, sender=RelayNumber)
def relaynumber_post_save(sender, instance, created, **kwargs):
    # don't do anything if running migrations
    if type(instance) == MigrationRecorder.Migration:
        return

    # TODO: if IQ_FOR_NEW_NUMBERS, send welcome message via IQ
    if not instance.vendor == "twilio":
        return

    if created:
        incr_if_enabled("phones_RelayNumber.post_save_created_send_welcome")
        if not settings.PHONES_NO_CLIENT_CALLS_IN_TEST:
            # only send welcome vCard when creating new record
            send_welcome_message(instance.user, instance)


def send_welcome_message(user, relay_number):
    real_phone = RealPhone.objects.get(user=user)
    media_url = settings.SITE_ORIGIN + reverse(
        "vCard", kwargs={"lookup_key": relay_number.vcard_lookup_key}
    )
    client = twilio_client()
    client.messages.create(
        body=(
            "Welcome to Relay phone masking! 🎉 Please add your number to your contacts."
            " This will help you identify your Relay messages and calls."
        ),
        from_=settings.TWILIO_MAIN_NUMBER,
        to=real_phone.number,
        media_url=[media_url],
    )


def last_inbound_date_default():
    return datetime.now(timezone.utc)


class InboundContact(models.Model):
    relay_number = models.ForeignKey(RelayNumber, on_delete=models.CASCADE)
    inbound_number = models.CharField(max_length=15)
    last_inbound_date = models.DateTimeField(default=last_inbound_date_default)
    last_inbound_type = models.CharField(
        max_length=4, choices=LAST_CONTACT_TYPE_CHOICES, default="text"
    )

    num_calls = models.PositiveIntegerField(default=0)
    num_calls_blocked = models.PositiveIntegerField(default=0)
    last_call_date = models.DateTimeField(null=True)

    num_texts = models.PositiveIntegerField(default=0)
    num_texts_blocked = models.PositiveIntegerField(default=0)
    last_text_date = models.DateTimeField(null=True)

    blocked = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["relay_number", "inbound_number"])]


def suggested_numbers(user):
    real_phone = get_verified_realphone_records(user).first()
    if real_phone is None:
        raise BadRequest(
            "available_numbers: This user hasn't verified a RealPhone yet."
        )

    existing_number = RelayNumber.objects.filter(user=user)
    if existing_number:
        raise BadRequest(
            "available_numbers: Another RelayNumber already exists for this user."
        )

    real_num = real_phone.number
    client = twilio_client()
    avail_nums = client.available_phone_numbers(real_phone.country_code)

    # TODO: can we make multiple pattern searches in a single Twilio API request
    same_prefix_options = []
    # look for numbers with same area code and 3-number prefix
    contains = "%s****" % real_num[:8] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for numbers with same area code, 2-number prefix and suffix
    contains = "%s***%s" % (real_num[:7], real_num[10:]) if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for numbers with same area code and 1-number prefix
    contains = "%s******" % real_num[:6] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for same number in other area codes
    contains = "+1***%s" % real_num[5:] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    other_areas_options = convert_twilio_numbers_to_dict(twilio_nums)

    # look for any numbers in the area code
    contains = "%s*******" % real_num[:5] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_area_options = convert_twilio_numbers_to_dict(twilio_nums)

    # look for any available numbers
    twilio_nums = avail_nums.local.list(limit=10)
    random_options = convert_twilio_numbers_to_dict(twilio_nums)

    return {
        "real_num": real_num,
        "same_prefix_options": same_prefix_options,
        "other_areas_options": other_areas_options,
        "same_area_options": same_area_options,
        "random_options": random_options,
    }


def location_numbers(location, country_code="US"):
    client = twilio_client()
    avail_nums = client.available_phone_numbers(country_code)
    twilio_nums = avail_nums.local.list(in_locality=location, limit=10)
    return convert_twilio_numbers_to_dict(twilio_nums)


def area_code_numbers(area_code, country_code="US"):
    client = twilio_client()
    avail_nums = client.available_phone_numbers(country_code)
    twilio_nums = avail_nums.local.list(area_code=area_code, limit=10)
    return convert_twilio_numbers_to_dict(twilio_nums)


def convert_twilio_numbers_to_dict(twilio_numbers):
    """
    To serialize twilio numbers to JSON for the API,
    we need to convert them into dictionaries.
    """
    numbers_as_dicts = []
    for twilio_number in twilio_numbers:
        number = {}
        number["friendly_name"] = twilio_number.friendly_name
        number["iso_country"] = twilio_number.iso_country
        number["locality"] = twilio_number.locality
        number["phone_number"] = twilio_number.phone_number
        number["postal_code"] = twilio_number.postal_code
        number["region"] = twilio_number.region
        numbers_as_dicts.append(number)
    return numbers_as_dicts
