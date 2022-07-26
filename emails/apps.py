from __future__ import annotations
import json
import logging
import os
import requests
from types import ModuleType
from typing import Final, Optional, TYPE_CHECKING

import boto3
from botocore.config import Config
from mypy_boto3_s3.client import S3Client
from mypy_boto3_ses.client import SESClient

from django.apps import AppConfig
from django.conf import settings

if TYPE_CHECKING:  # pragma: nocover
    from botocore.client import BaseClient


logger = logging.getLogger("events")


def get_trackers(category="Email"):
    # email tracker lists from shavar-prod-list as per agreed use under license:
    resp = requests.get(
        "https://raw.githubusercontent.com/mozilla-services/shavar-prod-lists/master/disconnect-blacklist.json"
    )
    json_resp = resp.json()
    formatted_trackers = json_resp["categories"][category]
    trackers = []
    for entity in formatted_trackers:
        for _, resources in entity.items():
            for _, domains in resources.items():
                trackers.extend(domains)
    return trackers


class EmailsConfig(AppConfig):
    name: Final = "emails"
    _ses_client: SESClient
    s3_client: S3Client
    badwords: list[str]
    blocklist: list[str]

    def __init__(self, app_name: str, app_module: Optional[ModuleType]):
        super(EmailsConfig, self).__init__(app_name, app_module)
        try:
            self._ses_client = boto3.client("ses", region_name=settings.AWS_REGION)
            s3_config = Config(
                region_name=settings.AWS_REGION,
                retries={
                    "max_attempts": 1,  # this includes the initial attempt to get the email
                    "mode": "standard",
                },
            )
            self.s3_client = boto3.client("s3", config=s3_config)
        except Exception:
            logger.exception("exception during SES connect")

        # badwords file from:
        # https://www.cs.cmu.edu/~biglou/resources/bad-words.txt
        self.badwords = self._load_terms("badwords.txt")
        self.blocklist = self._load_terms("blocklist.txt")

        # TODO: fix the relative path issue on CircleCI to use the commented code
        # level_one_trackers = get_trackers()
        # with open("emails/tracker_lists/level-one-tracker.json", "w+") as f:
        #     json.dump(level_one_trackers, f, indent=4)
        # level_two_trackers = get_trackers("EmailStrict") or get_trackers(
        #     "EmailAggressive"
        # )
        # with open("emails/tracker_lists/level-two-tracker.json", "w+") as f:
        #     json.dump(level_two_trackers, f, indent=4)

    @property
    def ses_client(self) -> SESClient:
        """
        The SES client initiazed at application startup.

        This property allows tests to mock the SES client.
        """
        return self._ses_client

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
        import emails.signals
