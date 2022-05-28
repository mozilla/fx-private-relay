from django.contrib.auth.models import User
from django.db import models


class RealPhone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    number = models.CharField(max_length=15, unique=True)
    verification_code = models.CharField(max_length=8)
    verified = models.BooleanField(default=False)
    verified_date = models.DateTimeField()


class Session(models.Model):
    twilio_sid = models.CharField(max_length=34, unique=True, blank=False)
    initiating_proxy_number = models.CharField(max_length=20, blank=False)
    initiating_real_number = models.CharField(max_length=20, blank=False)
    initiating_participant_sid = models.CharField(max_length=34, blank=False)
    status = models.CharField(max_length=20, blank=False)
    expiration = models.DateTimeField(null=True)
