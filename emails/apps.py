import logging
import os

from django.apps import AppConfig
from django.conf import settings
from django.utils.functional import cached_property

import boto3
from botocore.config import Config
from mypy_boto3_ses.client import SESClient

logger = logging.getLogger("events")


class EmailsConfig(AppConfig):
    name = "emails"

    @cached_property
    def ses_client(self) -> SESClient | None:
        try:
            return boto3.client("ses", region_name=settings.AWS_REGION)
        except Exception:
            logger.exception("exception during SES connect")
            return None

    @cached_property
    def s3_client(self):
        try:
            s3_config = Config(
                region_name=settings.AWS_REGION,
                retries={
                    # max_attempts includes the initial attempt to get the email
                    # so this does not retry with backoff, to avoid timeouts
                    "max_attempts": 1,
                    "mode": "standard",
                },
            )
            return boto3.client("s3", config=s3_config)
        except Exception:
            logger.exception("exception during S3 connect")

    def __init__(self, app_name, app_module):
        super(EmailsConfig, self).__init__(app_name, app_module)

        # badwords file from:
        # https://www.cs.cmu.edu/~biglou/resources/bad-words.txt
        # Using `.text` extension because of
        # https://github.com/dependabot/dependabot-core/issues/1657
        self.badwords = self._load_terms("badwords.text")
        self.blocklist = self._load_terms("blocklist.text")

    def _load_terms(self, filename):
        terms = []
        terms_file_path = os.path.join(settings.BASE_DIR, "emails", filename)
        with open(terms_file_path, "r") as terms_file:
            for word in terms_file:
                if len(word.strip()) > 0 and word.strip()[0] == "#":
                    continue
                terms.append(word.strip())
        return terms

    def ready(self):
        import emails.signals  # noqa: F401 (imported but unused warning)
