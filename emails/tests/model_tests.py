from hashlib import sha256
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from model_bakery import baker

from ..models import CannotMakeAddressException, DeletedAddress, RelayAddress


class RelayAddressTest(TestCase):
    def setUp(self):
        self.user = baker.make(User)

    def test_make_relay_address_assigns_to_user(self):
        relay_address = RelayAddress.make_relay_address(self.user)
        assert relay_address.user == self.user

    # TODO: FIXME? this is dumb
    def test_make_relay_address_makes_different_addresses(self):
        relay_addresses = []
        for i in range(1000):
            relay_addresses.append(RelayAddress.make_relay_address(self.user))
        assert len(relay_addresses) == len(set(relay_addresses))

    def test_delete_adds_deleted_address_object(self):
        relay_address = baker.make(RelayAddress)
        address_hash = sha256(
            relay_address.address.encode('utf-8')
        ).hexdigest()
        relay_address.delete()
        deleted_count = DeletedAddress.objects.filter(
            address_hash=address_hash
        ).count()
        assert deleted_count == 1

    # trigger a collision by making address_default always return 'aaaaaaaaa'
    @patch.multiple('string', ascii_lowercase='a', digits='')
    def test_make_relay_address_doesnt_make_dupe_of_deleted(self):
        test_hash = sha256('aaaaaaaaa'.encode('utf-8')).hexdigest()
        deleted_address = DeletedAddress.objects.create(address_hash=test_hash)
        try:
            RelayAddress.make_relay_address(self.user)
        except CannotMakeAddressException:
            return
        self.fail("Should have raise CannotMakeAddressException")
