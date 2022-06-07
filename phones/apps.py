import logging

from twilio.rest import Client

from django.apps import AppConfig
from django.conf import settings


logger = logging.getLogger("events")


class PhonesConfig(AppConfig):
    name = "phones"

    def __init__(self, app_name, app_module):
        super(PhonesConfig, self).__init__(app_name, app_module)
        try:
            self.twilio_client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            self.twilio_test_client = Client(
                settings.TWILIO_TEST_ACCOUNT_SID,
                settings.TWILIO_TEST_AUTH_TOKEN
            )
        except Exception:
            logger.exception("exception during Twilio connect")
