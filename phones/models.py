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


@receiver(post_save)
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


class Session(models.Model):
    twilio_sid = models.CharField(max_length=34, unique=True, blank=False)
    initiating_proxy_number = models.CharField(max_length=20, blank=False)
    initiating_real_number = models.CharField(max_length=20, blank=False)
    initiating_participant_sid = models.CharField(max_length=34, blank=False)
    status = models.CharField(max_length=20, blank=False)
    expiration = models.DateTimeField(null=True)
