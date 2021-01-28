from email.utils import parseaddr

from django.conf import settings
from django.test import TestCase

from emails.utils import generate_relay_From


class FormattingToolsTest(TestCase):
    def setUp(self):
        _, self.relay_from = parseaddr(settings.RELAY_FROM_ADDRESS)

    def test_generate_relay_From_with_umlaut(self):
        original_from_address = '"foö bär" <foo@bar.com>'
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            '=?utf-8?b?IiJmb8O2IGLDpHIiIDxmb29AYmFyLmNvbT4gW3ZpYSBSZWxheV0i?='
        )
        expected_formatted_from = '%s %s' % (
            expected_encoded_display_name, '<%s>' % self.relay_from
        )
        assert formatted_from_address == expected_formatted_from

    def test_generate_relay_From_with_realistic_address(self):
        original_from_address = 'something real <somethingreal@protonmail.com>'
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            '=?utf-8?q?=22something_real_=3Csomethingreal=40protonmail=2Ecom'
            '=3E_=5Bvia_Relay=5D=22?='
        )
        expected_formatted_from = '%s %s' % (
            expected_encoded_display_name, '<%s>' % self.relay_from
        )
        assert formatted_from_address == expected_formatted_from

    def test_generate_relay_From_with_rfc_2822_invalid_address(self):
        original_from_address = 'l%sng <long@long.com>' % ('o'*999)
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            '=?utf-8?q?=22l%s_=2E=2E=2E_=5Bvia_Relay=5D=22?=' % ('o'*899)
        )
        expected_formatted_from = '%s %s' % (
            expected_encoded_display_name, '<%s>' % self.relay_from
        )
        assert formatted_from_address == expected_formatted_from
