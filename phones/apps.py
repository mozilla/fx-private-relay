import logging

from django.apps import AppConfig, apps
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
        if not isinstance(instance, InstanceResource):
            raise TypeError("instance must be type InstanceResource")
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


def phones_config() -> PhonesConfig:
    phones_config = apps.get_app_config("phones")
    if not isinstance(phones_config, PhonesConfig):
        raise TypeError("phones_config must be type PhonesConfig")
    return phones_config


def twilio_client() -> Client:
    if settings.PHONES_NO_CLIENT_CALLS_IN_TEST:
        raise ValueError(
            "settings.PHONES_NO_CLIENT_CALLS_IN_TEST must be False when "
            "calling twilio_client()"
        )
    return phones_config().twilio_client
