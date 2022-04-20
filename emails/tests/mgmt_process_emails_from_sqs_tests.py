from datetime import datetime, timezone
from io import StringIO
from unittest.mock import patch, Mock
from uuid import uuid4
import json

from botocore.exceptions import ClientError
from markus.testing import MetricsMock
import boto3
import pytest
import OpenSSL

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from emails.management.commands.process_emails_from_sqs import Command
from emails.tests.views_tests import EMAIL_SNS_BODIES


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
def use_test_topic_arn(settings):
    settings.AWS_SNS_TOPIC = {TEST_SNS_MESSAGE['TopicArn']}
    return settings


@pytest.fixture()
def mock_boto3_queue_constructor():
    """Mock a queue created by boto3.resource('sqs').Queue()"""

    mock_queue = Mock(spec_set=["Queue"])

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


def test_process_queue_no_messages():
    """process_queue can exit after the max time and processing no messages."""
    res = Command(queue=fake_queue(), max_seconds=3).process_queue()
    assert res == {
        "exit_on": "max_seconds",
        "cycles": 2,
        "total_s": 4.0,
        "total_messages": 0,
    }


@override_settings(
    STATSD_ENABLED=True,
    AWS_SQS_EMAIL_QUEUE_URL="https://sqs.us-east-1.amazonaws.example.com/111222333/queue-name",
)
def test_process_queue_metrics():
    """process_queue emits metrics on the SQS queue backlog."""
    with MetricsMock() as mm:
        res = Command(queue=fake_queue(), max_seconds=2).process_queue()
    assert res["cycles"] == 1
    mm.assert_gauge("fx.private.relay.email_queue_count", 1, ["queue:queue-name"])
    mm.assert_gauge(
        "fx.private.relay.email_queue_count_delayed", 2, ["queue:queue-name"]
    )
    mm.assert_gauge(
        "fx.private.relay.email_queue_count_not_visible", 3, ["queue:queue-name"]
    )


def test_process_queue_one_message(mock_verify_from_sns, mock_sns_inbound_logic):
    """process_queue will process an available message."""
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    res = Command(queue=fake_queue([msg], []), max_seconds=3).process_queue()
    assert res["total_messages"] == 1
    mock_verify_from_sns.assert_called_once_with(TEST_SNS_MESSAGE)
    mock_sns_inbound_logic.assert_called_once_with(
        "arn:aws:sns:us-east-1:927034868273:fxprivaterelay-SES-processor-topic",
        "Notification",
        TEST_SNS_MESSAGE,
    )


def test_process_queue_keyboard_interrupt():
    """process_queue halts on Ctrl-C."""
    queue = fake_queue()
    res = Command(queue=fake_queue([], KeyboardInterrupt())).process_queue()
    assert res["cycles"] == 1
    assert res["exit_on"] == "interrupt"


def test_process_queue_no_body():
    """process_queue skips a message without a JSON body."""
    msg = fake_sqs_message("I am a string, not JSON")
    res = Command(queue=fake_queue([msg], []), max_seconds=3).process_queue()
    assert res["failed_messages"] == 1
    assert res["cycles"] == 2
    msg.delete.assert_not_called()


def test_process_queue_no_body_deleted():
    """process_queue deletes a message without a JSON body."""
    msg = fake_sqs_message("I am a string, not JSON")
    res = Command(
        queue=fake_queue([msg], []), max_seconds=3, delete_failed_messages=True
    ).process_queue()
    assert res["failed_messages"] == 1
    assert res["cycles"] == 2
    msg.delete.assert_called_once_with()


def test_process_queue_ses_temp_failure_retry(mock_sns_inbound_logic):
    """process_queue retries a message with a temporary SES failure."""
    temp_error = make_client_error(
        "Maximum sending rate exceeded.", "ThrottlingException"
    )
    mock_sns_inbound_logic.side_effect = (temp_error, None)
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    res = Command(queue=fake_queue([msg], []), max_seconds=4).process_queue()
    assert res["total_messages"] == 1
    assert res["pause_count"] == 1


def test_process_queue_ses_temp_failure_twice(mock_sns_inbound_logic):
    """A temporary error followed by a second error is not retried."""
    temp_error = make_client_error(
        "Email sending has been disabled.", "AccountSendingPausedException"
    )
    mock_sns_inbound_logic.side_effect = (temp_error, temp_error)
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    res = Command(queue=fake_queue([msg], []), max_seconds=4).process_queue()
    assert res["total_messages"] == 1
    assert res["failed_messages"] == 1
    assert res["pause_count"] == 1
    msg.delete.assert_not_called()


def test_process_queue_ses_generic_failure(mock_sns_inbound_logic):
    """process_queue does not retry generic SES failures."""
    internal_error = make_client_error(code="InternalError")
    mock_sns_inbound_logic.side_effect = (internal_error, None)
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    res = Command(queue=fake_queue([msg], []), max_seconds=3).process_queue()
    assert res["total_messages"] == 1
    assert res["failed_messages"] == 1


def test_process_queue_verify_from_sns_raises_openssl_error(mock_verify_from_sns):
    """If verify_from_sns raises an exception, the message is deleted."""
    mock_verify_from_sns.side_effect = OpenSSL.crypto.Error("failed")
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    res = Command(queue=fake_queue([msg], []), max_seconds=3).process_queue()
    assert res["total_messages"] == 1
    assert res["failed_messages"] == 1


def test_process_queue_verify_from_sns_raises_keyerror(mock_verify_from_sns):
    """If verify_from_sns raises an exception, the message is deleted."""
    mock_verify_from_sns.side_effect = KeyError("SigningCertURL")
    msg = fake_sqs_message('{"json": "yes", "from_sns": "na"}')
    res = Command(queue=fake_queue([msg], []), max_seconds=3).process_queue()
    assert res["total_messages"] == 1
    assert res["failed_messages"] == 1


def test_process_queue_verify_sns_header_fails(use_test_topic_arn):
    """Invalid SNS headers fail."""
    use_test_topic_arn.AWS_SNS_TOPIC={"arn:aws:sns:us-east-1:111122223333:not-relay"}
    msg = fake_sqs_message(json.dumps(TEST_SNS_MESSAGE))
    res = Command(queue=fake_queue([msg], []), max_seconds=3).process_queue()
    assert res["total_messages"] == 1
    assert res["failed_messages"] == 1


@override_settings(
    AWS_REGION="us-east-2",
    AWS_SQS_EMAIL_QUEUE_URL="https://sqs.us-east-2.amazonaws.example.com/111222333/queue-name",
)
def test_command_successful_setup(mock_boto3_queue_constructor):
    """The command constructs a Queue from Django settings."""
    mock_boto3_queue_constructor.return_value = fake_queue()
    call_command("process_emails_from_sqs", "--max-seconds=4")
    mock_boto3_queue_constructor.assert_called_once_with(
        "https://sqs.us-east-2.amazonaws.example.com/111222333/queue-name"
    )
    assert mock_boto3_queue_constructor._mock_region == "us-east-2"


def test_command_sqs_client_error(mock_boto3_queue_constructor):
    """The command fails early on a client error."""
    mock_boto3_queue_constructor.side_effect = make_client_error(code="InternalError")
    with pytest.raises(CommandError):
        call_command(
            "process_emails_from_sqs",
            "--aws-region=us-east-1",
            "--sqs-url=https://sqs.us-east-1.amazonaws.example.com/444555666/other-queue",
        )
    mock_boto3_queue_constructor.assert_called_once_with(
        "https://sqs.us-east-1.amazonaws.example.com/444555666/other-queue"
    )


def test_write_healthcheck(tmp_path):
    """write_healthcheck writes the timestamp to the specified path."""
    healthcheck_path = tmp_path / "healthcheck.json"
    with open(healthcheck_path, "w", encoding="utf8") as hc_file:
        Command(queue=fake_queue(), healthcheck_file=hc_file).write_healthcheck()
    content = json.loads(healthcheck_path.read_bytes())
    assert content == {
        "timestamp": content["timestamp"],
        "cycles": None,
        "total_messages": None,
        "failed_messages": None,
        "pause_count": None,
        "queue_count": 1,
        "queue_count_delayed": 2,
        "queue_count_not_visible": 3,
    }
    ts = datetime.fromisoformat(content["timestamp"])
    duration = (datetime.now(tz=timezone.utc) - ts).total_seconds()
    assert 0.0 < duration < 0.5
