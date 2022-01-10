import json
import logging
import sys
import time

import boto3
from botocore.exceptions import ClientError

from django.conf import settings
from django.core.management.base import BaseCommand

from emails.views import (
    _sns_inbound_logic, validate_sns_header, verify_from_sns
)
from emails.utils import incr_if_enabled


logger = logging.getLogger('events')
info_logger = logging.getLogger('eventsinfo')


def _verify_and_run_sns_inbound_on_message(message):
    incr_if_enabled('rerun_message_from_sqs', 1)
    json_body = json.loads(message.body)
    verified_json_body = verify_from_sns(json_body)
    topic_arn = verified_json_body['TopicArn']
    message_type = verified_json_body['Type']
    validate_sns_header(topic_arn, message_type)
    try:
        _sns_inbound_logic(topic_arn, message_type, verified_json_body)
        info_logger.info(f'processed sqs message ID: {message.message_id}')
    except ClientError as e:
        incr_if_enabled('rerun_message_from_sqs_error', 1)
        logger.error('sqs_client_error: ', extra=e.response['Error'])
        temp_errors = ['throttling', 'pause']
        lower_error_code = e.response['Error']['Code'].lower()
        if any(temp_error in lower_error_code for temp_error in temp_errors):
            incr_if_enabled('rerun_message_from_sqs_temp_error', 1)
            logger.error(
                '"temporary" error, sleeping for 1s: ',
                extra=e.response['Error']
            )
            time.sleep(1)
            try:
                _sns_inbound_logic(topic_arn, message_type, verified_json_body)
                info_logger.info(f'processed sqs message ID: {message.message_id}')
            except ClientError as e:
                incr_if_enabled('rerun_message_from_sqs_error', 1)
                logger.error('sqs_client_error: ', extra=e.response['Error'])


class Command(BaseCommand):
    help = 'Fetches messages from SQS dead-letter queue and processes them.'

    def handle(self, *args, **options):
        self.exit_code = 0
        try:
            sqs_client = boto3.resource('sqs', region_name=settings.AWS_REGION)
            dl_queue = sqs_client.Queue(settings.AWS_SQS_QUEUE_URL)
        except ClientError as e:
            logger.error('sqs_client_error: ', extra=e.response['Error'])
            self.exit_code = 1
            sys.exit(self.exit_code)

        messages = dl_queue.receive_messages(
            MaxNumberOfMessages=10, WaitTimeSeconds=1
        )
        while len(messages) > 0:
            for message in messages:
                try:
                    _verify_and_run_sns_inbound_on_message(message)
                except:
                    exc_type, _, _ = sys.exc_info()
                    logger.exception(f'dlq_processing_error_{exc_type}')
                finally:
                    message.delete()
            messages = dl_queue.receive_messages(
                MaxNumberOfMessages=10, WaitTimeSeconds=1
            )
        sys.exit(self.exit_code)
