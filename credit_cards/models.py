from datetime import datetime
from hashlib import sha256
import random
import string
import uuid

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models

from credit_cards import services as cc_services


credit_cards_config = apps.get_app_config('credit_cards')

class CannotMakeCreditCard(Exception):
    pass


class FundingSource(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token_uuid = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False
    )
    account_name = models.CharField(max_length=64, blank=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_modified_at = models.DateTimeField(auto_now=True, db_index=True)
    last_used_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return self.account_name

    def delete(self, *args, **kwargs):
        # TODO: create hard bounce receipt rule in AWS for the address
        deleted_address = DeletedAddress.objects.create(
            address_hash=sha256(self.address.encode('utf-8')).hexdigest(),
            num_forwarded=self.num_forwarded,
            num_blocked=self.num_blocked,
            num_spam=self.num_spam,
        )
        deleted_address.save()
        profile = Profile.objects.get(user=self.user)
        profile.address_last_deleted = datetime.now()
        profile.num_address_deleted += 1
        profile.save()
        return super(RelayAddress, self).delete(*args, **kwargs)

    def make_credit_card(memo, token_uuid):
        credit_card = cc_services.post_credit_card(
            'SINGLE_USE', token_uuid, memo
        )
        return credit_card

    def fetch_credit_card(token_uuid):
        data = cc_services.get_credit_card()['data']
        credit_cards = []
        for cc in data:
            if cc['funding']['token'] == token_uuid:
                credit_cards.append(cc)
        return credit_cards


    def make_funding_source(
            user, routing_number, account_number, account_name
    ):
        data = cc_services.post_funding_source(
            routing_number, account_number, account_name
        )['data']
        funding_source = FundingSource.objects.create(
            user=user,
            token_uuid=data['token'],
            account_name=account_name
        )
        return funding_source
