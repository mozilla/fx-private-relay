from django.db import models


class Session(models.Model):
    twilio_sid = models.CharField(max_length=34, unique=True, blank=False)
    initiating_proxy_number = models.CharField(max_length=20, blank=False)
    initiating_real_number = models.CharField(max_length=20, blank=False)
    initiating_participant_sid = models.CharField(max_length=34, blank=False)
    status = models.CharField(max_length=20, blank=False)
    expiration = models.DateTimeField(null=True)
