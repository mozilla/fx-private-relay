from io import StringIO
import json

from django.core.management import call_command

from model_bakery import baker
import pytest

from emails.models import DomainAddress, Profile, RelayAddress
from .models_tests import make_premium_test_user, make_storageless_test_user


COMMAND_NAME = "cleanup_data"
MOCK_BASE = f"emails.management.commands.{COMMAND_NAME}"


@pytest.fixture
def all_users_have_server_storage(db):
    """Setup a user with server storage"""
    user_storage = make_premium_test_user()
    profile_storage = user_storage.profile_set.first()
    assert profile_storage
    assert profile_storage.server_storage
    profile_storage.subdomain = "with-server-storage"
    profile_storage.save()
    baker.make(
        RelayAddress,
        user=user_storage,
        address="address1",
        description="My relay address",
        generated_for="example.com",
        used_on="example.com,sub.example.org",
    )
    baker.make(
        DomainAddress,
        user=user_storage,
        address="address2",
        description="My domain address",
        used_on="example.com,sub.example.org",
    )

@pytest.fixture
def some_users_have_server_storage(all_users_have_server_storage):
    """Add a second user without server storage."""
    user_no_storage = make_storageless_test_user()
    profile_no_storage = user_no_storage.profile_set.first()
    assert profile_no_storage
    assert not profile_no_storage.server_storage
    assert profile_no_storage.subdomain
    baker.make(RelayAddress, user=user_no_storage, address="address3", used_on=None)
    baker.make(DomainAddress, user=user_no_storage, address="address4", used_on=None)
    baker.make(RelayAddress, user=user_no_storage, address="address5", used_on="")
    baker.make(DomainAddress, user=user_no_storage, address="address6", used_on="")
    return user_no_storage

@pytest.fixture
def users_need_data_cleared(some_users_have_server_storage):
    """Add a second user without server storage."""
    user_no_storage = some_users_have_server_storage
    profile_no_storage = user_no_storage.profile_set.first()
    assert profile_no_storage
    assert not profile_no_storage.server_storage
    assert profile_no_storage.subdomain
    ra7 = baker.make(RelayAddress, user=user_no_storage, address="address7")
    ra8 = baker.make(RelayAddress, user=user_no_storage, address="address8")
    ra9 = baker.make(RelayAddress, user=user_no_storage, address="address9")
    da10 = baker.make(DomainAddress, user=user_no_storage, address="address10")
    da11 = baker.make(DomainAddress, user=user_no_storage, address="address11")

    # Use querysets to avoid save() methods
    RelayAddress.objects.filter(id=ra7.id).update(used_on="example.com")
    RelayAddress.objects.filter(id=ra8.id).update(generated_for="generated.example.com")
    RelayAddress.objects.filter(id=ra9.id).update(description="relay description")
    DomainAddress.objects.filter(id=da10.id).update(used_on="example.org")
    DomainAddress.objects.filter(id=da11.id).update(description="domain description")



@pytest.mark.django_db
def test_empty_database(caplog) -> None:
    """The command can run on an empty database."""
    out = StringIO()
    call_command(COMMAND_NAME, "--clear", stdout=out)
    output = out.getvalue()
    expected = """\
Profiles:
  Total: 0
Relay Addresses:
  Total: 0
Domain Addresses:
  Total: 0
"""
    assert output == expected


@pytest.mark.django_db
def test_no_data_dry_run(caplog) -> None:
    """The command can run in dry run mode on an empty database."""
    out = StringIO()
    call_command(COMMAND_NAME, stdout=out)
    output = out.getvalue()
    expected = """\
Dry run. Use --clear to clear server-stored data.
Profiles:
  Total: 0
Relay Addresses:
  Total: 0
Domain Addresses:
  Total: 0
"""
    assert output == expected

def test_all_server_storage(all_users_have_server_storage) -> None:
    out = StringIO()
    call_command(COMMAND_NAME, stdout=out)
    output = out.getvalue()
    expected = """\
Dry run. Use --clear to clear server-stored data.
Profiles:
  Total: 1
  Without Server Storage: 0 (0.0%)
Relay Addresses:
  Total: 1
  Without Server Storage: 0 (0.0%)
Domain Addresses:
  Total: 1
  Without Server Storage: 0 (0.0%)
"""
    assert output == expected


def test_some_server_storage(some_users_have_server_storage) -> None:
    out = StringIO()
    call_command(COMMAND_NAME, stdout=out)
    output = out.getvalue()
    expected = """\
Dry run. Use --clear to clear server-stored data.
Profiles:
  Total: 2
  Without Server Storage: 1 (50.0%)
Relay Addresses:
  Total: 3
  Without Server Storage: 2 (66.7%)
    No Data : 2 (100.0%)
    Has Data: 0 (0.0%)
Domain Addresses:
  Total: 3
  Without Server Storage: 2 (66.7%)
    No Data : 2 (100.0%)
    Has Data: 0 (0.0%)
"""
    assert output == expected

def test_some_data_to_clear(users_need_data_cleared) -> None:
    out = StringIO()
    call_command(COMMAND_NAME, stdout=out)
    output = out.getvalue()
    expected = """\
Dry run. Use --clear to clear server-stored data.
Profiles:
  Total: 2
  Without Server Storage: 1 (50.0%)
Relay Addresses:
  Total: 6
  Without Server Storage: 5 (83.3%)
    No Data : 2 (40.0%)
    Has Data: 3 (60.0%)
Domain Addresses:
  Total: 5
  Without Server Storage: 4 (80.0%)
    No Data : 2 (50.0%)
    Has Data: 2 (50.0%)
"""
    assert output == expected


def test_data_cleared(users_need_data_cleared) -> None:
    out = StringIO()
    call_command(COMMAND_NAME, "--clear", stdout=out)
    output = out.getvalue()
    expected = """\
Profiles:
  Total: 2
  Without Server Storage: 1 (50.0%)
Relay Addresses:
  Total: 6
  Without Server Storage: 5 (83.3%)
    No Data : 2 (40.0%)
    Has Data: 3 (60.0%)
      Cleared: 3 (100.0%)
Domain Addresses:
  Total: 5
  Without Server Storage: 4 (80.0%)
    No Data : 2 (50.0%)
    Has Data: 2 (50.0%)
      Cleared: 2 (100.0%)
"""
    assert output == expected
