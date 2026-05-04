from django.contrib.auth.models import User
from django.urls import reverse

from model_bakery import baker
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from emails.models import RelayAddress
from privaterelay.tests.utils import make_free_test_user, make_premium_test_user


class PremiumValidatorsTest(APITestCase):
    def _get_token_for_user(self, user: User) -> Token:
        """
        Get DRF Token for user with strict type checks.

        hasattr check prevents attr-defined error on Token
        isinstance check prevents no-any-return error

        See https://github.com/mozilla/fx-private-relay/pull/4913#discussion_r1698637372
        """
        if not hasattr(Token, "objects"):
            raise AttributeError("Token must have objects attribute.")
        token = Token.objects.get(user=user)
        if not isinstance(token, Token):
            raise TypeError("token must be of type Token.")
        return token

    def test_non_premium_cant_set_block_list_emails(self):
        free_user = make_free_test_user()
        free_alias = baker.make(RelayAddress, user=free_user)
        assert free_alias.block_list_emails is False

        url = reverse("relayaddress-detail", args=[free_alias.id])
        data = {"block_list_emails": True}
        free_token = self._get_token_for_user(free_user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + free_token.key)
        response = self.client.patch(url, data, format="json")

        assert response.status_code == 401
        assert free_alias.block_list_emails is False

    def test_non_premium_can_clear_block_list_emails(self):
        free_user = make_free_test_user()
        free_alias = baker.make(RelayAddress, user=free_user)
        assert free_alias.block_list_emails is False

        url = reverse("relayaddress-detail", args=[free_alias.id])
        data = {"block_list_emails": False}
        free_token = self._get_token_for_user(free_user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + free_token.key)
        response = self.client.patch(url, data, format="json")

        assert response.status_code == 200
        free_alias.refresh_from_db()
        assert free_alias.block_list_emails is False

    def test_premium_can_set_block_list_emails(self):
        premium_user = make_premium_test_user()
        premium_alias = baker.make(RelayAddress, user=premium_user)
        assert premium_alias.block_list_emails is False

        url = reverse("relayaddress-detail", args=[premium_alias.id])
        data = {"block_list_emails": True}
        premium_token = self._get_token_for_user(premium_user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + premium_token.key)
        response = self.client.patch(url, data, format="json")

        assert response.status_code == 200
        premium_alias.refresh_from_db()
        assert premium_alias.block_list_emails is True
