from datetime import datetime, timezone
from io import StringIO
from unittest.mock import patch, Mock
from uuid import uuid4, UUID
import json

from botocore.exceptions import ClientError
from markus.testing import MetricsMock
import boto3
import pytest
import OpenSSL

from django.core.management import call_command
from django.core.management.base import CommandError

from emails.tests.views_tests import EMAIL_SNS_BODIES


COMMAND_NAME = "process_emails_from_sqs"
MOCK_BASE = "emails.management.commands.process_emails_from_sqs"
TEST_SNS_MESSAGE = EMAIL_SNS_BODIES["s3_stored"]


@pytest.fixture(autouse=True)
def mocked_clocks():
    """
    Mock time functions, so tests run faster than real time.

    time.monotonic() with return +1 seconds each call
    time.sleep() will not sleep but will increase monotonic counter
    """
    clock = 0.0

    def inc_clock(seconds=1.0):
        nonlocal clock
        clock += seconds
        return clock

    with patch(f"{MOCK_BASE}.time.monotonic") as mock_monotonic:
        with patch(f"{MOCK_BASE}.time.sleep") as mock_sleep:
            mock_monotonic.side_effect = inc_clock
            mock_sleep.side_effect = inc_clock
            yield (mock_monotonic, mock_sleep)


@pytest.fixture(autouse=True)
def mock_verify_from_sns():
    """Mock verify_from_sns(json_body) to return JSON"""
    with patch(f"{MOCK_BASE}.verify_from_sns") as mock_verify_from_sns:
        mock_verify_from_sns.side_effect = lambda msg_json: msg_json
        yield mock_verify_from_sns


@pytest.fixture(autouse=True)
def mock_sns_inbound_logic():
    """Mock _sns_inbound_logic(topic_arn, message_type, json_body) to do nothing"""
    with patch(f"{MOCK_BASE}._sns_inbound_logic") as mock_sns_inbound_logic:
        yield mock_sns_inbound_logic


@pytest.fixture(autouse=True)
def test_settings(settings, tmp_path):
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
    return settings


@pytest.fixture(autouse=True)
def mock_sqs_client():
    """Mock a queue created by boto3.resource('sqs').Queue()"""

    mock_queue = Mock(spec_set=["Queue"])
    mock_queue.Queue.return_value = fake_queue()

    def validate_call(resource_type, region_name):
        nonlocal mock_queue
        assert resource_type == "sqs"
        mock_queue.Queue._mock_region = region_name
        return mock_queue

    with patch(f"{MOCK_BASE}.boto3.resource") as mock_resource:
        mock_resource.side_effect = validate_call
        yield mock_queue.Queue


def fake_queue(*message_lists):
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


def fake_sqs_message(body):
    """
    Create a fake SQS message

    Only includes some attributes. For full spec, see:
    https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sqs.html#message
    """
    msg = Mock(spec_set=("queue_url", "receipt_handle", "body", "message_id", "delete"))
    msg.queue_url = (
        "https://sqs.us-east-1.amazonaws.example.com/123456789012/queue-name"
    )
    msg.receipt_handle = uuid4()
    msg.body = body
    msg.message_id = uuid4()
    return msg


def make_client_error(message="Unknown", code="Unknown", operation_name="Unknown"):
    """Create a minimal botocore.exceptions.ClientError"""
    err_response = {"Error": {"Message": message, "Code": code}}
    return ClientError(err_response, operation_name)


def log_extra(log_record):
    """Reconstruct the "extra" argument to the log call"""
    omit_log_record_keys = set(
        (
            "args",
            "created",
            "exc_info",
            "exc_text",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "message",
            "module",
            "msecs",
            "msg",
            "name",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "stack_info",
            "thread",
            "threadName",
        )
    )
    return {
        key: val
        for key, val in log_record.__dict__.items()
        if key not in omit_log_record_keys
    }


def summary_from_exit_log(caplog_fixture):
    """Get the extra data from the final log message"""
    last_log = caplog_fixture.records[-1]
    assert last_log.message == f"Exiting {COMMAND_NAME}"
    return log_extra(last_log)


def test_no_messages(caplog, test_settings):
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
    }

    assert rec3.getMessage() == "Cycle 1: processed 0 messages"

    assert rec4.getMessage() == "Exiting process_emails_from_sqs"
    assert log_extra(rec4) == {
        "exit_on": "max_seconds",
        "cycles": 2,
        "total_s": 4.0,
        "total_messages": 0,
    }


def test_metrics(test_settings, caplog):
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
    mock_verify_from_sns, mock_sns_inbound_logic, mock_sqs_client, caplog
):
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
    }
    assert msg_extra["success"]

    assert summary_from_exit_log(caplog)["total_messages"] == 1

    mock_verify_from_sns.assert_called_once_with(TEST_SNS_MESSAGE)
    mock_sns_inbound_logic.assert_called_once_with(
        "arn:aws:sns:us-east-1:927034868273:fxprivaterelay-SES-processor-topic",
        "Notification",
        TEST_SNS_MESSAGE,
    )


def test_keyboard_interrupt(mock_sqs_client, caplog, test_settings):
    """The command halts on Ctrl-C."""
    test_settings.PROCESS_EMAIL_MAX_SECONDS = None
    mock_sqs_client.return_value = fake_queue([], KeyboardInterrupt)
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["cycles"] == 1
    assert summary["exit_on"] == "interrupt"


def test_no_body(mock_sqs_client, caplog):
    """The command skips a message without a JSON body."""
    msg = fake_sqs_message("I am a string, not JSON")
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["failed_messages"] == 1
    assert summary["cycles"] == 2
    msg.delete.assert_not_called()


def test_no_body_deleted(mock_sqs_client, caplog, test_settings):
    """The command deletes a message without a JSON body."""
    test_settings.PROCESS_EMAIL_DELETE_FAILED_MESSAGES = True
    msg = fake_sqs_message("I am a string, not JSON")
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["failed_messages"] == 1
    assert summary["cycles"] == 2
    msg.delete.assert_called_once_with()


def test_ses_temp_failure_retry(
    test_settings,
    mock_sns_inbound_logic,
    mock_sqs_client,
    caplog,
):
    """The command retries a message with a temporary SES failure."""
    test_settings.PROCESS_EMAIL_MAX_SECONDS = 4
    temp_error = make_client_error(
        "Maximum sending rate exceeded.", "ThrottlingException"
    )
    mock_sns_inbound_logic.side_effect = (temp_error, None)
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["pause_count"] == 1
    msg.delete.assert_called_once_with()


def test_ses_temp_failure_twice(
    test_settings, mock_sns_inbound_logic, mock_sqs_client, caplog
):
    """A temporary error followed by a second error is not retried."""
    test_settings.PROCESS_EMAIL_MAX_SECONDS = 4
    temp_error = make_client_error(
        "Email sending has been disabled.", "AccountSendingPausedException"
    )
    mock_sns_inbound_logic.side_effect = (temp_error, temp_error)
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1
    assert summary["pause_count"] == 1
    msg.delete.assert_not_called()


def test_ses_generic_failure(mock_sns_inbound_logic, mock_sqs_client, caplog):
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


def test_verify_from_sns_raises_openssl_error(
    mock_verify_from_sns, mock_sqs_client, caplog
):
    """If verify_from_sns raises an exception, the message is deleted."""
    mock_verify_from_sns.side_effect = OpenSSL.crypto.Error("failed")
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1


def test_verify_from_sns_raises_keyerror(mock_verify_from_sns, mock_sqs_client, caplog):
    """If verify_from_sns raises an exception, the message is deleted."""
    mock_verify_from_sns.side_effect = KeyError("SigningCertURL")
    msg = fake_sqs_message('{"json": "yes", "from_sns": "na"}')
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1


def test_verify_sns_header_fails(test_settings, mock_sqs_client, caplog):
    """Invalid SNS headers fail."""
    test_settings.AWS_SNS_TOPIC = {"arn:aws:sns:us-east-1:111122223333:not-relay"}
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    mock_sqs_client.return_value = fake_queue([msg], [])
    call_command(COMMAND_NAME)
    summary = summary_from_exit_log(caplog)
    assert summary["total_messages"] == 1
    assert summary["failed_messages"] == 1


def test_writes_healthcheck_file(test_settings):
    """Running the command writes to the healthcheck file."""
    call_command("process_emails_from_sqs")
    healthcheck_path = test_settings.PROCESS_EMAIL_HEALTHCHECK_PATH
    with open(healthcheck_path, "r", encoding="utf-8") as healthcheck_file:
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
    duration = (datetime.now(tz=timezone.utc) - ts).total_seconds()
    assert 0.0 < duration < 0.5


def test_command_sqs_client_error(mock_sqs_client, test_settings):
    """The command fails early on a client error."""
    mock_sqs_client.side_effect = make_client_error(code="InternalError")
    with pytest.raises(CommandError) as err:
        call_command(COMMAND_NAME)
    assert str(err.value) == "Unable to connect to SQS"
    mock_sqs_client.assert_called_once_with(test_settings.AWS_SQS_EMAIL_QUEUE_URL)
