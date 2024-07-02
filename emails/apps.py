import logging
import os
from typing import NamedTuple

from django.apps import AppConfig, apps
from django.conf import settings
from django.utils.functional import cached_property

import boto3
from botocore.config import Config
from mypy_boto3_ses.client import SESClient

logger = logging.getLogger("events")


# Bad words are split into short and long words
class BadWords(NamedTuple):
    # Short words are 4 or less characters. A hit is an exact match to a short word
    short: set[str]
    # Long words are 5 or more characters. A hit contains a long word.
    long: list[str]


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
        super().__init__(app_name, app_module)

        # badwords file from:
        # https://www.cs.cmu.edu/~biglou/resources/bad-words.txt
        # Using `.text` extension because of
        # https://github.com/dependabot/dependabot-core/issues/1657
        _badwords = self._load_terms("badwords.text")
        self.badwords = BadWords(
            short=set(word for word in _badwords if len(word) <= 4),
            long=sorted(set(word for word in _badwords if len(word) > 4)),
        )
        self.blocklist = set(self._load_terms("blocklist.text"))

    def _load_terms(self, filename: str) -> list[str]:
        """Load a list of terms from a file."""
        terms = []
        terms_file_path = os.path.join(settings.BASE_DIR, "emails", filename)
        with open(terms_file_path) as terms_file:
            for raw_word in terms_file:
                word = raw_word.strip()
                if not word or (len(word) > 0 and word[0] == "#"):
                    continue
                terms.append(word)
        return terms


def emails_config() -> EmailsConfig:
    emails_config = apps.get_app_config("emails")
    if not isinstance(emails_config, EmailsConfig):
        raise TypeError("emails_config must be type EmailsConfig")
    return emails_config


def ses_client() -> SESClient | None:
    return emails_config().ses_client


def s3_client():
    return emails_config().s3_client
