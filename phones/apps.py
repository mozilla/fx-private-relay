import logging

from twilio.request_validator import RequestValidator
from twilio.rest import Client

from django.apps import AppConfig
from django.conf import settings


logger = logging.getLogger("events")


class PhonesConfig(AppConfig):
    name = "phones"

    def __init__(self, app_name, app_module):
        super(PhonesConfig, self).__init__(app_name, app_module)
        try:
            self._twilio_client = Client(
                settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN
            )
            self._twilio_validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
        except Exception:
            logger.exception("exception creating Twilio client and/or validator")
        if settings.TWILIO_TEST_ACCOUNT_SID:
            try:
                self._twilio_test_client = Client(
                    settings.TWILIO_TEST_ACCOUNT_SID, settings.TWILIO_TEST_AUTH_TOKEN
                )
            except Exception:
                logger.exception("exception creating Twilio test client")

    @property
    def twilio_client(self):
        return self._twilio_client

    @property
    def twilio_test_client(self):
        return self._twilio_test_client

    @property
    def twilio_validator(self):
        return self._twilio_validator
