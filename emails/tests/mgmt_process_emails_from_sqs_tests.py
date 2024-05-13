import json
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any
from unittest.mock import Mock, patch
from uuid import uuid4

from django.core.management import call_command
from django.core.management.base import CommandError
from django.http import HttpResponse

import OpenSSL
import pytest
from botocore.exceptions import ClientError
from markus.testing import MetricsMock
from pytest import LogCaptureFixture
from pytest_django.fixtures import SettingsWrapper

from emails.tests.views_tests import EMAIL_SNS_BODIES
from privaterelay.tests.utils import log_extra

if TYPE_CHECKING:
    from botocore.exceptions import _ClientErrorResponseTypeDef


COMMAND_NAME = "process_emails_from_sqs"
MOCK_BASE = "emails.management.commands.process_emails_from_sqs"
TEST_SNS_MESSAGE = EMAIL_SNS_BODIES["s3_stored"]


@pytest.fixture(autouse=True)
def mocked_clocks() -> Iterator[None]:
    """
    Mock time functions, so tests run faster than real time.

    time.monotonic() with return +1 seconds each call
    time.sleep() will not sleep but will increase monotonic counter
    """
    clock: float = 0.0

    def inc_clock(seconds: float = 1.0) -> float:
        nonlocal clock
        clock += seconds
        return clock

    class MockTimer:
        """Mocked version of codetiming.Timer, only used as context manager."""

        def __init__(self, logger: None) -> None:
            assert logger is None

        def __enter__(self) -> "MockTimer":
            nonlocal clock
            self._mock_time = clock
            return self

        def __exit__(self, *exc_info: Any) -> None:
            nonlocal clock
            self.last = clock - self._mock_time

    with (
        patch(f"{MOCK_BASE}.time.monotonic") as mock_monotonic,
        patch(f"{MOCK_BASE}.time.sleep") as mock_sleep,
        patch(f"{MOCK_BASE}.Timer", MockTimer),
    ):
        mock_monotonic.side_effect = mock_sleep.side_effect = inc_clock
        yield


@pytest.fixture(autouse=True)
def mock_verify_from_sns() -> Iterator[Mock]:
    """Mock verify_from_sns(json_body) to return JSON"""
    with patch(f"{MOCK_BASE}.verify_from_sns") as mock_verify_from_sns:
        mock_verify_from_sns.side_effect = lambda msg_json: msg_json
        yield mock_verify_from_sns


@pytest.fixture(autouse=True)
def mock_sns_inbound_logic() -> Iterator[Mock]:
    """Mock _sns_inbound_logic(topic_arn, message_type, json_body) to do nothing"""
    with patch(f"{MOCK_BASE}._sns_inbound_logic") as mock_sns_inbound_logic:
        yield mock_sns_inbound_logic


@pytest.fixture(autouse=True)
def test_settings(settings: SettingsWrapper, tmp_path: Path) -> SettingsWrapper:
    """Override settings for tests."""
    settings.AWS_SNS_TOPIC = {TEST_SNS_MESSAGE["TopicArn"]}
    settings.AWS_REGION = "us-east-1"

    settings.AWS_SQS_EMAIL_QUEUE_URL = (
        "https://sqs.us-east-1.amazonaws.example.com/111222333/queue-name"
    )
    settings.PROCESS_EMAIL_BATCH_SIZE = 10
    settings.PROCESS_EMAIL_DELETE_FAILED_MESSAGES = False
    settings.PROCESS_EMAIL_HEALTHCHECK_PATH = str(tmp_path / "healthcheck.json")
    settings.PROCESS_EMAIL_MAX_SECONDS = 3
    settings.PROCESS_EMAIL_VERBOSITY = 2
    settings.PROCESS_EMAIL_VISIBILITY_SECONDS = 120
    settings.PROCESS_EMAIL_WAIT_SECONDS = 5
    settings.PROCESS_EMAIL_MAX_SECONDS_PER_MESSAGE = 3
    return settings


@pytest.fixture(autouse=True)
def mock_sqs_client() -> Iterator[Mock]:
    """Mock a queue created by boto3.resource('sqs').Queue()"""

    mock_queue = Mock(spec_set=["Queue"])
    mock_queue.Queue.return_value = fake_queue()

    def validate_call(resource_type: str, region_name: str) -> Mock:
        nonlocal mock_queue
        assert resource_type == "sqs"
        mock_queue.Queue._mock_region = region_name
        return mock_queue

    with patch(f"{MOCK_BASE}.boto3.resource") as mock_resource:
        mock_resource.side_effect = validate_call
        yield mock_queue.Queue


@pytest.fixture(autouse=True)
def mock_process_pool_future() -> Iterator[Mock]:
    """
    Replace multiprocessing.Pool with a mock, return mocked future.

    The mocked pool.apply_async returns a mocked future that does not start a
    new subproccess. By default, running ".wait()" runs the (mocked) _sns_inbound_logic.
    The timeout is appended to future._timeouts, and future.ready() will return True.

    If mock_future.stalled returns False, then future.wait() will return without
    running _sns_inbound_logic. This can emulate a slow-running process (use a
    side_effect to return False then True) or a hung process (always return False).
    """

    with patch(MOCK_BASE + ".Pool", spec=True) as mock_pool_cls:
        mock_pool = Mock(spec_set=["__enter__", "__exit__", "apply_async", "terminate"])
        mock_pool.__enter__ = Mock(return_value=mock_pool)
        mock_pool.__exit__ = Mock(side_effect=mock_pool.terminate())

        mock_future = Mock()
        mock_future._timeouts = []
        mock_future._is_stalled.return_value = False
        mock_future._ready = False

        def mock_apply_async(
            func: Callable[[str, str, Any], HttpResponse],
            args: tuple[str, str, Any],
            kwargs: dict[str, Any] | None = None,
            callback: Callable[[Any], None] | None = None,
            error_callback: Callable[[BaseException], None] | None = None,
        ) -> Mock:

            def call_wait(timeout: float) -> None:
                mock_future._timeouts.append(timeout)
                if not mock_future._is_stalled():
                    mock_future._ready = True
                    try:
                        ret = func(*args)
                    except BaseException as e:
                        if error_callback:
                            error_callback(e)
                    else:
                        if callback:
                            callback(ret)

            def call_ready() -> bool:
                return bool(mock_future._ready)

            mock_future.wait.side_effect = call_wait
            mock_future.ready.side_effect = call_ready
            return mock_future

        mock_pool_cls.return_value = mock_pool
        mock_pool.apply_async.side_effect = mock_apply_async
        yield mock_future


def fake_queue(*message_lists: list[Mock] | BaseException) -> Mock:
    """
    Return a mock version of boto3's SQS Queue

    Arguments:
    message_lists: A list of lists of messages, None if no messages
    """
    queue = Mock(spec_set=("receive_messages", "load", "attributes"))
    queue.attributes = {
        "ApproximateNumberOfMessages": 1,
        "ApproximateNumberOfMessagesDelayed": 2,
        "ApproximateNumberOfMessagesNotVisible": 3,
    }
    if message_lists:
        queue.receive_messages.side_effect = message_lists
    else:
        queue.receive_messages.return_value = []
    return queue


def fake_sqs_message(body: str) -> Mock:
    """
    Create a fake SQS message

    Only includes some attributes. For full spec, see:
    https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sqs.html#message
    """
    msg = Mock(spec_set=("queue_url", "receipt_handle", "body", "message_id", "delete"))
    msg.queue_url = (
        "https://sqs.us-east-1.amazonaws.example.com/123456789012/queue-name"
    )
    msg.receipt_handle = str(uuid4())
    msg.body = body
    msg.message_id = str(uuid4())
    return msg


def make_client_error(
    message: str = "Unknown", code: str = "Unknown", operation_name: str = "Unknown"
) -> ClientError:
    """Create a minimal botocore.exceptions.ClientError"""
    err_response: _ClientErrorResponseTypeDef = {
        "Error": {"Message": message, "Code": code}
    }
    return ClientError(err_response, operation_name)


def summary_from_exit_log(caplog_fixture: LogCaptureFixture) -> dict[str, Any]:
    """Get the extra data from the final log message"""
    last_log = caplog_fixture.records[-1]
    assert last_log.message == f"Exiting {COMMAND_NAME}"
    return log_extra(last_log)


def test_no_messages(caplog: LogCaptureFixture, test_settings: SettingsWrapper) -> None:
    """The command can exit after the max time and processing no messages."""
    call_command(COMMAND_NAME)

    rec1, rec2, rec3, rec4 = caplog.records
    assert rec1.getMessage() == "Starting process_emails_from_sqs"
    assert log_extra(rec1) == {
        "aws_region": "us-east-1",
        "batch_size": 10,
        "delete_failed_messages": False,
        "healthcheck_path": test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH,
        "max_seconds": 3,
        "max_seconds_per_message": 3,
        "sqs_url": "https://sqs.us-east-1.amazonaws.example.com/111222333/queue-name",
        "verbosity": 2,
        "visibility_seconds": 120,
        "wait_seconds": 5,
    }

    assert rec2.getMessage() == "Cycle 0: processed 0 messages"
    assert log_extra(rec2) == {
        "cycle_s": 0.0,
        "message_count": 0,
        "message_total": 0,
        "sqs_poll_s": 0,
        "cycle_num": 0,
        "queue_count": 1,
        "queue_count_delayed": 2,
        "queue_count_not_visible": 3,
        "queue_load_s": 0.0,
    }

    assert rec3.getMessage() == "Cycle 1: processed 0 messages"

    assert rec4.getMessage() == "Exiting process_emails_from_sqs"
    assert log_extra(rec4) == {
        "exit_on": "max_seconds",
        "cycles": 2,
        "total_s": 4.0,
        "total_messages": 0,
    }


def test_metrics(test_settings: SettingsWrapper, caplog: LogCaptureFixture) -> None:
    """The command emits metrics on the SQS queue backlog."""
    test_settings.STATSD_ENABLED = True
    test_settings.PROCESS_EMAIL_MAX_SECONDS = 2
    with MetricsMock() as mm:
        call_command(COMMAND_NAME)
    assert summary_from_exit_log(caplog)["cycles"] == 1
    mm.assert_gauge("fx.private.relay.email_queue_count", 1, ["queue:queue-name"])
    mm.assert_gauge(
        "fx.private.relay.email_queue_count_delayed", 2, ["queue:queue-name"]
    )
    mm.assert_gauge(
        "fx.private.relay.email_queue_count_not_visible", 3, ["queue:queue-name"]
    )


def test_one_message(
    mock_verify_from_sns: Mock,
    mock_sns_inbound_logic: Mock,
    mock_sqs_client: Mock,
    caplog: LogCaptureFixture,
) -> None:
    """The command will process an available message."""
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)

    msg_log = caplog.records[1]
    assert msg_log.getMessage() == "Message processed"
    msg_extra = log_extra(msg_log)
    assert set(msg_extra.keys()) == {
        "message_process_time_s",
        "sqs_message_id",
        "success",
        "subprocess_setup_time_s",
    }
    assert msg_extra["success"]

    assert summary_from_exit_log(caplog)["total_messages"] == 1

    mock_verify_from_sns.assert_called_once_with(TEST_SNS_MESSAGE)
    mock_sns_inbound_logic.assert_called_once_with(
        "arn:aws:sns:us-east-1:927034868273:fxprivaterelay-SES-processor-topic",
        "Notification",
        TEST_SNS_MESSAGE,
    )


def test_keyboard_interrupt(
    mock_sqs_client: Mock, caplog: LogCaptureFixture, test_settings: SettingsWrapper
) -> None:
    """The command halts on Ctrl-C."""
    test_settings.PROCESS_EMAIL_MAX_SECONDS = None
    mock_sqs_client.return_value = fake_queue([], KeyboardInterrupt())
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["cycles"] == 1
    assert summary["exit_on"] == "interrupt"


def test_no_body(mock_sqs_client: Mock, caplog: LogCaptureFixture) -> None:
    """The command skips a message without a JSON body."""
    msg = fake_sqs_message("I am a string, not JSON")
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["failed_messages"] == 1
    assert summary["cycles"] == 2
    msg.delete.assert_not_called()


def test_no_body_deleted(
    mock_sqs_client: Mock, caplog: LogCaptureFixture, test_settings: SettingsWrapper
) -> None:
    """The command deletes a message without a JSON body."""
    test_settings.PROCESS_EMAIL_DELETE_FAILED_MESSAGES = True
    msg = fake_sqs_message("I am a string, not JSON")
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["failed_messages"] == 1
    assert summary["cycles"] == 2
    msg.delete.assert_called_once_with()


def test_ses_temp_failure(
    test_settings: SettingsWrapper,
    mock_sns_inbound_logic: Mock,
    mock_sqs_client: Mock,
    caplog: LogCaptureFixture,
) -> None:
    """
    The command no longer retries a message with a temporary SES failure.

    The retry logic was removed in May 2024 when no throttling or pause errors were
    registered in the previous 6 months.
    """
    test_settings.PROCESS_EMAIL_MAX_SECONDS = 2
    temp_error = make_client_error(
        "Maximum sending rate exceeded.", "ThrottlingException"
    )
    mock_sns_inbound_logic.side_effect = temp_error
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1
    msg.delete.assert_not_called()


def test_ses_generic_failure(
    mock_sns_inbound_logic: Mock, mock_sqs_client: Mock, caplog: LogCaptureFixture
) -> None:
    """The command does not retry generic SES failures."""
    internal_error = make_client_error(code="InternalError")
    mock_sns_inbound_logic.side_effect = (internal_error, None)
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1
    msg.delete.assert_not_called()


def test_ses_python_error(
    mock_sns_inbound_logic: Mock,
    mock_sqs_client: Mock,
    test_settings: SettingsWrapper,
    caplog: LogCaptureFixture,
) -> None:
    """The command catches processing failures."""
    test_settings.PROCESS_EMAIL_MAX_SECONDS = 2
    mock_sns_inbound_logic.side_effect = ValueError("bad stuff")
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1
    msg.delete.assert_not_called()
    rec2 = caplog.records[1]
    assert rec2.msg == "Message processed"
    rec2_extra = log_extra(rec2)
    assert rec2_extra["success"] is False
    assert rec2_extra["error_type"] == "ValueError"
    assert rec2_extra["error"] == "bad stuff"


def test_ses_slow(
    mock_sns_inbound_logic: Mock,
    mock_sqs_client: Mock,
    mock_process_pool_future: Mock,
    test_settings: SettingsWrapper,
    caplog: LogCaptureFixture,
) -> None:
    test_settings.PROCESS_EMAIL_MAX_SECONDS_PER_MESSAGE = 120
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [], [])
    mock_process_pool_future._is_stalled.side_effect = [True, True, False]
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    msg.delete.assert_called()
    rec2 = caplog.records[1]
    assert rec2.msg == "Message processed"
    rec2_extra = log_extra(rec2)
    assert rec2_extra["success"] is True
    assert rec2_extra["message_process_time_s"] < 120.0
    assert rec2_extra["subprocess_setup_time_s"] == 1.0
    # future.wait(1.0) was called 3 times, was ready after the 3rd call.
    assert mock_process_pool_future._timeouts == [1.0] * 3


def test_ses_timeout(
    mock_sns_inbound_logic: Mock,
    mock_sqs_client: Mock,
    mock_process_pool_future: Mock,
    test_settings: SettingsWrapper,
    caplog: LogCaptureFixture,
) -> None:
    test_settings.PROCESS_EMAIL_MAX_SECONDS_PER_MESSAGE = 120
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [], [])
    mock_process_pool_future._is_stalled.return_value = True
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1
    msg.delete.assert_not_called()
    rec2 = caplog.records[1]
    assert rec2.msg == "Message processed"
    rec2_extra = log_extra(rec2)
    assert rec2_extra["success"] is False
    assert rec2_extra["error"] == "Timed out after 120.0 seconds."
    assert rec2_extra["message_process_time_s"] >= 120.0
    assert rec2_extra["subprocess_setup_time_s"] == 1.0
    assert mock_process_pool_future._timeouts == [1.0] * 120


def test_verify_from_sns_raises_openssl_error(
    mock_verify_from_sns: Mock, mock_sqs_client: Mock, caplog: LogCaptureFixture
) -> None:
    """If verify_from_sns raises an exception, the message is deleted."""
    mock_verify_from_sns.side_effect = OpenSSL.crypto.Error("failed")
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1


def test_verify_from_sns_raises_keyerror(
    mock_verify_from_sns: Mock, mock_sqs_client: Mock, caplog: LogCaptureFixture
) -> None:
    """If verify_from_sns raises an exception, the message is deleted."""
    mock_verify_from_sns.side_effect = KeyError("SigningCertURL")
    msg = fake_sqs_message('{"json": "yes", "from_sns": "na"}')
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1


def test_verify_sns_header_fails(
    test_settings: SettingsWrapper, mock_sqs_client: Mock, caplog: LogCaptureFixture
) -> None:
    """Invalid SNS headers fail."""
    test_settings.AWS_SNS_TOPIC = {"arn:aws:sns:us-east-1:111122223333:not-relay"}
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1


def test_writes_healthcheck_file(test_settings: SettingsWrapper) -> None:
    """Running the command writes to the healthcheck file."""
    call_command("process_emails_from_sqs")
    healthcheck_path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    with open(healthcheck_path, encoding="utf-8") as healthcheck_file:
        content = json.load(healthcheck_file)
    assert content == {
        "timestamp": content["timestamp"],
        "cycles": 2,
        "total_messages": 0,
        "failed_messages": 0,
        "pause_count": 0,
        "queue_count": 1,
        "queue_count_delayed": 2,
        "queue_count_not_visible": 3,
    }
    ts = datetime.fromisoformat(content["timestamp"])
    duration = (datetime.now(tz=UTC) - ts).total_seconds()
    assert 0.0 < duration < 0.5


def test_command_sqs_client_error(
    mock_sqs_client: Mock, test_settings: SettingsWrapper
) -> None:
    """The command fails early on a client error."""
    mock_sqs_client.side_effect = make_client_error(code="InternalError")
    with pytest.raises(CommandError) as err:
        call_command(COMMAND_NAME)
    assert str(err.value) == "Unable to connect to SQS"
    mock_sqs_client.assert_called_once_with(test_settings.AWS_SQS_EMAIL_QUEUE_URL)
