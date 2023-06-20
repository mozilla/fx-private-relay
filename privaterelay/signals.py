from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.dispatch import receiver

from allauth.account.signals import user_signed_up, user_logged_in
from django.http.request import HttpRequest
from mypy_boto3_ses.client import SESClient
from mypy_boto3_ses.type_defs import ContentTypeDef
from waffle import flag_is_active

from emails.apps import EmailsConfig
from emails.utils import get_welcome_email, incr_if_enabled

from .ftl_bundles import main as ftl_bundle


@receiver(user_signed_up)
def record_user_signed_up(request, user, **kwargs):
    incr_if_enabled("user_signed_up", 1)
    # the user_signed_up signal doesn't have access to the response object
    # so we have to set a user_created session var for user_logged_in receiver
    request.session["user_created"] = True
    request.session.modified = True


def _ses_message_props(data: str) -> ContentTypeDef:
    return {"Charset": "UTF-8", "Data": data}


@receiver(user_signed_up)
def send_first_email(request: HttpRequest, user: User, **kwargs):
    if not flag_is_active(request, "welcome_email"):
        return
    app_config = apps.get_app_config("emails")
    assert isinstance(app_config, EmailsConfig)
    ses_client = app_config.ses_client
    assert ses_client
    assert settings.RELAY_FROM_ADDRESS
    ses_client.send_email(
        Destination={
            "ToAddresses": [user.email],
        },
        Source=settings.RELAY_FROM_ADDRESS,
        Message={
            "Subject": _ses_message_props(
                ftl_bundle.format("first-time-user-email-welcome")
            ),
            "Body": {
                "Html": _ses_message_props(get_welcome_email(request, user, "html")),
                "Text": _ses_message_props(get_welcome_email(request, user, "txt")),
            },
        },
    )


@receiver(user_logged_in)
def record_user_logged_in(request, user, **kwargs):
    incr_if_enabled("user_logged_in", 1)
    response = kwargs.get("response")
    event = "user_logged_in"
    # the user_signed_up signal doesn't have access to the response object
    # so we have to check for user_created session var from user_signed_up
    if request.session.get("user_created", False):
        event = "user_signed_up"
    if response:
        response.set_cookie(f"server_ga_event:{event}", event, max_age=5)
