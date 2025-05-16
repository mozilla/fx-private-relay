from unittest import mock

from django.conf import settings
from django.core.management import call_command

import pytest
from kinto_http import KintoException
from kinto_http.patch_type import BasicPatch

COMMAND_NAME = "update_fxrelay_allowlist_collection"


@pytest.fixture
def mocked_client():
    with mock.patch(
        "privaterelay.management.commands.update_fxrelay_allowlist_collection.Client",
        spec=True,
    ) as MockedClient:
        yield MockedClient.return_value


@pytest.fixture
def mocked_get():
    with mock.patch("requests.get") as mock_get:
        yield mock_get


def test_cannot_call_unknown_method(mocked_client):
    with pytest.raises(AttributeError):
        mocked_client.unknown_method()


def test_sync_allowlist_success(mocked_client, mocked_get):
    bucket = settings.REMOTE_SETTINGS_BUCKET
    collection = settings.REMOTE_SETTINGS_COLLECTION
    mocked_client.server_info.return_value = {}
    mocked_client.get_records.return_value = [
        {"id": "old-com", "domain": "old.com"},
    ]

    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"new.com\n"

    call_command(COMMAND_NAME)

    mocked_client.delete_record.assert_called_once_with(
        id="old-com", bucket=bucket, collection=collection
    )
    mocked_client.create_record.assert_called_once_with(
        id="new-com",
        data={"domain": "new.com"},
        bucket=bucket,
        collection=collection,
    )
    called_args = mocked_client.patch_collection.call_args
    assert called_args.kwargs["id"] == collection
    assert called_args.kwargs["bucket"] == bucket
    assert isinstance(called_args.kwargs["changes"], BasicPatch)
    assert called_args.kwargs["changes"].data == {"status": "to-review"}


def test_no_changes_found(mocked_client, mocked_get):
    mocked_client.server_info.return_value = {}
    mocked_client.get_records.return_value = [
        {"id": "nochanges-com", "domain": "nochanges.com"},
    ]

    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"nochanges.com\n"

    call_command(COMMAND_NAME)

    mocked_client.get_records.assert_called_once()
    mocked_get.assert_called_once()
    mocked_client.patch_collection.assert_not_called()


def test_kinto_connection_failure(mocked_client, mocked_get, capsys):
    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"domain.com\n"

    mocked_client.server_info.side_effect = Exception("Connection error")

    with pytest.raises(Exception):
        call_command(COMMAND_NAME)

    captured = capsys.readouterr()
    assert (
        "❌ Failed to connect to Remote Settings server: "
        "Connection error" in captured.err
    )


def test_bucket_created_successfully(mocked_client, mocked_get, capsys):
    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"domain.com\n"

    mocked_client.server_info.return_value = {}
    mocked_client.get_bucket.side_effect = KintoException("Not Found")
    mocked_client.create_bucket.return_value = {}

    mocked_client.get_collection.return_value = {}
    mocked_client.get_records.return_value = []
    mocked_client.patch_collection.return_value = {}

    call_command(COMMAND_NAME)

    captured = capsys.readouterr()
    assert f"✅ Bucket {settings.REMOTE_SETTINGS_BUCKET} created." in captured.out


def test_bucket_creation_failure(mocked_client, mocked_get, capsys):
    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"domain.com\n"

    mocked_client.server_info.return_value = {}
    mocked_client.get_bucket.side_effect = KintoException("Not Found")
    mocked_client.create_bucket.side_effect = KintoException("Create failed")

    with pytest.raises(KintoException):
        call_command(COMMAND_NAME)

    captured = capsys.readouterr()
    assert "❓ Bucket" in captured.out
    assert "❌ Failed to find or create bucket: Create failed" in captured.err


def test_collection_creation_failure(mocked_client, mocked_get, capsys):
    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"domain.com\n"

    mocked_client.server_info.return_value = {}
    mocked_client.get_bucket.return_value = {}
    mocked_client.get_collection.side_effect = KintoException("Not Found")
    mocked_client.create_collection.side_effect = KintoException("Create failed")

    with pytest.raises(KintoException):
        call_command(COMMAND_NAME)

    captured = capsys.readouterr()
    assert "❓ Collection" in captured.out
    assert "❌ Failed to find or create collection: Create failed" in captured.err


def test_collection_created_successfully(mocked_client, mocked_get, capsys):
    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"domain.com\n"

    mocked_client.server_info.return_value = {}
    mocked_client.get_bucket.return_value = {}

    mocked_client.get_collection.side_effect = KintoException("Not Found")
    mocked_client.create_collection.return_value = {}

    mocked_client.get_records.return_value = []
    mocked_client.patch_collection.return_value = {}

    call_command(COMMAND_NAME)

    captured = capsys.readouterr()
    assert (
        f"✅ Collection {settings.REMOTE_SETTINGS_COLLECTION} created." in captured.out
    )


def test_patch_collection_failure(mocked_client, mocked_get, capsys):
    mocked_get.return_value.ok = True
    mocked_get.return_value.content = b"new.com\n"

    mocked_client.server_info.return_value = {}
    mocked_client.get_bucket.return_value = {}
    mocked_client.get_collection.return_value = {}
    mocked_client.get_records.return_value = []
    mocked_client.patch_collection.side_effect = KintoException("Patch failed")

    with pytest.raises(KintoException):
        call_command(COMMAND_NAME)

    captured = capsys.readouterr()
    assert "❌ Failed to request review: Patch failed" in captured.err
