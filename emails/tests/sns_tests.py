from unittest.mock import patch

from django.core.exceptions import SuspiciousOperation
from django.test import TestCase

from ..sns import _grab_keyfile


class GrabKeyfileTest(TestCase):
    @patch('emails.sns.urlopen')
    def test_grab_keyfile_checks_cert_url_origin(self, mock_urlopen):
        cert_url = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-7ff5318490ec183fbaddaa2a969abfda.pem'
        assert mock_urlopen.called_once_with(cert_url)

        with self.assertRaises(SuspiciousOperation):
            cert_url = 'https://attacker.com/cert.pem'
            _grab_keyfile(cert_url)
