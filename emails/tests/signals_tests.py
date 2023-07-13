from hashlib import sha256
from unittest.mock import patch

from django.test import TestCase

from ..models import Profile
from .models_tests import make_free_test_user


class MeasureFeatureUsageSignalTest(TestCase):
    """Test measure_feature_usage signal handler"""

    def setUp(self) -> None:
        user = make_free_test_user()
        self.profile = user.profile

        patcher_incr = patch("emails.signals.incr_if_enabled")
        self.mocked_incr = patcher_incr.start()
        self.addCleanup(patcher_incr.stop)

        patcher_logger = patch("emails.signals.info_logger.info")
        self.mocked_events_info = patcher_logger.start()
        self.addCleanup(patcher_logger.stop)

    def test_remove_level_one_email_trackers_enabled(self) -> None:
        self.profile.remove_level_one_email_trackers = True
        self.profile.save()

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
