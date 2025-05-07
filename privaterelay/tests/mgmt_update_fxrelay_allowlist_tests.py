from unittest.mock import Mock, patch

from django.conf import settings
from django.core.management import call_command

import pytest

COMMAND_NAME = "update_fxrelay_allowlist_collection"


@pytest.fixture(autouse=True)
def mock_kinto_and_allowlist():
    with (
        patch("kinto_http.Client") as mock_kinto_client,
        patch("requests.get") as mock_allowlist_get,
    ):
        mock_kinto = Mock()
        mock_kinto_client.return_value = mock_kinto
        yield mock_kinto, mock_allowlist_get


def test_sync_allowlist_success(mock_kinto_and_allowlist):
    mock_kinto, mock_allowlist_get = mock_kinto_and_allowlist

    mock_kinto.server_info.return_value = {}
    mock_kinto.get_records.return_value = [
        {"id": "1", "domain": "old.com"},
    ]

    mock_allowlist_get.return_value.ok = True
    mock_allowlist_get.return_value.content = b"new.com\n"

    call_command(COMMAND_NAME)

    mock_kinto.delete_record.assert_called_once_with(
        id="1", bucket=settings.KINTO_BUCKET, collection=settings.KINTO_COLLECTION
    )
    mock_kinto.create_record.assert_called_once_with(
        id="new.com",
        data={"domain": "new.com"},
        bucket=settings.KINTO_BUCKET,
        collection=settings.KINTO_COLLECTION,
    )
