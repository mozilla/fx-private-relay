import json
import logging
import sys

from botocore.exceptions import ClientError

from django.apps import apps
from django.core.management.base import BaseCommand

from emails.views import (
    _sns_inbound_logic, validate_sns_header, verify_from_sns
)


logger = logging.getLogger('events')

class Command(BaseCommand):
    help = 'Fetches messages from SQS dead-letter queue and processes them.'

    def handle(self, *args, **options):
        self.exit_code = 0
        try:
            dl_queue = apps.get_app_config('emails').dl_queue
        except ClientError as e:
            logger.error('sqs_client_error: ', extra=e.response['Error'])
            self.exit_code = 1
            sys.exit(self.exit_code)

        messages = dl_queue.receive_messages(
            MaxNumberOfMessages=10, WaitTimeSeconds=1
        )
        while len(messages) > 0:
            for message in messages:
                json_body = json.loads(message.body)
                verified_json_body = verify_from_sns(json_body)
                topic_arn = verified_json_body['TopicArn']
                message_type = verified_json_body['Type']
                validate_sns_header(topic_arn, message_type)
                _sns_inbound_logic(topic_arn, message_type, verified_json_body)
                logger.info(f'processed sqs message ID: {message.message_id}')
                message.delete()
            messages = dl_queue.receive_messages(
                MaxNumberOfMessages=10, WaitTimeSeconds=1
            )
        sys.exit(self.exit_code)
