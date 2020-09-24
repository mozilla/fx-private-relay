from django.test import TestCase

from emails.utils import generate_relay_From


class FormattingToolsTest(TestCase):
    def setUp(self):
        self.original_from_address = '"foö bär" <foo@bar.com>'

    def test_generate_relay_From_with_umlaut(self):
        with self.settings(RELAY_FROM_ADDRESS='relay@relay.firefox.com'):
            relay_from_address, relay_from_display = generate_relay_From(
                self.original_from_address
            )

        expected_encoded_display_name = (
            '=?utf-8?b?IiJmb8O2IGLDpHIiIDxmb29AYmFyLmNvbT4gW3ZpYSBSZWxheV0i?='
        )
        assert relay_from_address == 'relay@relay.firefox.com'
        assert relay_from_display == expected_encoded_display_name
