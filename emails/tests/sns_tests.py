# ruff: noqa: S303  # Use of insecure SHA1 hash function

from base64 import b64encode
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from io import BytesIO
from unittest.mock import Mock, patch

from django.core.cache import BaseCache, caches
from django.core.exceptions import SuspiciousOperation

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID
from pytest_django.fixtures import SettingsWrapper

from ..sns import (
    NOTIFICATION_HASH_FORMAT,
    NOTIFICATION_WITHOUT_SUBJECT_HASH_FORMAT,
    SUBSCRIPTION_HASH_FORMAT,
    VerificationFailed,
    _get_signing_public_key,
    verify_from_sns,
)


@pytest.fixture(autouse=True)
def key_cache(settings: SettingsWrapper) -> Iterator[BaseCache]:
    """
    Return the cache used for signing certificates.

    Clear the cache before and after tests.
    """
    key_cache = caches[getattr(settings, "AWS_SNS_KEY_CACHE", "default")]
    key_cache.clear()
    yield key_cache
    key_cache.clear()


@pytest.fixture
def key_and_cert() -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
    """Generate an RSA key and a signing certificate"""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name_attributes = [
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Oklahoma"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Tulsa"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Firefox Private Relay Test"),
        x509.NameAttribute(NameOID.COMMON_NAME, "github.com/mozilla/fx-private-relay/"),
    ]
    subject = issuer = x509.Name(name_attributes)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(UTC) - timedelta(seconds=1))
        .not_valid_after(datetime.now(UTC) + timedelta(seconds=60))
        .sign(key, hashes.SHA256())
    )
    return key, cert


def _cache_key(cert_url: str) -> str:
    return f"{cert_url}:public_key"


def _public_pem(cert_or_private_key: rsa.RSAPrivateKey | x509.Certificate) -> bytes:
    return cert_or_private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


@pytest.fixture
def signing_cert_url_and_private_key(
    key_and_cert: tuple[rsa.RSAPrivateKey, x509.Certificate],
    key_cache: BaseCache,
    settings: SettingsWrapper,
) -> tuple[str, rsa.RSAPrivateKey]:
    """Return the URL and private key for a cached signing certificate."""
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    key, cert = key_and_cert
    key_cache.set(_cache_key(cert_url), _public_pem(cert))
    return cert_url, key


@pytest.fixture
def mock_urlopen() -> Iterator[Mock]:
    with patch("emails.sns.urlopen") as mock_urlopen:
        yield mock_urlopen


def test_get_signing_public_key_suspicious_url(mock_urlopen: Mock) -> None:
    cert_url = "https://attacker.com/cert.pem"
    with pytest.raises(SuspiciousOperation):
        _get_signing_public_key(cert_url)
    mock_urlopen.assert_not_called()


def test_get_signing_public_key_downloads_valid_certificate(
    mock_urlopen: Mock,
    key_and_cert: tuple[rsa.RSAPrivateKey, x509.Certificate],
    key_cache: BaseCache,
    settings: SettingsWrapper,
) -> None:
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    _, cert = key_and_cert
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    mock_urlopen.return_value = BytesIO(cert_pem)
    ret_value = _get_signing_public_key(cert_url)
    mock_urlopen.assert_called_once_with(cert_url)
    assert ret_value == cert.public_key()
    assert key_cache.get(_cache_key(cert_url)) == _public_pem(cert)


def test_get_signing_public_key_reads_from_cache(
    mock_urlopen: Mock,
    key_and_cert: tuple[rsa.RSAPrivateKey, x509.Certificate],
    key_cache: BaseCache,
    settings: SettingsWrapper,
) -> None:
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    _, cert = key_and_cert
    key_cache.set(_cache_key(cert_url), _public_pem(cert))
    ret_value = _get_signing_public_key(cert_url)
    assert ret_value == cert.public_key()
    mock_urlopen.assert_not_called()


def test_get_signing_public_key_cert_chain_fails(
    mock_urlopen: Mock,
    key_and_cert: tuple[rsa.RSAPrivateKey, x509.Certificate],
    key_cache: BaseCache,
    settings: SettingsWrapper,
) -> None:
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    key, cert = key_and_cert
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    two_cert_pem = b"\n".join((cert_pem, cert_pem))
    mock_urlopen.return_value = BytesIO(two_cert_pem)
    expected = f"SigningCertURL {cert_url} has 2 certificates."
    with pytest.raises(VerificationFailed, match=expected):
        _get_signing_public_key(cert_url)


def test_verify_from_sns_notification_with_subject_ver1(
    signing_cert_url_and_private_key: tuple[str, rsa.RSAPrivateKey],
) -> None:
    cert_url, key = signing_cert_url_and_private_key
    json_body = {
        "Type": "Notification",
        "Message": "message",
        "MessageId": "message_id",
        "Subject": "subject",
        "Timestamp": "timestamp",
        "TopicArn": "topic_arn",
        "SigningCertURL": cert_url,
        "SignatureVersion": 1,
    }
    text_to_sign = NOTIFICATION_HASH_FORMAT.format(**json_body)
    signature = key.sign(text_to_sign.encode(), padding.PKCS1v15(), hashes.SHA1())
    json_body["Signature"] = b64encode(signature).decode()
    ret = verify_from_sns(json_body)
    assert ret == json_body


def test_verify_from_sns_notification_with_subject_ver1_fails(
    signing_cert_url_and_private_key: tuple[str, rsa.RSAPrivateKey],
) -> None:
    cert_url, key = signing_cert_url_and_private_key
    json_body = {
        "Type": "Notification",
        "Message": "message",
        "MessageId": "message_id",
        "Subject": "subject",
        "Timestamp": "timestamp",
        "TopicArn": "topic_arn",
        "SigningCertURL": cert_url,
        "SignatureVersion": 1,
    }
    text_to_sign = NOTIFICATION_HASH_FORMAT.format(**json_body)
    signature = key.sign(text_to_sign.encode(), padding.PKCS1v15(), hashes.SHA1())
    json_body["Signature"] = b64encode(signature).decode()
    json_body["Message"] = "different message"
    with pytest.raises(VerificationFailed):
        verify_from_sns(json_body)


def test_verify_from_sns_notification_without_subject_ver1(
    signing_cert_url_and_private_key: tuple[str, rsa.RSAPrivateKey],
) -> None:
    cert_url, key = signing_cert_url_and_private_key
    json_body = {
        "Type": "Notification",
        "Message": "message",
        "MessageId": "message_id",
        "Timestamp": "timestamp",
        "TopicArn": "topic_arn",
        "SigningCertURL": cert_url,
        "SignatureVersion": 1,
    }
    text_to_sign = NOTIFICATION_WITHOUT_SUBJECT_HASH_FORMAT.format(**json_body)
    signature = key.sign(text_to_sign.encode(), padding.PKCS1v15(), hashes.SHA1())
    json_body["Signature"] = b64encode(signature).decode()
    ret = verify_from_sns(json_body)
    assert ret == json_body


def test_verify_from_sns_subscription_ver1(
    signing_cert_url_and_private_key: tuple[str, rsa.RSAPrivateKey],
) -> None:
    cert_url, key = signing_cert_url_and_private_key
    json_body = {
        "Type": "Subscription",
        "Message": "message",
        "MessageId": "message_id",
        "SubscribeURL": "subscribe_url",
        "Timestamp": "timestamp",
        "Token": "token",
        "TopicArn": "topic_arn",
        "SigningCertURL": cert_url,
        "SignatureVersion": 1,
    }
    text_to_sign = SUBSCRIPTION_HASH_FORMAT.format(**json_body)
    signature = key.sign(text_to_sign.encode(), padding.PKCS1v15(), hashes.SHA1())
    json_body["Signature"] = b64encode(signature).decode()
    ret = verify_from_sns(json_body)
    assert ret == json_body
