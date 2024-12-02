from collections.abc import Iterator
from unittest.mock import Mock, patch

from django.core.exceptions import SuspiciousOperation

import pytest

from ..sns import _grab_keyfile


@pytest.fixture
def mock_urlopen() -> Iterator[Mock]:
    with patch("emails.sns.urlopen") as mock_urlopen:
        yield mock_urlopen


def test_grab_keyfile_checks_cert_url_origin(mock_urlopen: Mock) -> None:
    cert_url = "https://attacker.com/cert.pem"
    with pytest.raises(SuspiciousOperation):
        _grab_keyfile(cert_url)
    mock_urlopen.assert_not_called()
