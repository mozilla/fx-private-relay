import logging

from django.apps import AppConfig
from django.conf import settings
from django.utils.functional import cached_property

from twilio.base.instance_resource import InstanceResource
from twilio.request_validator import RequestValidator
from twilio.rest import Client

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
