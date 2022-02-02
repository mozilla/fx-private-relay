from allauth.socialaccount.models import SocialAccount
from model_bakery import baker
import responses

from django.test import RequestFactory, TestCase

from ..authentication import FxaTokenAuthentication


class FxaTokenAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = FxaTokenAuthentication
        self.factory = RequestFactory()
        self.path = '/api/v1/relayaddresses'
        self.fxa_verify_path = 'https://oauth.stage.mozaws.net/v1/verify'
        self.uid = 'relay-user-fxa-uid'

    def test_no_authorization_header_returns_none(self):
        get_addresses_req = self.factory.get(self.path)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

    def test_no_bearer_in_authorization_returns_none(self):
        headers = {'HTTP_AUTHORIZATION': 'unexpected 123'}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

    def test_no_token_returns_none(self):
        headers = {'HTTP_AUTHORIZATION': 'Bearer '}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

    @responses.activate()
    def test_non_200_resp_from_fxa_returns_none(self):
        responses.add(responses.POST, self.fxa_verify_path, status=404)
        headers = {'HTTP_AUTHORIZATION': 'Bearer abc123'}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

    @responses.activate()
    def test_200_resp_from_fxa_no_matching_user_returns_none(self):
        responses.add(
            responses.POST, self.fxa_verify_path, status=200,
            json={'user': 'not-a-relay-user'}
        )
        headers = {'HTTP_AUTHORIZATION': 'Bearer abc123'}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None

    @responses.activate()
    def test_200_resp_from_fxa_for_user_returns_user(self):
        self.sa = baker.make(SocialAccount, uid=self.uid, provider='fxa')
        responses.add(
            responses.POST, self.fxa_verify_path, status=200,
            json={'user': self.uid}
        )

        headers = {'HTTP_AUTHORIZATION': 'Bearer abc123'}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == (self.sa.user, None)
