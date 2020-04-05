from django.contrib.auth.models import User
from django.test import TestCase

from model_bakery import baker

from ..models import RelayAddress


class RelayAddressTest(TestCase):
    def setUp(self):
        self.user = baker.make(User)

    def test_make_relay_address(self):
        relay_address = RelayAddress.make_relay_address(self.user)
        assert relay_address.user == self.user
