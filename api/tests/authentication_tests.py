from datetime import datetime

from model_bakery import baker
import responses

from django.core.cache import cache
from django.test import RequestFactory, TestCase

from allauth.socialaccount.models import SocialAccount

from ..authentication import FxaTokenAuthentication, get_cache_key


class FxaTokenAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = FxaTokenAuthentication
        self.factory = RequestFactory()
        self.path = '/api/v1/relayaddresses'
        self.fxa_verify_path = 'https://oauth.stage.mozaws.net/v1/introspect'
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
    def test_non_200_resp_from_fxa_returns_none_and_caches(self):
        responses.add(
            responses.POST, self.fxa_verify_path, status=401, json={'error':'401'}
        )
        not_found_token = 'not-found-123'
        assert cache.get(get_cache_key(not_found_token)) is None

        headers = {'HTTP_AUTHORIZATION': f'Bearer {not_found_token}'}
        get_addresses_req = self.factory.get(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, get_addresses_req)

        assert auth_return == None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        expected = {"status_code": 401, "json": {"error": "401"}}
        assert cache.get(get_cache_key(not_found_token)) == expected

        # now check that the code does NOT make another fxa request
        assert self.auth.authenticate(self.auth, get_addresses_req) is None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_non_200_non_json_resp_from_fxa_returns_none_and_caches(self):
        responses.add(
            responses.POST, self.fxa_verify_path, status=503,
            body="Bad gateway error"
        )
        not_found_token = 'fxa-gw-error'
        assert cache.get(get_cache_key(not_found_token)) is None

        headers = {'HTTP_AUTHORIZATION': f'Bearer {not_found_token}'}
        get_addresses_req = self.factory.get(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, get_addresses_req)

        assert auth_return == None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        expected = {"status_code": 503, "json": None}
        assert cache.get(get_cache_key(not_found_token)) == expected

        # now check that the code does NOT make another fxa request
        assert self.auth.authenticate(self.auth, get_addresses_req) is None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_200_resp_from_fxa_inactive_token_returns_none(self):
        responses.add(
            responses.POST, self.fxa_verify_path, status=200,
            json={'active': False}
        )
        inactive_token = 'inactive-123'
        headers = {'HTTP_AUTHORIZATION': f'Bearer {inactive_token}'}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        expected = {"status_code": 200, "json": {"active": False}}
        assert cache.get(get_cache_key(inactive_token)) == expected

        # the code does NOT make another fxa request
        assert self.auth.authenticate(self.auth, get_addresses_req) is None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_200_resp_from_fxa_no_matching_user_returns_none(self):
        response_json = {'active': True, 'sub': 'not-a-relay-user'}
        responses.add(
            responses.POST, self.fxa_verify_path, status=200,
            json=response_json
        )
        non_user_token = 'non-user-123'
        headers = {'HTTP_AUTHORIZATION': f'Bearer {non_user_token}'}
        get_addresses_req = self.factory.get(self.path, **headers)
        assert self.auth.authenticate(self.auth, get_addresses_req) == None
        expected = {"status_code": 200, "json": response_json}
        assert cache.get(get_cache_key(non_user_token)) == expected

        # the code does NOT make another fxa request
        assert self.auth.authenticate(self.auth, get_addresses_req) is None
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate()
    def test_200_resp_from_fxa_for_user_returns_user_and_caches(self):
        self.sa = baker.make(SocialAccount, uid=self.uid, provider='fxa')
        user_token = 'user-123'
        assert cache.get(get_cache_key(user_token)) is None
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60*60)*1000
        response_json = {'active': True, 'sub': self.uid, 'exp': exp_time}
        responses.add(
            responses.POST, self.fxa_verify_path, status=200,
            json=response_json
        )

        headers = {'HTTP_AUTHORIZATION': f'Bearer {user_token}'}
        get_addresses_req = self.factory.get(self.path, **headers)
        auth_return = self.auth.authenticate(self.auth, get_addresses_req)
        assert auth_return == (self.sa.user, None)
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        expected = {"status_code": 200, "json": response_json}
        assert cache.get(get_cache_key(user_token)) == expected

        # now check that the code does NOT make another fxa request
        auth_return = self.auth.authenticate(self.auth, get_addresses_req)
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
