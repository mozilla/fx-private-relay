from collections.abc import Iterator
from hashlib import sha256
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.contrib.sessions.middleware import SessionMiddleware
from django.http.request import HttpRequest
from django.http.response import HttpResponse
from django.test import TestCase
from django.test.client import RequestFactory

import pytest
from model_bakery import baker

from privaterelay.signals import record_user_signed_up

from ..models import Profile
from .utils import make_free_test_user


@pytest.fixture()
def mock_ses_client() -> Iterator[Mock]:
    with patch("emails.apps.EmailsConfig.ses_client") as mock_ses_client:
        yield mock_ses_client


@pytest.mark.django_db
def test_record_user_signed_up_telemetry() -> None:
    user = baker.make(User)
    rf = RequestFactory()
    sign_up_request = rf.get(
        "/accounts/fxa/login/callback/?code=test&state=test&action=signin"
    )

    def get_response(_: HttpRequest) -> HttpResponse:
        return HttpResponse("200 OK")

    middleware = SessionMiddleware(get_response)
    middleware.process_request(sign_up_request)
    record_user_signed_up(sign_up_request, user)

    assert sign_up_request.session["user_created"] is True
    assert sign_up_request.session.modified is True


class MeasureFeatureUsageSignalTest(TestCase):
    """Test measure_feature_usage signal handler"""

    def setUp(self) -> None:
        user = make_free_test_user()
        self.profile = user.profile

        patcher_incr = patch("privaterelay.signals.incr_if_enabled")
        self.mocked_incr = patcher_incr.start()
        self.addCleanup(patcher_incr.stop)

        patcher_logger = patch("privaterelay.signals.info_logger.info")
        self.mocked_events_info = patcher_logger.start()
        self.addCleanup(patcher_logger.stop)

    def test_remove_level_one_email_trackers_enabled(self) -> None:
        self.profile.remove_level_one_email_trackers = True
        self.profile.save()

        assert self.profile.fxa
        expected_hashed_uid = sha256(self.profile.fxa.uid.encode("utf-8")).hexdigest()
        self.mocked_incr.assert_called_once_with("tracker_removal_enabled")
        self.mocked_events_info.assert_called_once_with(
            "tracker_removal_feature",
            extra={
                "enabled": True,
                "hashed_uid": expected_hashed_uid,
            },
        )

    def test_remove_level_one_email_trackers_disabled(self) -> None:
        Profile.objects.filter(id=self.profile.id).update(
            remove_level_one_email_trackers=True
        )
        self.profile.refresh_from_db()

        self.profile.remove_level_one_email_trackers = False
        self.profile.save()

        assert self.profile.fxa
        expected_hashed_uid = sha256(self.profile.fxa.uid.encode("utf-8")).hexdigest()
        self.mocked_incr.assert_called_once_with("tracker_removal_disabled")
        self.mocked_events_info.assert_called_once_with(
            "tracker_removal_feature",
            extra={
                "enabled": False,
                "hashed_uid": expected_hashed_uid,
            },
        )

    def test_remove_level_one_email_trackers_unchanged(self) -> None:
        self.profile.remove_level_one_email_trackers = False
        self.profile.save()
        self.mocked_incr.assert_not_called()
        self.mocked_events_info.assert_not_called()

    def test_unmonitored_field_change_does_not_emit_metric_and_logs(self) -> None:
        self.profile.server_storage = False
        self.profile.save()
        self.mocked_incr.assert_not_called()
        self.mocked_events_info.assert_not_called()

    def test_profile_created_does_not_emit_metric_and_logs(self) -> None:
        self.mocked_incr.assert_not_called()
        self.mocked_events_info.assert_not_called()
