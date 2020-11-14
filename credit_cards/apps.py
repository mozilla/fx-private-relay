import logging
import os

from django.apps import AppConfig
from django.conf import settings


logger = logging.getLogger('events')


class CreditCardsConfig(AppConfig):
    name = 'credit_cards'

    def __init__(self, app_name, app_module):
        self.PRIVACY_TOKEN = settings.PRIVACY_TOKEN
        super(CreditCardsConfig, self).__init__(app_name, app_module)

    # def ready(self):
    #     import emails.signals
