from email.utils import parseaddr

from django.conf import settings
from django.test import (
    TestCase,
    override_settings
)

from emails.models import get_domains_from_settings
from emails.utils import (
    generate_relay_From,
    get_email_domain_from_settings,
)


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

    def test_generate_relay_From_with_linebreak_chars(self):
        original_from_address = '"Ter\ry \n ct\u2028" <info@a...t.org>'
        formatted_from_address = generate_relay_From(original_from_address)

        expected_encoded_display_name = (
            '=?utf-8?b?IiJUZXJ5ICBjdCIgPGluZm9AYS4uLnQub3JnPiBbdmlhIFJlbGF5XSI'
            '=?='
        )
        expected_formatted_from = '%s %s' % (
            expected_encoded_display_name, '<%s>' % self.relay_from
        )
        assert formatted_from_address == expected_formatted_from

    @override_settings(ON_HEROKU=True, SITE_ORIGIN='https://test.com', TEST_MOZMAIL=False)
    def test_get_email_domain_from_settings_on_heroku_test_mozmail_false(self):
        email_domain = get_email_domain_from_settings()
        assert 'mail.test.com' == email_domain

    @override_settings(ON_HEROKU=False, SITE_ORIGIN='https://test.com', TEST_MOZMAIL=False)
    def test_get_email_domain_from_settings_not_on_heroku_test_mozmail_false(self):
        email_domain = get_email_domain_from_settings()
        assert 'test.com' == email_domain

    @override_settings(RELAY_FIREFOX_DOMAIN='firefox.com', MOZMAIL_DOMAIN='mozmail.com')
    def test_get_domains_from_settings(self):
        domains = get_domains_from_settings()
        assert domains == {
            'RELAY_FIREFOX_DOMAIN': 'firefox.com',
            'MOZMAIL_DOMAIN': 'mozmail.com'
        }
