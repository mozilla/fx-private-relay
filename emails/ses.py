"""Interface to AWS Simple Email Service (SES)"""
from __future__ import annotations

from django.apps import apps
from django.conf import settings

from mypy_boto3_ses.client import SESClient
from mypy_boto3_ses.type_defs import SendRawEmailResponseTypeDef

from .apps import EmailsConfig


def ses_client() -> SESClient:
    """An SES client, configured during Django setup."""
    emails_config = apps.get_app_config("emails")
    assert isinstance(emails_config, EmailsConfig)
    client = emails_config.ses_client
    return client


def send_raw_email(
    from_address: str,
    to_addresses: list[str],
    raw_message: str,
) -> SendRawEmailResponseTypeDef:
    """
    Send an email using send_raw_email()

    Keyword Arguments:
    raw_message - The email message as a string, will be base64 encoded
    from_address - The sender email address
    to_addresses - A list of To:, CC: and BCC: recipient email addresses

    Return is an SesSendRawEmailResponseTypeDef

    Can raise:
    * SES.Client.exceptions.MessageRejected
    * SES.Client.exceptions.MailFromDomainNotVerifiedException
    * SES.Client.exceptions.ConfigurationSetDoesNotExistException
    * SES.Client.exceptions.ConfigurationSetSendingPausedException
    * SES.Client.exceptions.AccountSendingPausedException
    """
    client = ses_client()
    assert settings.AWS_SES_CONFIGSET is not None
    return client.send_raw_email(
        Source=from_address,
        Destinations=to_addresses,
        RawMessage={"Data": raw_message},
        ConfigurationSetName=settings.AWS_SES_CONFIGSET,
    )
