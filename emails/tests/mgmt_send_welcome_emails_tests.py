from typing import Tuple
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command

import django_ftl
import pytest
from allauth.socialaccount.models import SocialAccount

from emails.models import Profile
from emails.tests.models_tests import make_free_test_user
from privaterelay.ftl_bundles import main as ftl_bundle

COMMAND_NAME = "send_welcome_emails"


@pytest.fixture()
def mock_ses_client():
    with patch("emails.apps.EmailsConfig.ses_client") as mock_ses_client:
        yield mock_ses_client


@pytest.mark.django_db
def test_no_profiles_need_welcome_email(caplog: pytest.LogCaptureFixture):
    profiles_without_welcome_email = Profile.objects.filter(sent_welcome_email=False)
    assert profiles_without_welcome_email.count() == 0
    call_command(COMMAND_NAME)
    rec1, rec2, rec3 = caplog.records
    assert "Starting" in rec1.getMessage()
    assert rec2.getMessage() == "Emails to send: 0"
    assert "Exiting" in rec3.getMessage()


@pytest.mark.django_db
def test_no_locale_defaults_to_en(
    mock_ses_client: MagicMock, caplog: pytest.LogCaptureFixture
):
    ftl_bundle.reload()
    user = _make_user_who_needs_welcome_email_with_locale("")

    call_command(COMMAND_NAME)
    _assert_caplog_for_1_email_to_user(user, caplog)

    to_addresses, source, subject, body_html = _get_send_email_args(mock_ses_client)
    assert to_addresses == [user.email]
    assert source == settings.RELAY_FROM_ADDRESS
    with django_ftl.override("en"):
        expected_subject = ftl_bundle.format("first-time-user-email-welcome")
    assert subject == expected_subject
    assert 'lang="en"' in body_html


@pytest.mark.django_db
@pytest.mark.parametrize("locale", ("en-US,en;q=0.5", "de;q=0.7,en;q=0.3"))
def test_send_welcome_emails(
    locale: str, mock_ses_client: MagicMock, caplog: pytest.LogCaptureFixture
):
    ftl_bundle.reload()
    user = _make_user_who_needs_welcome_email_with_locale(locale)

    call_command(COMMAND_NAME)
    _assert_caplog_for_1_email_to_user(user, caplog)

    to_addresses, source, subject, body_html = _get_send_email_args(mock_ses_client)
    assert to_addresses == [user.email]
    assert source == settings.RELAY_FROM_ADDRESS
    with django_ftl.override(user.profile.language):
        expected_subject = ftl_bundle.format("first-time-user-email-welcome")
        expected_cta = ftl_bundle.format("first-time-user-email-hero-cta")
    assert subject == expected_subject
    assert expected_cta in body_html


def _make_user_who_needs_welcome_email_with_locale(locale: str = "") -> User:
    user = make_free_test_user()
    user.profile.sent_welcome_email = False
    user.profile.save()
    user_with_locale = _add_locale_to_user(user, locale)
    return user_with_locale


def _add_locale_to_user(user: User, locale: str) -> User:
    sa = SocialAccount.objects.get(user=user, provider="fxa")
    sa.extra_data = {"locale": locale}
    sa.save()
    return user


def _assert_caplog_for_1_email_to_user(
    user: User, caplog: pytest.LogCaptureFixture
) -> None:
    rec1, rec2, rec3, rec4 = caplog.records
    assert "Starting" in rec1.getMessage()
    assert rec2.getMessage() == "Emails to send: 1"
    assert f"Sent welcome email to user ID: {user.id}" in rec3.getMessage()
    assert "Exiting" in rec4.getMessage()


def _get_send_email_args(mock_ses_client: MagicMock) -> Tuple:
    call_args = mock_ses_client.send_email.call_args[1]
    to_addresses = call_args["Destination"]["ToAddresses"]
    source = call_args["Source"]
    subject = call_args["Message"]["Subject"]["Data"]
    body_html = call_args["Message"]["Body"]["Html"]["Data"]
    return to_addresses, source, subject, body_html
