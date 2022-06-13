from datetime import datetime, timedelta
import math
import random

from django.apps import apps
from django.contrib.auth.models import User
from django.conf import settings
from django.core.exceptions import BadRequest
from django.db.migrations.recorder import MigrationRecorder
from django.db import models
from django.db.models.signals import post_save
from django.dispatch.dispatcher import receiver
from django.urls import reverse


MAX_MINUTES_TO_VERIFY_REAL_PHONE = 5


def verification_code_default():
    return str(math.floor(random.random()*999999)).zfill(6)


def verification_sent_date_detaul():
    return datetime.now()


class RealPhone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    number = models.CharField(max_length=15)
    verification_code = models.CharField(
        max_length=8, default=verification_code_default
    )
    verification_sent_date = models.DateTimeField(
        blank=True, null=True, db_index=True,
        default=verification_sent_date_detaul
    )
    verified = models.BooleanField(default=False)
    verified_date = models.DateTimeField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["number", "verified"],
                condition=models.Q(verified=True),
                name="unique_verified_number"
            )
        ]

    def save(self, *args, **kwargs):
        # We are not ready to support multiple real phone numbers per user,
        # so raise an exception if this save() would create a second
        # RealPhone record for the user
        other_number_record = RealPhone.objects.filter(
            user=self.user, verified=True
        ).exclude(number=self.number)
        if other_number_record:
            raise BadRequest("RealPhone.save(): Another real number already exists for this user.")

        # delete any expired unverified RealPhone records for this number
        expired_verification_records = RealPhone.objects.filter(
            number=self.number,
            verified=False,
            verification_sent_date__lt=(
                datetime.now() -
                timedelta(0, 60*MAX_MINUTES_TO_VERIFY_REAL_PHONE)
            )
        )
        expired_verification_records.delete()

        # call super save to save into the DB
        return super().save(*args, **kwargs)

        # See realphone_post_save:

    def mark_verified(self):
        self.verified=True
        self.verified_date = datetime.now()
        self.save(force_update=True)
        return self


@receiver(post_save, sender=RealPhone)
def realphone_post_save(sender, instance, created, **kwargs):
    # don't do anything if running migrations
    if type(instance) == MigrationRecorder.Migration:
        return

    if created:
        # only send verification_code when creating new record
        phones_config = apps.get_app_config("phones")
        phones_config.twilio_client.messages.create(
            body=f"Your Firefox Relay verification code is {instance.verification_code}",
            from_=settings.TWILIO_MAIN_NUMBER,
            to=instance.number
        )


class RelayNumber(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    number = models.CharField(max_length=15)
    location = models.CharField(max_length=255)

    def save(self, *args, **kwargs):
        # TODO: check to make sure this user
        # doesn't already have a RelayNumber
        # Before saving into DB provision the number in Twilio
        phones_config = apps.get_app_config("phones")
        client = phones_config.twilio_client
        # Since this will charge the Twilio account, first see if this
        # is running with TEST creds to avoid charges.
        if settings.TWILIO_TEST_ACCOUNT_SID:
            client = phones_config.twilio_test_client
        # TODO: change sms_url to
        # sms_application_sid=settings.TWILIO_SMS_APPLICATION_SID
        # so we have a single sms callback url for all numbers
        incoming_number = (client
            .incoming_phone_numbers.create(
                phone_number=self.number,
                sms_url=settings.TWILIO_SMS_URL
            )
        )
        return super().save(*args, **kwargs)


@receiver(post_save, sender=RelayNumber)
def relaynumber_post_save(sender, instance, created, **kwargs):
    # don't do anything if running migrations
    if type(instance) == MigrationRecorder.Migration:
        return

    if created:
        real_phone = RealPhone.objects.get(user=instance.user)
        # only send welcome vCard when creating new record
        phones_config = apps.get_app_config("phones")
        media_url = settings.SITE_ORIGIN + reverse("vCard", kwargs={"number": instance.number})
        phones_config.twilio_client.messages.create(
            body="Welcome to Relay Phoanz! 🎉 Please add your number to your contacts. This will help you identify your Relay messages and calls.",
            from_=settings.TWILIO_MAIN_NUMBER,
            to=real_phone.number,
            media_url=[media_url],
        )


def suggested_numbers(user):
    existing_number = RelayNumber.objects.filter(user=user)
    if existing_number:
        raise BadRequest("available_numbers: Another RelayNumber already exists for this user.")

    real_phone = RealPhone.objects.filter(user=user, verified=True).first()
    if real_phone is None:
        raise BadRequest("available_numbers: This user hasn't verified a RealPhone yet.")

    real_num = real_phone.number
    phones_config = apps.get_app_config("phones")

    same_prefix_options = []
    # first look for a number with same area code and 3-number prefix
    contains = '%s****' % real_num[:8] if real_num else ''
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        contains=contains,
        limit=10
    )
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # first look for a number with same area code and 2-number prefix
    contains = '%s*%s' % (real_num[:7], real_num[10:]) if real_num else ''
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        contains=contains,
        limit=10
    )
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # first look for a number with same area code and 1-number prefix
    contains = '%s******' % real_num[:6] if real_num else ''
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        contains=contains,
        limit=10
    )
    same_prefix_options.extend(convert_twilio_numbers_to_dict(twilio_nums))

    # look for same number in another area code
    contains = '***%s' % real_num[5:] if real_num else ''
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        contains=contains,
        limit=10
    )
    other_areas_options = convert_twilio_numbers_to_dict(twilio_nums)

    # fall back to any number in the area code
    contains = '%s*******' % real_num[:5] if real_num else ''
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        contains=contains,
        limit=10
    )
    same_area_options = convert_twilio_numbers_to_dict(twilio_nums)

    return {
        'real_num': real_num,
        'same_prefix_options': same_prefix_options,
        'other_areas_options': other_areas_options,
        'same_area_options': same_area_options,
    }


def location_numbers(location):
    phones_config = apps.get_app_config("phones")
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        in_locality=location,
        limit=10
    )
    return convert_twilio_numbers_to_dict(twilio_nums)


def area_code_numbers(area_code):
    phones_config = apps.get_app_config("phones")
    twilio_nums = phones_config.twilio_client.available_phone_numbers('US').local.list(
        area_code=area_code,
        limit=10
    )
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


class Session(models.Model):
    twilio_sid = models.CharField(max_length=34, unique=True, blank=False)
    initiating_proxy_number = models.CharField(max_length=20, blank=False)
    initiating_real_number = models.CharField(max_length=20, blank=False)
    initiating_participant_sid = models.CharField(max_length=34, blank=False)
    status = models.CharField(max_length=20, blank=False)
    expiration = models.DateTimeField(null=True)
