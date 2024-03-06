from datetime import datetime, timezone
from typing import Any, NamedTuple
from logging import LogRecord
from uuid import UUID, uuid4
import json

from django.test import RequestFactory
from django.contrib.auth.models import User

from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
from pytest_django.fixtures import SettingsWrapper
import pytest

from api.serializers import RelayAddressSerializer
from emails.models import RelayAddress
from emails.tests.models_tests import (
    make_free_test_user,
    make_premium_test_user,
    phone_subscription,
    vpn_subscription,
)
from privaterelay.types import RELAY_CHANNEL_NAME
from privaterelay.utils import glean_logger as utils_glean_logger
from privaterelay.tests.utils import create_expected_glean_event
from privaterelay.glean_interface import (
    EmailBlockedReason,
    EmailMaskData,
    RelayGleanLogger,
    RequestData,
    UserData,
)


@pytest.fixture
def glean_logger(db, version_json_path) -> RelayGleanLogger:
    utils_glean_logger.cache_clear()  # Ensure version is from version_json_path
    return utils_glean_logger()


@pytest.fixture
def optout_user(db) -> User:
    user = baker.make(User, email="optout@example.com")
    SocialAccount.objects.get_or_create(
        user=user,
        provider="fxa",
        defaults={
            "uid": str(uuid4()),
            "extra_data": {
                "avatar": "image.png",
                "subscriptions": [],
                "metricsEnabled": False,
            },
        },
    )
    assert user.profile.metrics_enabled is False
    return user


def test_request_data_routable_ip_is_extracted(rf: RequestFactory) -> None:
    """A routable IP address is extracted from the headers"""
    request = rf.get(
        "/api/v1/runtime_data/",
        headers={
            "user-agent": "Mozilla/5.0 Firefox/125.0",
            "remote-addr": "10.1.2.3",  # private network
            "x-forwarded-for": "130.211.19.131, 44.236.72.93",  # Relay, Bedrock IPs
        },
    )
    request_data = RequestData.from_request(request)
    assert request_data.user_agent == "Mozilla/5.0 Firefox/125.0"
    assert request_data.ip_address == "130.211.19.131"


def test_request_data_non_routable_ip_is_discarded(rf: RequestFactory) -> None:
    """A non-routable IP address is discarded"""
    request = rf.get(
        "/api/v1/runtime_data/",
        headers={
            "user-agent": "Mozilla/5.0 Firefox/124.0",
            "remote_addr": "10.2.3.178",  # private network
            "x_forwarded_for": "203.0.113.42",  # TEST-NET-3 documentation IP
        },
    )
    request_data = RequestData.from_request(request)
    assert request_data.user_agent == "Mozilla/5.0 Firefox/124.0"
    assert request_data.ip_address is None


@pytest.mark.django_db
def test_user_data_free_user() -> None:
    """Data is extracted for a free user."""
    user = make_free_test_user()
    assert user.profile.fxa

    user_data = UserData.from_user(user)

    assert user_data.metrics_enabled is True
    assert user_data.fxa_id == user.profile.fxa.uid
    assert user_data.n_random_masks == 0
    assert user_data.n_domain_masks == 0
    assert user_data.n_deleted_random_masks == 0
    assert user_data.n_deleted_domain_masks == 0
    assert user_data.date_joined_relay == user.date_joined
    assert user_data.date_joined_premium is None
    assert user_data.premium_status == "free"
    assert user_data.has_extension is False
    assert user_data.date_got_extension is None


@pytest.mark.django_db
def test_user_data_addon_user() -> None:
    """Data is extracted for a free user of the add-on."""
    user = make_free_test_user()
    ra = user.relayaddress_set.create(generated_for="example.com")

    user_data = UserData.from_user(user)

    assert user_data.n_random_masks == 1
    assert user_data.has_extension is True
    assert user_data.date_got_extension == ra.created_at


@pytest.mark.django_db
def test_user_data_premium_user() -> None:
    """Data is extracted for a premium email user."""
    user = make_premium_test_user()
    assert user.profile.fxa

    user_data = UserData.from_user(user)

    assert user_data.fxa_id == user.profile.fxa.uid
    assert user_data.date_joined_premium == user.profile.date_subscribed
    assert user_data.premium_status == "email_unknown"


@pytest.mark.django_db
def test_user_data_phone_user() -> None:
    """Data is extracted for a premium email + phone user."""
    user = make_premium_test_user()
    social_account = SocialAccount.objects.get(user=user)
    social_account.extra_data["subscriptions"].append(phone_subscription())
    social_account.save()

    user_data = UserData.from_user(user)

    assert user_data.date_joined_premium == user.profile.date_subscribed_phone
    assert user_data.premium_status == "phone_unknown"


@pytest.mark.django_db
def test_user_data_vpn_user() -> None:
    """Data is extracted for a VPN bundle user."""
    user = make_premium_test_user()
    social_account = SocialAccount.objects.get(user=user)
    social_account.extra_data["subscriptions"].append(phone_subscription())
    social_account.extra_data["subscriptions"].append(vpn_subscription())
    social_account.save()

    user_data = UserData.from_user(user)

    assert user_data.date_joined_premium == user.profile.date_subscribed_phone
    assert user_data.premium_status == "bundle_unknown"


def test_user_data_optout_user(optout_user) -> None:
    user_data = UserData.from_user(optout_user)
    assert user_data.metrics_enabled is False


@pytest.mark.django_db
def test_email_mask_relay_address() -> None:
    user = make_free_test_user()
    mask = user.relayaddress_set.create()

    mask_data = EmailMaskData.from_mask(mask)

    assert mask_data.mask_id == mask.metrics_id
    assert mask_data.is_random_mask is True
    assert mask_data.has_website is False


@pytest.mark.django_db
def test_email_mask_relay_address_from_addon() -> None:
    user = make_free_test_user()
    mask = user.relayaddress_set.create(generated_for="example.com")

    mask_data = EmailMaskData.from_mask(mask)

    assert mask_data.has_website is True


@pytest.mark.django_db
def test_email_mask_domain_address() -> None:
    user = make_premium_test_user()
    user.profile.subdomain = "a_subdomain"
    user.profile.save()
    mask = user.domainaddress_set.create(address="custom")

    mask_data = EmailMaskData.from_mask(mask)

    assert mask_data.mask_id == mask.metrics_id
    assert mask_data.is_random_mask is False
    assert mask_data.has_website is False


def create_expected_glean_payload(
    category: str,
    name: str,
    extra_items: dict[str, str],
    user: User,
    event_time: str,
    app_channel: RELAY_CHANNEL_NAME,
    telemetry_sdk_build: str,
    ping_time: str,
) -> dict[str, Any]:
    """Return the expected payload, JSON-decoded from the glean log."""
    return {
        "metrics": {},
        "events": [
            create_expected_glean_event(category, name, user, extra_items, event_time)
        ],
        "client_info": {
            "app_build": "Unknown",
            "app_channel": app_channel,
            "app_display_version": "2024.01.17",
            "architecture": "Unknown",
            "first_run_date": "Unknown",
            "os": "Unknown",
            "os_version": "Unknown",
            "telemetry_sdk_build": telemetry_sdk_build,
        },
        "ping_info": {"seq": 0, "start_time": ping_time, "end_time": ping_time},
    }


def assert_glean_record(
    record: LogRecord, user_agent: str = "", ip_address: str = ""
) -> None:
    """Check that the record is an expected glean record."""
    assert record.name == "glean-server-event"  # Type in mozlog
    assert record.msg == "glean-server-event"
    assert record.levelname == "INFO"

    # Check top-level extra data
    assert getattr(record, "document_namespace") == "relay-backend"
    assert getattr(record, "document_type") == "events"
    assert getattr(record, "document_version") == "1"
    assert UUID(getattr(record, "document_id")).version == 4
    assert getattr(record, "user_agent") == user_agent
    assert getattr(record, "ip_address") == ip_address
    assert getattr(record, "payload").startswith("{")


class PayloadVariedParts(NamedTuple):
    """Parts of a Glean payload that vary over test runs"""

    event_timestamp_ms: str
    ping_time_iso: str
    telemetry_sdk_build: str


def extract_parts_from_payload(payload: dict[str, Any]) -> PayloadVariedParts:
    """Check and return parts of the Glean payload that vary over test runs."""
    event_ts_ms = payload["events"][0]["timestamp"]
    event_time = datetime.fromtimestamp(event_ts_ms / 1000.0)
    # The event_time is milliseconds from epoch. Check we converted it correctly.
    assert 0 < (datetime.now() - event_time).total_seconds() < 0.5

    start_time_iso = payload["ping_info"]["start_time"]
    start_time = datetime.fromisoformat(start_time_iso)
    # The start_time is in ISO 8601 format with timezone data. Check the conversion.
    assert 0 < (datetime.now(timezone.utc) - start_time).total_seconds() < 0.5

    telemetry_sdk_build = payload["client_info"]["telemetry_sdk_build"]
    # The version will change with glean_parser releases, so only check prefix
    assert telemetry_sdk_build.startswith("glean_parser v")

    return PayloadVariedParts(
        event_timestamp_ms=event_ts_ms,
        ping_time_iso=start_time_iso,
        telemetry_sdk_build=telemetry_sdk_build,
    )


def test_log_email_mask_created(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    settings: SettingsWrapper,
) -> None:
    """Check that log_email_mask_created results in a Glean server-side log."""
    user = make_free_test_user()
    address = baker.make(RelayAddress, user=user)

    glean_logger.log_email_mask_created(mask=address, created_by_api=True)

    # Check the one glean-server-event log
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert_glean_record(record)

    # Check payload structure
    payload = json.loads(getattr(record, "payload"))
    parts = extract_parts_from_payload(payload)
    expected_payload = create_expected_glean_payload(
        category="email_mask",
        name="created",
        extra_items={
            "n_random_masks": "1",
            "mask_id": address.metrics_id,
            "is_random_mask": "true",
            "has_website": "false",
            "created_by_api": "true",
        },
        user=user,
        event_time=parts.event_timestamp_ms,
        app_channel=settings.RELAY_CHANNEL,
        telemetry_sdk_build=parts.telemetry_sdk_build,
        ping_time=parts.ping_time_iso,
    )
    assert payload == expected_payload


def test_log_email_mask_created_with_opt_out(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    optout_user: User,
) -> None:
    """A log is not emitted for mask creation when the user has opted-out of metrics."""
    address = baker.make(RelayAddress, user=optout_user)
    glean_logger.log_email_mask_created(mask=address, created_by_api=False)
    assert len(caplog.records) == 0


def test_log_email_mask_label_updated(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    settings: SettingsWrapper,
    rf: RequestFactory,
) -> None:
    """Check that log_email_mask_label_updated results in a Glean server-side log."""
    user = make_free_test_user()
    address = baker.make(RelayAddress, user=user)
    data = RelayAddressSerializer(address).data
    data["label"] = "A brand new label"
    user_agent = "glean_tester 1.0.1"
    ip_address = "44.235.246.155"  # www.mozilla.org load balancer
    request = rf.put(
        f"/api/v1/relayaddresses/{address.id}/",
        data=data,
        content_type="application/json",
        headers={"user-agent": user_agent, "x-forwarded-for": ip_address},
    )

    glean_logger.log_email_mask_label_updated(mask=address, request=request)

    # Check the one glean-server-event log
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert_glean_record(record, user_agent=user_agent, ip_address=ip_address)

    # Check payload structure
    payload = json.loads(getattr(record, "payload"))
    parts = extract_parts_from_payload(payload)
    expected_payload = create_expected_glean_payload(
        category="email_mask",
        name="label_updated",
        extra_items={
            "n_random_masks": "1",
            "mask_id": address.metrics_id,
            "is_random_mask": "true",
        },
        user=user,
        event_time=parts.event_timestamp_ms,
        app_channel=settings.RELAY_CHANNEL,
        telemetry_sdk_build=parts.telemetry_sdk_build,
        ping_time=parts.ping_time_iso,
    )
    assert payload == expected_payload


def test_log_email_mask_label_updated_with_opt_out(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    rf: RequestFactory,
    optout_user: User,
) -> None:
    """A log is not emitted for mask updates when the user has opted-out of metrics."""
    address = baker.make(RelayAddress, user=optout_user)
    data = RelayAddressSerializer(address).data
    data["label"] = "A brand new label"
    request = rf.put(
        f"/api/v1/relayaddresses/{address.id}/",
        data=data,
        content_type="application/json",
    )

    glean_logger.log_email_mask_label_updated(mask=address, request=request)
    assert len(caplog.records) == 0


def test_log_email_mask_deleted(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    settings: SettingsWrapper,
    rf: RequestFactory,
) -> None:
    """Check that log_email_mask_deleted results in a Glean server-side log."""
    user = make_free_test_user()
    address = baker.make(RelayAddress, user=user)
    mask_id = address.metrics_id
    request = rf.delete(f"/api/v1/relayaddresses/{address.id}/")
    address.delete()  # Real request will delete the mask before glean event

    glean_logger.log_email_mask_deleted(
        user=user, mask_id=mask_id, is_random_mask=True, request=request
    )
    # Check the one glean-server-event log
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert_glean_record(record)

    # Check payload structure
    payload = json.loads(getattr(record, "payload"))
    parts = extract_parts_from_payload(payload)
    expected_payload = create_expected_glean_payload(
        category="email_mask",
        name="deleted",
        extra_items={
            "n_random_masks": "0",
            "mask_id": mask_id,
            "is_random_mask": "true",
        },
        user=user,
        event_time=parts.event_timestamp_ms,
        app_channel=settings.RELAY_CHANNEL,
        telemetry_sdk_build=parts.telemetry_sdk_build,
        ping_time=parts.ping_time_iso,
    )
    assert payload == expected_payload


def test_log_email_mask_deleted_with_opt_out(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    rf: RequestFactory,
    optout_user: User,
) -> None:
    """A log is not emitted for mask deletion when the user has opted-out of metrics"""
    address = baker.make(RelayAddress, user=optout_user)
    mask_id = address.metrics_id
    user = address.user
    request = rf.delete(f"/api/v1/relayaddresses/{address.id}/")
    address.delete()  # Real request will delete the mask before glean event

    glean_logger.log_email_mask_deleted(
        user=user, mask_id=mask_id, is_random_mask=True, request=request
    )
    assert len(caplog.records) == 0


@pytest.mark.parametrize("is_reply", (True, False))
def test_log_email_forwarded(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    settings: SettingsWrapper,
    is_reply: bool,
) -> None:
    """Check that log_email_forwarded results in a Glean server-side log."""
    user = make_premium_test_user()
    address = baker.make(RelayAddress, user=user)

    glean_logger.log_email_forwarded(mask=address, is_reply=is_reply)

    # Check the one glean-server-event log
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert_glean_record(record)

    # Check payload structure
    payload = json.loads(getattr(record, "payload"))
    parts = extract_parts_from_payload(payload)
    expected_payload = create_expected_glean_payload(
        category="email",
        name="forwarded",
        extra_items={
            "n_random_masks": "1",
            "mask_id": address.metrics_id,
            "is_random_mask": "true",
            "is_reply": "true" if is_reply else "false",
        },
        user=user,
        event_time=parts.event_timestamp_ms,
        app_channel=settings.RELAY_CHANNEL,
        telemetry_sdk_build=parts.telemetry_sdk_build,
        ping_time=parts.ping_time_iso,
    )
    assert payload == expected_payload


def test_log_email_forwarded_with_opt_out(
    glean_logger: RelayGleanLogger, caplog: pytest.LogCaptureFixture, optout_user: User
) -> None:
    """A log is not emitted for email forwarding when the user has opted-out"""
    address = baker.make(RelayAddress, user=optout_user)
    glean_logger.log_email_forwarded(mask=address, is_reply=False)
    assert len(caplog.records) == 0


@pytest.mark.parametrize(
    "is_reply,reason",
    [(True, "block_all"), (False, "block_promotional")],
)
def test_log_email_blocked(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    settings: SettingsWrapper,
    is_reply: bool,
    reason: EmailBlockedReason,
) -> None:
    """Check that log_email_blocked results in a Glean server-side log."""
    user = make_free_test_user()
    address = baker.make(RelayAddress, user=user)

    glean_logger.log_email_blocked(mask=address, is_reply=is_reply, reason=reason)

    # Check the one glean-server-event log
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert_glean_record(record)

    # Check payload structure
    payload = json.loads(getattr(record, "payload"))
    parts = extract_parts_from_payload(payload)
    expected_payload = create_expected_glean_payload(
        category="email",
        name="blocked",
        extra_items={
            "n_random_masks": "1",
            "mask_id": address.metrics_id,
            "is_random_mask": "true",
            "is_reply": "true" if is_reply else "false",
            "reason": reason,
        },
        user=user,
        event_time=parts.event_timestamp_ms,
        app_channel=settings.RELAY_CHANNEL,
        telemetry_sdk_build=parts.telemetry_sdk_build,
        ping_time=parts.ping_time_iso,
    )
    assert payload == expected_payload


def test_log_email_blocked_with_opt_out(
    glean_logger: RelayGleanLogger,
    caplog: pytest.LogCaptureFixture,
    settings: SettingsWrapper,
    optout_user: User,
) -> None:
    """A log is not emitted for a blocked email when the user has opted-out"""
    address = baker.make(RelayAddress, user=optout_user)
    glean_logger.log_email_blocked(mask=address, is_reply=False, reason="block_all")

    # Check the one glean-server-event log
    assert len(caplog.records) == 0
