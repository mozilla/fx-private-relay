from django.urls import reverse

from model_bakery import baker
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from emails.models import RelayAddress
from emails.tests.models_tests import make_free_test_user, make_premium_test_user


class PremiumValidatorsTest(APITestCase):
    def test_non_premium_cant_set_block_list_emails(self):
        free_user = make_free_test_user()
        free_alias = baker.make(RelayAddress, user=free_user)
        assert free_alias.block_list_emails == False

        url = reverse("relayaddress-detail", args=[free_alias.id])
        data = {"block_list_emails": True}
        free_token = Token.objects.get(user=free_user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + free_token.key)
        response = self.client.patch(url, data, format="json")

        assert response.status_code == 403
        assert free_alias.block_list_emails == False

    def test_non_premium_can_clear_block_list_emails(self):
        free_user = make_free_test_user()
        free_alias = baker.make(RelayAddress, user=free_user)
        assert free_alias.block_list_emails == False

        url = reverse("relayaddress-detail", args=[free_alias.id])
        data = {"block_list_emails": False}
        free_token = Token.objects.get(user=free_user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + free_token.key)
        response = self.client.patch(url, data, format="json")

        assert response.status_code == 200
        free_alias.refresh_from_db()
        assert free_alias.block_list_emails == False

    def test_premium_can_set_block_list_emails(self):
        premium_user = make_premium_test_user()
        premium_alias = baker.make(RelayAddress, user=premium_user)
        assert premium_alias.block_list_emails == False

        url = reverse("relayaddress-detail", args=[premium_alias.id])
        data = {"block_list_emails": True}
        free_token = Token.objects.get(user=premium_user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + free_token.key)
        response = self.client.patch(url, data, format="json")

        assert response.status_code == 200
        premium_alias.refresh_from_db()
        assert premium_alias.block_list_emails == True
