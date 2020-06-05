from django.contrib.postgres.fields import JSONField
from django.db import models


class Invitations(models.Model):
    fxa_uid = models.CharField(max_length=255, blank=True)
    email = models.EmailField(db_index=True)
    date_added = models.DateTimeField(auto_now_add=True)
    active = models.BooleanField(default=False)
    date_sent = models.DateTimeField(null=True, blank=True)
    date_redeemed = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return 'Invitation for %s' % self.email


class MonitorSubscriber(models.Model):
    class Meta:
        db_table = 'subscribers'
        managed = False

    primary_email = models.CharField(max_length=255)
    fxa_uid = models.CharField(max_length=255)
    waitlists_joined = JSONField()
