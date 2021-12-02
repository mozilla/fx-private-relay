from django.test import TestCase

from ..utils import get_premium_country_lang


class GetPremiumCountryLangTest(TestCase):
    def test_get_premium_country_lang(self):
        cc, lang = get_premium_country_lang('en-au,')
        assert cc == 'au'
        assert lang == 'en'

        cc, lang = get_premium_country_lang('en-us,')
        assert cc == 'us'
        assert lang == 'en'

        cc, lang = get_premium_country_lang('de-be,')
        assert cc == 'be'
        assert lang == 'de'

        cc, lang = get_premium_country_lang('de-be,', 'at')
        assert cc == 'at'
        assert lang == 'de'
