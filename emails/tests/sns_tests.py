from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from io import BytesIO
from unittest.mock import Mock, patch

from django.core.cache import BaseCache, caches
from django.core.exceptions import SuspiciousOperation

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from pytest_django.fixtures import SettingsWrapper

from ..sns import _grab_keyfile


@pytest.fixture(autouse=True)
def pem_cache(settings: SettingsWrapper) -> Iterator[BaseCache]:
    pem_cache = caches[getattr(settings, "AWS_SNS_KEY_CACHE", "default")]
    pem_cache.clear()
    yield pem_cache
    pem_cache.clear()


@pytest.fixture
def key_and_cert() -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
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


@pytest.fixture
def mock_urlopen() -> Iterator[Mock]:
    with patch("emails.sns.urlopen") as mock_urlopen:
        yield mock_urlopen


def test_grab_keyfile_checks_cert_url_origin(mock_urlopen: Mock) -> None:
    cert_url = "https://attacker.com/cert.pem"
    with pytest.raises(SuspiciousOperation):
        _grab_keyfile(cert_url)
    mock_urlopen.assert_not_called()


def test_grab_keyfile_downloads_valid_certificate(
    mock_urlopen: Mock,
    key_and_cert: tuple[rsa.RSAPrivateKey, x509.Certificate],
    pem_cache: BaseCache,
    settings: SettingsWrapper,
) -> None:
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    key, cert = key_and_cert
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    mock_urlopen.return_value = BytesIO(cert_pem)
    ret_value = _grab_keyfile(cert_url)
    mock_urlopen.assert_called_once_with(cert_url)
    assert ret_value == cert_pem
    assert pem_cache.get(cert_url) == cert_pem


def test_grab_keyfile_reads_from_cache(
    mock_urlopen: Mock,
    pem_cache: BaseCache,
    settings: SettingsWrapper,
) -> None:
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    fake_pem = b"I am fake"
    pem_cache.set(cert_url, fake_pem)
    ret_value = _grab_keyfile(cert_url)
    assert ret_value == fake_pem
    mock_urlopen.assert_not_called()


def test_grab_keyfile_cert_chain_fails(
    mock_urlopen: Mock,
    key_and_cert: tuple[rsa.RSAPrivateKey, x509.Certificate],
    pem_cache: BaseCache,
    settings: SettingsWrapper,
) -> None:
    cert_url = f"https://sns.{settings.AWS_REGION}.amazonaws.com/cert.pem"
    key, cert = key_and_cert
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    two_cert_pem = b"\n".join((cert_pem, cert_pem))
    mock_urlopen.return_value = BytesIO(two_cert_pem)
    with pytest.raises(ValueError, match="Invalid Certificate File"):
        _grab_keyfile(cert_url)
