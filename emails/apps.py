import logging

import boto3

from django.apps import AppConfig
from django.conf import settings


logger = logging.getLogger('events')


class EmailsConfig(AppConfig):
    name = 'emails'

    def __init__(self, app_name, app_module):
        super(EmailsConfig, self).__init__(app_name, app_module)
        try:
            self.ses_client = boto3.client(
                'ses', region_name=settings.AWS_REGION
            )
        except Exception:
            logger.exception("exception during SES connect")

    def ready(self):
        import emails.signals
