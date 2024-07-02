import logging
from typing import Any

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand

import django_ftl
from allauth.socialaccount.models import SocialAccount
from botocore.exceptions import ClientError
from mypy_boto3_ses.type_defs import ContentTypeDef

from emails.apps import EmailsConfig
from emails.utils import get_welcome_email, ses_message_props
from privaterelay.ftl_bundles import main as ftl_bundle
from privaterelay.models import Profile

logger = logging.getLogger("eventsinfo.send_welcome_emails")


class Command(BaseCommand):
    help = "Send the welcome email to all users who haven't received it yet."

    def handle(self, *args: Any, **kwargs: Any) -> None:
        logger.info("Starting send_welcome_emails")
        profiles_without_welcome_email = Profile.objects.filter(
            sent_welcome_email=False
        ).order_by("user_id")
        emails_to_send = len(profiles_without_welcome_email)
        logger.info(f"Emails to send: {emails_to_send}")
        for profile in profiles_without_welcome_email:
            send_welcome_email(profile)
        logger.info("Exiting send_welcome_emails")


def _ses_message_props(data: str) -> ContentTypeDef:
    return {"Charset": "UTF-8", "Data": data}


def send_welcome_email(profile: Profile) -> None:
    user = profile.user
    app_config = apps.get_app_config("emails")
    if not isinstance(app_config, EmailsConfig):
        raise TypeError("app_config must be type EmailsConfig")
    ses_client = app_config.ses_client
    if not ses_client:
        raise ValueError("ses_client must be truthy value")
    if not settings.RELAY_FROM_ADDRESS:
        raise ValueError("settings.RELAY_FROM_ADDRESS must be truthy value.")
    with django_ftl.override(profile.language):
        translated_subject = ftl_bundle.format("first-time-user-email-welcome")
    try:
        ses_client.send_email(
            Destination={
                "ToAddresses": [user.email],
            },
            Source=settings.RELAY_FROM_ADDRESS,
            Message={
                "Subject": ses_message_props(translated_subject),
                "Body": {
                    "Html": ses_message_props(get_welcome_email(user, "html")),
                    "Text": ses_message_props(get_welcome_email(user, "txt")),
                },
            },
        )
        logger.info(f"Sent welcome email to user ID: {profile.user.id}")
        profile.sent_welcome_email = True
        profile.save()
    # Don't send welcome emails to users with no social account.
    # E.g., users created thru admin tools.
    # TODO?: move this check deeper into get_welcome_email ?
    except SocialAccount.DoesNotExist:
        profile.sent_welcome_email = True
        profile.save()
    except ClientError:
        logger.error(
            f"ClientError while sending welcome email to user ID: {profile.user.id}."
        )
