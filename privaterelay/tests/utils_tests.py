from django.conf import settings
from django.test import TestCase

from ..templatetags.relay_tags import premium_plan_id
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


class PremiumPlanIDTest(TestCase):
    def test_premium_plan_id_tag(self):
        plans = settings.PREMIUM_PLAN_ID_MATRIX
        plan_id = premium_plan_id('en-US', 'us')
        assert plan_id == plans['usd']['en']['id']

        plan_id = premium_plan_id('de', 'de')
        assert plan_id == plans['euro']['de']['id']

        plan_id = premium_plan_id('en-ca')
        assert plan_id == plans['usd']['en']['id']

        plan_id = premium_plan_id('en-gb')
        assert plan_id == plans['usd']['en']['id']

        plan_id = premium_plan_id('fr', 'fr')
        assert plan_id == plans['euro']['fr']['id']

        plan_id = premium_plan_id('it')
        assert plan_id == plans['euro']['it']['id']

        plan_id = premium_plan_id('en-ie')
        assert plan_id == plans['euro']['ie']['id']

        plan_id = premium_plan_id('en', 'at')
        assert plan_id == plans['euro']['at']['id']
