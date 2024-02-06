import json
from datetime import datetime, timezone
from uuid import UUID

import pytest
from model_bakery import baker

from emails.models import RelayAddress
from privaterelay.utils import glean_logger as utils_glean_logger
from privaterelay.glean_interface import RelayGleanLogger


@pytest.fixture
def glean_logger(db, version_json_path) -> RelayGleanLogger:
    utils_glean_logger.cache_clear()  # Ensure version is from version_json_path
    return utils_glean_logger()


def test_log_email_mask_created(glean_logger, caplog, settings) -> None:
    address = baker.make(RelayAddress)
    glean_logger.log_email_mask_created(mask=address, created_by_api=True)

    # One info-level glean-server-event log
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.name == "glean-server-event"  # Type in mozlog
    assert record.msg == "glean-server-event"
    assert record.levelname == "INFO"

    # Check top-level extra data
    assert record.document_namespace == "relay-backend"
    assert record.document_type == "events"
    assert record.document_version == "1"
    assert UUID(record.document_id).version == 4
    assert record.user_agent == ""
    assert record.ip_address == ""
    assert record.payload.startswith("{")

    # Get parts of the payload that vary
    payload = json.loads(record.payload)
    event_ts_ms = payload["events"][0]["timestamp"]
    event_time = datetime.fromtimestamp(event_ts_ms / 1000.0)
    assert 0 < (datetime.now() - event_time).total_seconds() < 0.5

    start_time_iso = payload["ping_info"]["start_time"]
    start_time = datetime.fromisoformat(start_time_iso)
    assert 0 < (datetime.now(timezone.utc) - start_time).total_seconds() < 0.5

    telemetry_sdk_build = payload["client_info"]["telemetry_sdk_build"]
    assert telemetry_sdk_build.startswith("glean_parser v")

    date_joined_ts = int(address.user.date_joined.timestamp())

    # Check payload structure, with known and varying values
    assert payload == {
        "metrics": {},
        "events": [
            {
                "category": "email_mask",
                "name": "created",
                "extra": {
                    "client_id": "",
                    "fxa_id": "",
                    "platform": "",
                    "n_masks": "1",
                    "date_joined_relay": str(date_joined_ts),
                    "premium_status": "free",
                    "date_joined_premium": "-1",
                    "has_extension": "false",
                    "date_got_extension": "-1",
                    "mask_id": f"r{address.id}",
                    "is_random_mask": "true",
                    "has_website": "false",
                    "created_by_api": "true",
                },
                "timestamp": event_ts_ms,
            }
        ],
        "client_info": {
            "app_build": "Unknown",
            "app_channel": settings.RELAY_CHANNEL,
            "app_display_version": "2024.01.17",
            "architecture": "Unknown",
            "first_run_date": "Unknown",
            "os": "Unknown",
            "os_version": "Unknown",
            "telemetry_sdk_build": telemetry_sdk_build,
        },
        "ping_info": {
            "seq": 0,
            "start_time": start_time_iso,
            "end_time": start_time_iso,
        },
    }
