import json
import logging

import requests
from twilio.base.instance_resource import InstanceResource
from twilio.request_validator import RequestValidator
from twilio.rest import Client

from django.apps import AppConfig
from django.conf import settings
from django.utils.functional import cached_property

from rest_framework import exceptions


logger = logging.getLogger("events")


class PhonesConfig(AppConfig):
    name = "phones"

    @cached_property
    def twilio_client(self) -> Client:
        if not all((settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)):
            raise Exception("Must define TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN")
        return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    @cached_property
    def twiml_app(self) -> InstanceResource:
        if not settings.TWILIO_SMS_APPLICATION_SID:
            raise Exception("Must define TWILIO_SMS_APPLICATION_SID")
        instance = self.twilio_client.applications(
            settings.TWILIO_SMS_APPLICATION_SID
        ).fetch()
        assert isinstance(instance, InstanceResource)
        return instance

    @cached_property
    def twilio_test_client(self) -> Client:
        if not all((settings.TWILIO_TEST_ACCOUNT_SID, settings.TWILIO_TEST_AUTH_TOKEN)):
            raise Exception(
                "Must define TWILIO_TEST_ACCOUNT_SID, TWILIO_TEST_AUTH_TOKEN"
            )
        return Client(settings.TWILIO_TEST_ACCOUNT_SID, settings.TWILIO_TEST_AUTH_TOKEN)

    @cached_property
    def twilio_validator(self) -> RequestValidator:
        if not settings.TWILIO_AUTH_TOKEN:
            raise Exception("Must define TWILIO_AUTH_TOKEN")
        return RequestValidator(settings.TWILIO_AUTH_TOKEN)

    def send_iq_sms(self, to_num: str, from_num: str, text: str) -> None:
        iq_formatted_to_num = to_num.replace("+", "")
        iq_formatted_from_num = from_num.replace("+", "")
        json_body = {
            "from": iq_formatted_from_num,
            "to": [iq_formatted_to_num],
            "text": text,
        }
        resp = requests.post(
            "https://messagebroker.inteliquent.com/msgbroker/rest/publishMessages",
            headers={"Authorization": f"Bearer {settings.IQ_OUTBOUND_API_KEY}"},
            json=json_body,
        )
        if resp.status_code < 200 or resp.status_code > 299:
            raise exceptions.ValidationError(json.loads(resp.content.decode()))
