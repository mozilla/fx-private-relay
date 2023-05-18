import pytest
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.sessions.middleware import SessionMiddleware
from django.http.request import HttpRequest
from django.http.response import HttpResponse
from django.test.client import RequestFactory

from model_bakery import baker
from waffle.testutils import override_flag

from privaterelay.ftl_bundles import main
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

    def get_response(_: HttpRequest):
        return HttpResponse("200 OK")

    middleware = SessionMiddleware(get_response)
    middleware.process_request(sign_up_request)
    record_user_signed_up(sign_up_request, user)

    assert sign_up_request.session["user_created"] == True
    assert sign_up_request.session.modified == True


@pytest.mark.django_db
def test_record_user_signed_up_send_first_email_requires_flag(mock_ses_client):
    test_user_email = "testuser@test.com"
    user = baker.make(User, email=test_user_email)
    rf = RequestFactory()
    sign_up_request = rf.get(
        "/accounts/fxa/login/callback/?code=test&state=test&action=signin"
    )
    send_first_email(sign_up_request, user)

    assert not mock_ses_client.send_email.called


# TODO: add another lang_code when messages are available in another locale
@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("lang_code", ("en",))
@override_flag("welcome_email", active=True)
def test_record_user_signed_up_send_first_email(lang_code, mock_ses_client, caplog):
    main.reload()  # Reload Fluent files to regenerate errors
    test_user_email = "testuser@test.com"
    user = baker.make(User, email=test_user_email)
    rf = RequestFactory()
    sign_up_request = rf.get(
        "/accounts/fxa/login/callback/?code=test&state=test&action=signin"
    )
    sign_up_request.LANGUAGE_CODE = lang_code
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
        f'src="{settings.SITE_ORIGIN}/static/images/email-images/first-time-user/hero-image-{lang_code}.png"'
        in html_body
    )
    assert (
        f'href="{settings.SITE_ORIGIN}/accounts/profile/?utm_campaign=relay-onboarding&utm_source=relay-onboarding&utm_medium=email&utm_content=hero-cta"'
        in html_body
    )
    assert "View your dashboard" in html_body

    for log_name, log_level, message in caplog.record_tuples:
        if log_name == "django_ftl.message_errors":
            pytest.fail(message)
