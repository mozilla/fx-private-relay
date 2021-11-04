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
            self.s3_client = boto3.client('s3', region_name=settings.AWS_REGION)
        except Exception:
            logger.exception("exception during SES connect")

        # badwords file from:
        # https://www.cs.cmu.edu/~biglou/resources/bad-words.txt
        self.badwords = self._load_terms('badwords.txt')
        self.blocklist = self._load_terms('blocklist.txt')

    def _load_terms(self, filename):
        terms = []
        terms_file_path = os.path.join(
            settings.BASE_DIR, 'emails', filename
        )
        with open(terms_file_path, 'r') as terms_file:
            for word in terms_file:
                if len(word.strip()) > 0 and word.strip()[0] == "#":
                    continue
                terms.append(word.strip())
        return terms

    def ready(self):
        import emails.signals
