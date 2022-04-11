"""
Process the SQS email queue.

The SQS queue is processed using the long poll method, which waits until at
least one message is available, or wait_seconds is reached.

See:
https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-short-and-long-polling.html#sqs-long-polling
https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sqs.html#SQS.Queue.receive_messages
"""

from datetime import datetime, timezone
from urllib.parse import urlsplit
import json
import logging
import shlex
import time

import boto3
from botocore.exceptions import ClientError
from codetiming import Timer
from markus.utils import generate_tag
import OpenSSL

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from emails.views import _sns_inbound_logic, validate_sns_header, verify_from_sns
from emails.utils import incr_if_enabled, gauge_if_enabled

logger = logging.getLogger("eventsinfo.process_emails_from_sqs")


class Command(BaseCommand):
    help = "Fetch email tasks from SQS and process them."

    DEFAULT_BATCH_SIZE = 10
    DEFAULT_WAIT_SECONDS = 5
    DEFAULT_VISIBILITY_SECONDS = 120

    def __init__(
        self,
        *args,
        batch_size=None,
        wait_seconds=None,
        visibility_seconds=None,
        healthcheck_path=None,
        delete_failed_messages=False,
        max_seconds=None,
        aws_region=None,
        sqs_url=None,
        queue=None,
        **kwargs,
    ):
        """Initialize variables via constructor."""
        super().__init__(*args, **kwargs)
        self.init_vars(
            batch_size=batch_size,
            wait_seconds=wait_seconds,
            visibility_seconds=visibility_seconds,
            healthcheck_path=healthcheck_path,
            delete_failed_messages=delete_failed_messages,
            max_seconds=max_seconds,
            aws_region=aws_region,
            sqs_url=sqs_url,
            queue=queue,
        )

    def init_vars(
        self,
        *,
        batch_size=None,
        wait_seconds=None,
        visibility_seconds=None,
        healthcheck_path=None,
        delete_failed_messages=False,
        max_seconds=None,
        aws_region=None,
        sqs_url=None,
        queue=None,
        **kwargs,
    ):
        """Initialize command variables"""
        self.batch_size = batch_size or self.DEFAULT_BATCH_SIZE
        self.wait_seconds = wait_seconds or self.DEFAULT_WAIT_SECONDS
        self.visibility_seconds = visibility_seconds or self.DEFAULT_VISIBILITY_SECONDS
        self.healthcheck_path = healthcheck_path
        self.delete_failed_messages = delete_failed_messages
        self.max_seconds = max_seconds
        self.aws_region = aws_region or settings.AWS_REGION
        self.sqs_url = sqs_url or settings.AWS_SQS_EMAIL_QUEUE_URL

        self.queue = queue
        self.queue_name = urlsplit(self.sqs_url).path.split("/")[-1]
        self.halt_requested = False
        self.start_time = None
        self.cycles = None
        self.total_messages = None
        self.failed_messages = None
        self.pause_count = None

        assert 0 < self.batch_size <= 10
        assert self.wait_seconds > 0
        assert self.visibility_seconds > 0
        assert self.max_seconds is None or self.max_seconds > 0.0

    def add_arguments(self, parser):
        """Add command-line arguments (called by BaseCommand)"""
        parser.add_argument(
            "--batch-size",
            type=int,
            default=self.DEFAULT_BATCH_SIZE,
            choices=range(1, self.DEFAULT_BATCH_SIZE + 1),
            help="Number of SQS messages to fetch at a time",
        )
        parser.add_argument(
            "--wait-seconds",
            type=int,
            default=self.DEFAULT_WAIT_SECONDS,
            help="Time to wait for messages with long polling",
        )
        parser.add_argument(
            "--visibility-seconds",
            type=int,
            default=self.DEFAULT_VISIBILITY_SECONDS,
            help="Time to mark a message as reserved for this process",
        )
        parser.add_argument(
            "--healthcheck-path",
            help="Path to file to write healthcheck data",
        )
        parser.add_argument(
            "--delete-failed-messages",
            action="store_true",
            help=(
                "If a message fails to process, delete it from the queue, "
                " instead of letting SQS resend or move to a dead-letter queue,"
            ),
        )
        parser.add_argument(
            "--max-seconds",
            type=int,
            help=f"Maximum time to process before exiting",
        )
        parser.add_argument(
            "--aws-region", help="AWS region, defaults to settings.AWS_REGION"
        )
        parser.add_argument(
            "--sqs-url", help="SQS URL, defaults to AWS_SQS_EMAIL_QUEUE_URL"
        )

    def handle(self, *args, **kwargs):
        """Handle call from command line (called by BaseCommand)"""
        self.init_vars(*args, **kwargs)
        logger.info(
            "Starting process_emails_from_sqs",
            extra={
                "batch_size": self.batch_size,
                "wait_seconds": self.wait_seconds,
                "visibility_seconds": self.visibility_seconds,
                "healthcheck_path": self.healthcheck_path,
                "delete_failed_messages": self.delete_failed_messages,
                "max_seconds": self.max_seconds,
                "aws_region": self.aws_region,
                "sqs_url": self.sqs_url,
            },
        )

        try:
            self.queue = self.create_client()
        except ClientError as e:
            raise CommandError("Unable to connect to SQS") from e

        exec_stats = self.main_loop()
        logger.info("Exiting process_emails_from_sqs", extra=exec_stats)

    def create_client(self):
        """Create the SQS client."""
        assert self.aws_region
        assert self.sqs_url
        sqs_client = boto3.resource("sqs", region_name=self.aws_region)
        return sqs_client.Queue(self.sqs_url)

    def main_loop(self):
        """
        Process the SQS email queue until an exit condition is reached.

        Return is a dict suitable for logging context, with these keys:
        * exit_on: Why the loop exited - "interrupt", "max_seconds", "unknown"
        * cycles: How many polling cycles completed
        * total_s: The total execution time, in seconds with millisecond precision
        * total_messages: The number of messages processed, with and without errors
        * failed_messages: The number of messages that failed with errors, omitted if none
        * pause_count: The number of 1-second pauses due to temporary errors
        """
        exit_on = "unknown"
        self.cycles = 0
        self.total_messages = 0
        self.failed_messages = 0
        self.pause_count = 0
        self.start_time = time.monotonic()

        while not self.halt_requested:
            try:
                with Timer(logger=None) as attribute_timer:
                    self.queue.load()  # Refresh attributes
                self.write_healthcheck()
                incr_if_enabled("message_from_sqs_error", 1)
                gauge_if_enabled(
                    "email_queue_count",
                    self.queue.attributes["ApproximateNumberOfMessages"],
                    tags=[generate_tag("queue", self.queue_name)],
                )
                gauge_if_enabled(
                    "email_queue_count_delayed",
                    self.queue.attributes["ApproximateNumberOfMessagesDelayed"],
                    tags=[generate_tag("queue", self.queue_name)],
                )
                gauge_if_enabled(
                    "email_queue_count_not_visible",
                    self.queue.attributes["ApproximateNumberOfMessagesNotVisible"],
                    tags=[generate_tag("queue", self.queue_name)],
                )

                cycle_data = {
                    "cycle_num": self.cycles,
                    "cycle_s": 0.0,
                    "queue_attributes_s": round(attribute_timer.last, 3),
                    "queue_count": self.queue.attributes["ApproximateNumberOfMessages"],
                    "queue_count_delayed": self.queue.attributes[
                        "ApproximateNumberOfMessagesDelayed"
                    ],
                    "queue_count_not_visible": self.queue.attributes[
                        "ApproximateNumberOfMessagesNotVisible"
                    ],
                }
                if self.max_seconds is not None:
                    elapsed = time.monotonic() - self.start_time
                    if elapsed >= self.max_seconds:
                        exit_on = "max_seconds"
                        break

                with Timer(logger=None) as cycle_timer:
                    cycle_data.update(self.cycle_loop())
                message_count = cycle_data.get("message_count", 0)
                self.total_messages += message_count
                self.failed_messages += cycle_data.get("failed_count", 0)
                self.pause_count += cycle_data.get("pause_count", 0)
                cycle_data["message_total"] = self.total_messages
                cycle_data["cycle_s"] = round(cycle_timer.last, 3)
                logger.log(
                    logging.INFO if message_count else logging.DEBUG,
                    f"Cycle {self.cycles}: processed {self.pluralize(message_count, 'message')}",
                    extra=cycle_data,
                )
                self.cycles += 1
            except KeyboardInterrupt:
                self.halt_requested = True
                exit_on = "interrupt"

        loop_data = {
            "exit_on": exit_on,
            "cycles": self.cycles,
            "total_s": round(time.monotonic() - self.start_time, 3),
            "total_messages": self.total_messages,
        }
        if self.failed_messages:
            loop_data["failed_messages"] = self.failed_messages
        if self.pause_count:
            loop_data["pause_count"] = self.pause_count
        return loop_data

    def cycle_loop(self):
        """
        Request and process a batch of messages, using long-poll method.

        Return is a dict suitable for logging context, with these keys:
        * message_count: How many messages were returned from SQS
        * sqs_poll_s: How long the ReceiveMessage call took
        * process_s: How long processing took, omitted if no messages
        * pause_count: How many pauses were taken for temporary errors, omitted if 0
        * pause_s: How long pauses took, omitted if no pauses
        * failed_count: How many messages failed to process, omitted if 0

        Times are in seconds, with millisecond precision
        """
        with Timer(logger=None) as poll_timer:
            messages = self.queue.receive_messages(
                MaxNumberOfMessages=self.batch_size,
                VisibilityTimeout=self.visibility_seconds,
                WaitTimeSeconds=self.wait_seconds,
            )
        message_count = len(messages)
        failed_count = 0
        pause_time = 0.0
        pause_count = 0
        process_time = 0.0
        for message in messages:
            with Timer(logger=None) as message_timer:
                message_data = self.process_message(message)
                if message_data["success"]:
                    message.delete()
                else:
                    failed_count += 1
                    if self.delete_failed_messages:
                        message.delete()
                pause_time += message_data.get("pause_s", 0.0)
                pause_count += message_data.get("pause_count", 0)

            message_data["message_process_time_s"] = round(message_timer.last, 3)
            process_time += message_timer.last
            logger.log(
                logging.DEBUG if message_data["success"] else logging.INFO,
                "Message processed",
                extra=message_data,
            )

        loop_data = {
            "message_count": message_count,
            "sqs_poll_s": round(poll_timer.last, 3),
        }
        if message_count:
            if pause_count:
                loop_data["process_s"] = round((process_time - pause_time), 3)
                loop_data["pause_count"] = pause_count
                loop_data["pause_s"] = round(pause_time, 3)
            else:
                loop_data["process_s"] = round(process_time, 3)
        if failed_count:
            loop_data["failed_count"] = failed_count
        return loop_data

    def process_message(self, message):
        """
        Process an SQS message, which may include sending an email.

        Return is a dict suitable for logging context, with these keys:
        * success: True if message was processed successfully
        * error: The processing error, omitted on success
        * message_body_quoted: Set if the message was non-JSON, omitted for valid JSON
        * json_body: Set to the JSON on SNS verification failures, or omitted on verified
        * pause_count: Set to 1 if paused due to temporary error, or omitted with no error
        * pause_s: The pause in seconds (ms precision) for temp error, or omitted
        * pause_error: The temporary error, or omitted if no temp error
        * client_error_code: The error code for non-temp or retry error, omitted on success
        """
        incr_if_enabled("process_message_from_sqs", 1)
        results = {"success": True, "sqs_message_id": message.message_id}
        raw_body = message.body
        try:
            json_body = json.loads(raw_body)
        except ValueError as e:
            results.update(
                {
                    "success": False,
                    "error": f"Failed to load message.body: {e}",
                    "message_body_quoted": shlex.quote(raw_body),
                }
            )
            return results
        try:
            verified_json_body = verify_from_sns(json_body)
        except (KeyError, OpenSSL.crypto.Error) as e:
            logger.error(
                "Failed SNS verification", extra={"error": str(e), "body": json_body}
            )
            results.update(
                {
                    "success": False,
                    "error": f"Failed SNS verification: {e}",
                    "json_body": json_body,
                }
            )
            return results

        topic_arn = verified_json_body["TopicArn"]
        message_type = verified_json_body["Type"]
        validate_sns_header(topic_arn, message_type)
        try:
            _sns_inbound_logic(topic_arn, message_type, verified_json_body)
        except ClientError as e:
            incr_if_enabled("message_from_sqs_error", 1)
            temp_errors = ["throttling", "pause"]
            lower_error_code = e.response["Error"]["Code"].lower()
            if any(temp_error in lower_error_code for temp_error in temp_errors):
                incr_if_enabled("message_from_sqs_temp_error", 1)
                logger.error(
                    '"temporary" error, sleeping for 1s', extra=e.response["Error"]
                )
                self.write_healthcheck()
                with Timer(logger=None) as sleep_timer:
                    time.sleep(1)
                results["pause_count"] = 1
                results["pause_s"] = round(sleep_timer.last, 3)
                results["pause_error"] = e.response["Error"]

                try:
                    _sns_inbound_logic(topic_arn, message_type, verified_json_body)
                    logger.info(f"processed sqs message ID: {message.message_id}")
                except ClientError as e:
                    incr_if_enabled("message_from_sqs_error", 1)
                    logger.error("sqs_client_error", extra=e.response["Error"])
                    results.update(
                        {
                            "success": False,
                            "error": e.response["Error"],
                            "client_error_code": lower_error_code,
                        }
                    )
            else:
                logger.error("sqs_client_error", extra=e.response["Error"])
                results.update(
                    {
                        "success": False,
                        "error": e.response["Error"],
                        "client_error_code": lower_error_code,
                    }
                )
        return results

    def write_healthcheck(self):
        """Update the healthcheck file with operations data, if path is set."""
        if not self.healthcheck_path:
            return
        with open(self.healthcheck_path, "w", encoding="utf8") as health_file:
            data = {
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                "cycles": self.cycles,
                "total_messages": self.total_messages,
                "failed_messages": self.failed_messages,
                "pause_count": self.pause_count,
                "queue_count": self.queue.attributes["ApproximateNumberOfMessages"],
                "queue_count_delayed": self.queue.attributes[
                    "ApproximateNumberOfMessagesDelayed"
                ],
                "queue_count_not_visible": self.queue.attributes[
                    "ApproximateNumberOfMessagesNotVisible"
                ],
            }
            json.dump(data, health_file)

    def pluralize(self, value, singular, plural=None):
        """Returns 's' suffix to make plural, like 's' in tasks"""
        if value == 1:
            return f"{value} {singular}"
        else:
            return f"{value} {plural or (singular + 's')}"
