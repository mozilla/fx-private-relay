# Inspired by django-bouncy utils:
# https://github.com/organizerconnect/django-bouncy/blob/master/django_bouncy/utils.py

import base64
import logging
import pem
from urllib.request import urlopen

from OpenSSL import crypto

from django.conf import settings
from django.core.cache import caches
from django.utils.encoding import smart_bytes


logger = logging.getLogger('events')

NOTIFICATION_HASH_FORMAT = u'''Message
{Message}
MessageId
{MessageId}
Subject
{Subject}
Timestamp
{Timestamp}
TopicArn
{TopicArn}
Type
{Type}
'''

SUBSCRIPTION_HASH_FORMAT = u'''Message
{Message}
MessageId
{MessageId}
SubscribeURL
{SubscribeURL}
Timestamp
{Timestamp}
Token
{Token}
TopicArn
{TopicArn}
Type
{Type}
'''

SUPPORTED_SNS_TYPES = [
    'SubscriptionConfirmation',
    'Notification',
]


def verify_from_sns(json_body):
    pemfile = _grab_keyfile(json_body['SigningCertURL'])
    cert = crypto.load_certificate(crypto.FILETYPE_PEM, pemfile)
    signature = base64.decodebytes(json_body['Signature'].encode('utf-8'))

    hash_format = _get_hash_format(json_body['Type'])

    crypto.verify(
        cert,
        signature,
        hash_format.format(**json_body).encode('utf-8'),
        'sha1'
    )
    return json_body


def _get_hash_format(message_type):
    if message_type == "Notification":
        return NOTIFICATION_HASH_FORMAT

    return SUBSCRIPTION_HASH_FORMAT


def _grab_keyfile(cert_url):
    key_cache = caches[getattr(settings, 'AWS_SNS_KEY_CACHE', 'default')]

    pemfile = key_cache.get(cert_url)
    if not pemfile:
        response = urlopen(cert_url)
        pemfile = response.read()
        # Extract the first certificate in the file and confirm it's a valid
        # PEM certificate
        certificates = pem.parse(smart_bytes(pemfile))

        # A proper certificate file will contain 1 certificate
        if len(certificates) != 1:
            logger.error('Invalid Certificate File: URL %s', cert_url)
            raise ValueError('Invalid Certificate File')

        key_cache.set(cert_url, pemfile)
    return pemfile
