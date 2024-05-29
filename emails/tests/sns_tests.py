from unittest.mock import patch

from django.core.exceptions import SuspiciousOperation
from django.test import TestCase

from ..sns import _grab_keyfile


class GrabKeyfileTest(TestCase):
    @patch("emails.sns.urlopen")
    def test_grab_keyfile_checks_cert_url_origin(self, mock_urlopen):
        cert_url = "https://attacker.com/cert.pem"
        with self.assertRaises(SuspiciousOperation):
            _grab_keyfile(cert_url)
        mock_urlopen.assert_not_called()
