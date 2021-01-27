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

    def test_generate_relay_From_with_really_long_address(self):
        original_from_address = ''.join((
            'a really long from address that is more ',
            'than 78 characters because rfc2822 says to start inserting wrap',
            'characters that could be unsafe <evil@evil.com>',
        ))
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            '=?utf-8?q?=22a_really_long_from_address_that'
            '__=2E=2E=2E_=5Bvia_Relay=5D=22?='
        )
        expected_formatted_from = '%s %s' % (
            expected_encoded_display_name, '<%s>' % self.relay_from
        )
        assert formatted_from_address == expected_formatted_from
