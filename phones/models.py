from datetime import datetime, timedelta, timezone
import secrets
import string

from django.apps import apps
from django.contrib.auth.models import User
from django.conf import settings
from django.core.exceptions import BadRequest, ValidationError
from django.db.migrations.recorder import MigrationRecorder
from django.db import models
from django.db.models.signals import post_save
from django.dispatch.dispatcher import receiver
from django.urls import reverse


MAX_MINUTES_TO_VERIFY_REAL_PHONE = 5
LAST_CONTACT_TYPE_CHOICES = [
    ("call", "call"),
    ("text", "text"),
]


def twilio_client():
    phones_config = apps.get_app_config("phones")
    client = phones_config.twilio_client
    return client


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


def get_last_text_sender(relay_number):
    try:
        return InboundContact.objects.filter(
            relay_number=relay_number, last_inbound_type="text"
        ).latest("last_inbound_date")
    except InboundContact.DoesNotExist:
        return None


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
        client = twilio_client()
        client.messages.create(
            body=f"Your Firefox Relay verification code is {instance.verification_code}",
            from_=settings.TWILIO_MAIN_NUMBER,
            to=instance.number,
        )


def vcard_lookup_key_default():
    return "".join(
        secrets.choice(string.ascii_letters + string.digits) for i in range(6)
    )


class RelayNumber(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    number = models.CharField(max_length=15, db_index=True)
    location = models.CharField(max_length=255)
    vcard_lookup_key = models.CharField(
        max_length=6, default=vcard_lookup_key_default, unique=True
    )
    enabled = models.BooleanField(default=True)
    remaining_minutes = models.IntegerField(
        default=settings.MAX_MINUTES_PER_BILLING_CYCLE
    )
    remaining_texts = models.IntegerField(default=settings.MAX_TEXTS_PER_BILLING_CYCLE)
    calls_forwarded = models.IntegerField(default=0)
    calls_blocked = models.IntegerField(default=0)
    texts_forwarded = models.IntegerField(default=0)
    texts_blocked = models.IntegerField(default=0)

    @property
    def calls_and_texts_forwarded(self):
        return self.calls_forwarded + self.texts_forwarded

    @property
    def calls_and_texts_blocked(self):
        return self.calls_blocked + self.texts_blocked

    def save(self, *args, **kwargs):
        if not get_verified_realphone_records(self.user):
            raise ValidationError("User does not have a verified real phone.")

        # if this number exists for this user, this is an update call
        existing_number = RelayNumber.objects.filter(user=self.user)
        if existing_number:
            return super().save(*args, **kwargs)

        # Before saving into DB provision the number in Twilio
        phones_config = apps.get_app_config("phones")
        client = twilio_client()

        # Since this will charge the Twilio account, first see if this
        # is running with TEST creds to avoid charges.
        if settings.TWILIO_TEST_ACCOUNT_SID:
            client = phones_config.twilio_test_client

        client.incoming_phone_numbers.create(
            phone_number=self.number,
            sms_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
            voice_application_sid=settings.TWILIO_SMS_APPLICATION_SID,
        )
        return super().save(*args, **kwargs)


@receiver(post_save, sender=RelayNumber)
def relaynumber_post_save(sender, instance, created, **kwargs):
    # don't do anything if running migrations
    if type(instance) == MigrationRecorder.Migration:
        return

    if created:
        # only send welcome vCard when creating new record
        send_welcome_message(instance.user, instance)


def send_welcome_message(user, relay_number):
    real_phone = RealPhone.objects.get(user=user)
    media_url = settings.SITE_ORIGIN + reverse(
        "vCard", kwargs={"lookup_key": relay_number.vcard_lookup_key}
    )
    client = twilio_client()
    client.messages.create(
        body="Welcome to Relay phone masking! 🎉 Please add your number to your contacts. This will help you identify your Relay messages and calls.",
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
    num_texts = models.PositiveIntegerField(default=0)
    num_texts_blocked = models.PositiveIntegerField(default=0)
    blocked = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["relay_number", "inbound_number"])]


def suggested_numbers(user):
    real_phone = RealPhone.objects.filter(user=user, verified=True).first()
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
    avail_nums = client.available_phone_numbers("US")

    # TODO: can we make multiple pattern searches in a single Twilio API request
    same_prefix_options = []
    # look for numbers with same area code and 3-number prefix
    contains = "%s****" % real_num[:8] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for numbers with same area code and 2-number prefix
    contains = "%s*%s" % (real_num[:7], real_num[10:]) if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for numbers with same area code and 1-number prefix
    contains = "%s******" % real_num[:6] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for same number in other area codes
    contains = "***%s" % real_num[5:] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    other_areas_options = convert_twilio_numbers_to_dict(twilio_nums)

    # look for any numbers in the area code
    contains = "%s*******" % real_num[:5] if real_num else ""
    twilio_nums = avail_nums.local.list(contains=contains, limit=10)
    same_area_options = convert_twilio_numbers_to_dict(twilio_nums)

    return {
        "real_num": real_num,
        "same_prefix_options": same_prefix_options,
        "other_areas_options": other_areas_options,
        "same_area_options": same_area_options,
    }


def location_numbers(location):
    client = twilio_client()
    avail_nums = client.available_phone_numbers("US")
    twilio_nums = avail_nums.local.list(in_locality=location, limit=10)
    return convert_twilio_numbers_to_dict(twilio_nums)


def area_code_numbers(area_code):
    client = twilio_client()
    avail_nums = client.available_phone_numbers("US")
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
