import logging
import os

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

        badwords = []
        # badwords file from:
        # https://www.cs.cmu.edu/~biglou/resources/bad-words.txt
        badwords_file_path = os.path.join(
            settings.BASE_DIR, 'emails', 'badwords.txt'
        )
        with open(badwords_file_path, 'r') as badwords_file:
            for word in badwords_file:
                badwords.append(word.strip())
        self.badwords = badwords

    def ready(self):
        import emails.signals
