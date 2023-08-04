import pytest
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.sessions.middleware import SessionMiddleware
from django.http.request import HttpRequest
from django.http.response import HttpResponse
from django.test.client import RequestFactory

from model_bakery import baker

from privaterelay.signals import record_user_signed_up


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
