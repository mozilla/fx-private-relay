from unittest.mock import patch
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.sessions.middleware import SessionMiddleware
from django.test.client import RequestFactory
from model_bakery import baker
import pytest

from privaterelay.signals import record_user_signed_up, send_first_email


@pytest.fixture()
def mock_ses_client():
    with patch("emails.apps.EmailsConfig.ses_client") as mock_ses_client:
        yield mock_ses_client


@pytest.mark.django_db
def test_record_user_signed_up_telemetry():
    user = baker.make(User)
    rf = RequestFactory()
    sign_up_request = rf.get(
        "/accounts/fxa/login/callback/?code=test&state=test&action=signin"
    )
    middleware = SessionMiddleware()
    middleware.process_request(sign_up_request)
    record_user_signed_up(sign_up_request, user)

    assert sign_up_request.session["user_created"] == True
    assert sign_up_request.session.modified == True


@pytest.mark.django_db
def test_record_user_signed_up_send_first_email(mock_ses_client):
    test_user_email = "testuser@test.com"
    user = baker.make(User, email=test_user_email)
    rf = RequestFactory()
    sign_up_request = rf.get(
        "/accounts/fxa/login/callback/?code=test&state=test&action=signin"
    )
    send_first_email(sign_up_request, user)

    mock_ses_client.send_email.assert_called_once()
    call_kwargs = mock_ses_client.send_email.call_args.kwargs
    to_addresses = call_kwargs["Destination"]["ToAddresses"]
    from_address = call_kwargs["Source"]
    subject = call_kwargs["Message"]["Subject"]["Data"]
    html_body = call_kwargs["Message"]["Body"]["Html"]["Data"]

    assert len(to_addresses) == 1
    assert to_addresses[0] == test_user_email
    assert from_address == settings.RELAY_FROM_ADDRESS
    assert subject == "Welcome to \u2068Firefox Relay\u2069"
    assert (
        f'href="{settings.SITE_ORIGIN}/accounts/profile/?utm_campaign=first_email&utm_source=email&utm_medium=email"'
        in html_body
    )
    assert "View your dashboard" in html_body
