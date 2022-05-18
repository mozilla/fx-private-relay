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
import gc
import json
import logging
import shlex
import time

import boto3
from botocore.exceptions import ClientError
from codetiming import Timer
from markus.utils import generate_tag
import OpenSSL

from django.core.management.base import CommandError

from emails.sns import verify_from_sns
from emails.views import _sns_inbound_logic, validate_sns_header
from emails.utils import incr_if_enabled, gauge_if_enabled
from emails.management.command_from_django_settings import (
    CommandFromDjangoSettings,
    SettingToLocal,
)

logger = logging.getLogger("eventsinfo.process_emails_from_sqs")


class Command(CommandFromDjangoSettings):
    help = "Fetch email tasks from SQS and process them."

    settings_to_locals = [
        SettingToLocal(
            "PROCESS_EMAIL_BATCH_SIZE",
            "batch_size",
            "Number of SQS messages to fetch at a time.",
            lambda batch_size: 0 < batch_size <= 10,
        ),
        SettingToLocal(
            "PROCESS_EMAIL_WAIT_SECONDS",
            "wait_seconds",
            "Time to wait for messages with long polling.",
            lambda wait_seconds: wait_seconds > 0,
        ),
        SettingToLocal(
            "PROCESS_EMAIL_VISIBILITY_SECONDS",
            "visibility_seconds",
            "Time to mark a message as reserved for this process.",
            lambda visibility_seconds: visibility_seconds > 0,
        ),
        SettingToLocal(
            "PROCESS_EMAIL_HEALTHCHECK_PATH",
            "healthcheck_path",
            "Path to file to write healthcheck data.",
            lambda healthcheck_path: healthcheck_path is not None,
        ),
        SettingToLocal(
            "PROCESS_EMAIL_DELETE_FAILED_MESSAGES",
            "delete_failed_messages",
            "If a message fails to process, delete it from the queue, instead of letting SQS resend or move to a dead-letter queue.",
            lambda delete_failed_messages: delete_failed_messages in (True, False),
        ),
        SettingToLocal(
            "PROCESS_EMAIL_MAX_SECONDS",
            "max_seconds",
            "Maximum time to process before exiting, or None to run forever.",
            lambda max_seconds: max_seconds is None or max_seconds > 0.0,
        ),
        SettingToLocal(
            "AWS_REGION",
            "aws_region",
            "AWS region of the SQS queue",
            lambda aws_region: bool(aws_region),
        ),
        SettingToLocal(
            "AWS_SQS_EMAIL_QUEUE_URL",
            "sqs_url",
            "URL of the SQL queue",
            lambda sqs_url: bool(sqs_url),
        ),
        SettingToLocal(
            "PROCESS_EMAIL_VERBOSITY",
            "verbosity",
            "Default verbosity of the process logs",
            lambda verbosity: verbosity in range(5),
        ),
    ]

    def handle(self, verbosity, *args, **kwargs):
        """Handle call from command line (called by BaseCommand)"""
        self.init_from_settings(verbosity)
        self.init_locals()
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
                "verbosity": self.verbosity,
            },
        )

        try:
            self.queue = self.create_client()
        except ClientError as e:
            raise CommandError("Unable to connect to SQS") from e

        process_data = self.process_queue()
        logger.info("Exiting process_emails_from_sqs", extra=process_data)

    def init_locals(self):
        """Initialize command attributes that don't come from settings."""
        self.queue_name = urlsplit(self.sqs_url).path.split("/")[-1]
        self.halt_requested = False
        self.start_time = None
        self.cycles = None
        self.total_messages = None
        self.failed_messages = None
        self.pause_count = None
        self.queue_count = None
        self.queue_count_delayed = None
        self.queue_count_not_visible = None

    def create_client(self):
        """Create the SQS client."""
        assert self.aws_region
        assert self.sqs_url
        sqs_client = boto3.resource("sqs", region_name=self.aws_region)
        return sqs_client.Queue(self.sqs_url)

    def process_queue(self):
        """
        Process the SQS email queue until an exit condition is reached.

        Return is a dict suitable for logging context, with these keys:
        * exit_on: Why processing exited - "interrupt", "max_seconds", "unknown"
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
                cycle_data = {
                    "cycle_num": self.cycles,
                    "cycle_s": 0.0,
                }
                cycle_data.update(self.refresh_and_emit_queue_count_metrics())
                self.write_healthcheck()

                # Check if we should exit due to time limit
                if self.max_seconds is not None:
                    elapsed = time.monotonic() - self.start_time
                    if elapsed >= self.max_seconds:
                        exit_on = "max_seconds"
                        break

                # Request and process a chunk of messages
                with Timer(logger=None) as cycle_timer:
                    message_batch, cycle_data = self.poll_queue_for_messages()
                    cycle_data.update(self.process_message_batch(message_batch))

                # Collect data and log progress
                self.total_messages += len(message_batch)
                self.failed_messages += cycle_data.get("failed_count", 0)
                self.pause_count += cycle_data.get("pause_count", 0)
                cycle_data["message_total"] = self.total_messages
                cycle_data["cycle_s"] = round(cycle_timer.last, 3)
                logger.log(
                    logging.INFO
                    if (message_batch or self.verbosity > 1)
                    else logging.DEBUG,
                    f"Cycle {self.cycles}: processed {self.pluralize(len(message_batch), 'message')}",
                    extra=cycle_data,
                )

                self.cycles += 1
                gc.collect()  # Force garbage collection of boto3 SQS client resources

            except KeyboardInterrupt:
                self.halt_requested = True
                exit_on = "interrupt"

        process_data = {
            "exit_on": exit_on,
            "cycles": self.cycles,
            "total_s": round(time.monotonic() - self.start_time, 3),
            "total_messages": self.total_messages,
        }
        if self.failed_messages:
            process_data["failed_messages"] = self.failed_messages
        if self.pause_count:
            process_data["pause_count"] = self.pause_count
        return process_data

    def refresh_and_emit_queue_count_metrics(self):
        """
        Query SQS queue attributes, store backlog metrics, and emit them as gauge stats

        Return is a dict suitable for logging context, with these keys:
        * queue_load_s: How long, in seconds (millisecond precision) it took to load attributes
        * queue_count: Approximate number of messages in queue
        * queue_count_delayed: Approx. messages not yet ready for receiving
        * queue_count_not_visible: Approx. messages reserved by other receiver

        """
        # Load attributes from SQS
        with Timer(logger=None) as attribute_timer:
            self.queue.load()

        # Save approximate queue counts
        self.queue_count = self.queue.attributes["ApproximateNumberOfMessages"]
        self.queue_count_delayed = self.queue.attributes[
            "ApproximateNumberOfMessagesDelayed"
        ]
        self.queue_count_not_visible = self.queue.attributes[
            "ApproximateNumberOfMessagesNotVisible"
        ]

        # Emit gauges for approximate queue counts
        queue_tag = generate_tag("queue", self.queue_name)
        gauge_if_enabled("email_queue_count", self.queue_count, tags=[queue_tag])
        gauge_if_enabled(
            "email_queue_count_delayed", self.queue_count_delayed, tags=[queue_tag]
        )
        gauge_if_enabled(
            "email_queue_count_not_visible",
            self.queue_count_not_visible,
            tags=[queue_tag],
        )

        return {
            "queue_load_s": round(attribute_timer.last, 3),
            "queue_count": self.queue_count,
            "queue_count_delayed": self.queue_count_delayed,
            "queue_count_not_visible": self.queue_count_not_visible,
        }

    def poll_queue_for_messages(self):
        """Request a batch of messages, using the long-poll method.

        Return is a tuple:
        * message_batch: a list of messages, which may be empty
        * data: A dict suitable for logging context, with these keys:
            - message_count: the number of messages
            - sqs_poll_s: The poll time, in seconds with millisecond precision
        """
        with Timer(logger=None) as poll_timer:
            message_batch = self.queue.receive_messages(
                MaxNumberOfMessages=self.batch_size,
                VisibilityTimeout=self.visibility_seconds,
                WaitTimeSeconds=self.wait_seconds,
            )
        return (
            message_batch,
            {
                "message_count": len(message_batch),
                "sqs_poll_s": round(poll_timer.last, 3),
            },
        )

    def process_message_batch(self, message_batch):
        """
        Process a batch of messages.

        Arguments:
        * messages - a list of SQS messages, possibly empty

        Return is a dict suitable for logging context, with these keys:
        * process_s: How long processing took, omitted if no messages
        * pause_count: How many pauses were taken for temporary errors, omitted if 0
        * pause_s: How long pauses took, omitted if no pauses
        * failed_count: How many messages failed to process, omitted if 0

        Times are in seconds, with millisecond precision
        """
        if not message_batch:
            return {}
        failed_count = 0
        pause_time = 0.0
        pause_count = 0
        process_time = 0.0
        for message in message_batch:
            self.write_healthcheck()
            with Timer(logger=None) as message_timer:
                message_data = self.process_message(message)
                if not message_data["success"]:
                    failed_count += 1
                if message_data["success"] or self.delete_failed_messages:
                    message.delete()
                pause_time += message_data.get("pause_s", 0.0)
                pause_count += message_data.get("pause_count", 0)

            message_data["message_process_time_s"] = round(message_timer.last, 3)
            process_time += message_timer.last
            logger.log(logging.INFO, "Message processed", extra=message_data)

        batch_data = {"process_s": round((process_time - pause_time), 3)}
        if pause_count:
            batch_data["pause_count"] = pause_count
            batch_data["pause_s"] = round(pause_time, 3)
        if failed_count:
            batch_data["failed_count"] = failed_count
        return batch_data

    def process_message(self, message):
        """
        Process an SQS message, which may include sending an email.

        Return is a dict suitable for logging context, with these keys:
        * success: True if message was processed successfully
        * error: The processing error, omitted on success
        * message_body_quoted: Set if the message was non-JSON, omitted for valid JSON
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
            logger.error("Failed SNS verification", extra={"error": str(e)})
            results.update(
                {
                    "success": False,
                    "error": f"Failed SNS verification: {e}",
                }
            )
            return results

        topic_arn = verified_json_body["TopicArn"]
        message_type = verified_json_body["Type"]
        error_details = validate_sns_header(topic_arn, message_type)
        if error_details:
            results["success"] = False
            results.update(error_details)
            return results

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
        with open(self.healthcheck_path, "w", encoding="utf-8") as healthcheck_file:
            json.dump(data, healthcheck_file)

    def pluralize(self, value, singular, plural=None):
        """Returns 's' suffix to make plural, like 's' in tasks"""
        if value == 1:
            return f"{value} {singular}"
        else:
            return f"{value} {plural or (singular + 's')}"
