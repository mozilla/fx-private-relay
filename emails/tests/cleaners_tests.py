"""Tests for emails/cleaners.py"""
from __future__ import annotations

from io import StringIO
from typing import Optional

from django.contrib.auth.models import User

from model_bakery import baker
import pytest

from emails.cleaners import ServerStorageCleaner, ProfileMismatchDetector
from emails.models import DomainAddress, Profile, RelayAddress

from .models_tests import make_premium_test_user, make_storageless_test_user


def setup_server_storage_test_data(add_user_no_storage=False, add_address_data=False):
    """Setup users and addresses for testing."""

    # Create a user with server storage and addresses
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

    if not add_user_no_storage:
        return

    # Create a user without server storage and addresses without data
    user_no_storage: User = make_storageless_test_user()
    profile_no_storage = user_no_storage.profile_set.first()
    assert profile_no_storage
    assert not profile_no_storage.server_storage
    assert profile_no_storage.subdomain
    baker.make(RelayAddress, user=user_no_storage, address="address3", used_on=None)
    baker.make(DomainAddress, user=user_no_storage, address="address4", used_on=None)
    baker.make(RelayAddress, user=user_no_storage, address="address5", used_on="")
    baker.make(DomainAddress, user=user_no_storage, address="address6", used_on="")

    if not add_address_data:
        return

    # Add addresses with server-side data to the user that doesn't want it.
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
def test_server_storage_cleaner_no_data() -> None:
    """ServerStorageCleaner works on an empty database."""
    cleaner = ServerStorageCleaner()
    assert cleaner.issues() == 0
    assert cleaner.counts == {
        "summary": {"ok": 0, "needs_cleaning": 0},
        "profiles": {"all": 0, "no_server_storage": 0},
        "relay_addresses": {
            "all": 0,
            "no_server_storage": 0,
            "no_server_storage_or_data": 0,
            "no_server_storage_but_data": 0,
        },
        "domain_addresses": {
            "all": 0,
            "no_server_storage": 0,
            "no_server_storage_or_data": 0,
            "no_server_storage_but_data": 0,
        },
    }
    assert cleaner.clean() == 0
    report = cleaner.markdown_report()
    expected = """\
Profiles:
  All: 0
Relay Addresses:
  All: 0
Domain Addresses:
  All: 0"""
    assert report == expected


@pytest.mark.django_db
def test_server_storage_cleaner_all_server_storage() -> None:
    """ServerStorageCleaner detects that all users have server storage."""
    setup_server_storage_test_data()
    cleaner = ServerStorageCleaner()
    assert cleaner.issues() == 0
    assert cleaner.counts == {
        "summary": {"ok": 0, "needs_cleaning": 0},
        "profiles": {"all": 1, "no_server_storage": 0},
        "relay_addresses": {
            "all": 1,
            "no_server_storage": 0,
            "no_server_storage_or_data": 0,
            "no_server_storage_but_data": 0,
        },
        "domain_addresses": {
            "all": 1,
            "no_server_storage": 0,
            "no_server_storage_or_data": 0,
            "no_server_storage_but_data": 0,
        },
    }
    assert cleaner.clean() == 0
    report = cleaner.markdown_report()
    expected = """\
Profiles:
  All: 0
Relay Addresses:
  All: 0
Domain Addresses:
  All: 0"""


@pytest.mark.django_db
def test_server_storage_cleaner_some_server_storage() -> None:
    """ServerStorageCleaner detects that when some users have server storage."""
    """The command detects when some users have server storage."""
    setup_server_storage_test_data(add_user_no_storage=True)
    cleaner = ServerStorageCleaner()
    assert cleaner.issues() == 0
    assert cleaner.counts == {
        "summary": {"ok": 4, "needs_cleaning": 0},
        "profiles": {"all": 2, "no_server_storage": 1},
        "relay_addresses": {
            "all": 3,
            "no_server_storage": 2,
            "no_server_storage_or_data": 2,
            "no_server_storage_but_data": 0,
        },
        "domain_addresses": {
            "all": 3,
            "no_server_storage": 2,
            "no_server_storage_or_data": 2,
            "no_server_storage_but_data": 0,
        },
    }
    report = cleaner.markdown_report()
    expected = """\
Profiles:
  All: 2
  Without Server Storage: 1 (50.0%)
Relay Addresses:
  All: 3
  Without Server Storage: 2 (66.7%)
    No Data : 2 (100.0%)
    Has Data: 0 (0.0%)
Domain Addresses:
  All: 3
  Without Server Storage: 2 (66.7%)
    No Data : 2 (100.0%)
    Has Data: 0 (0.0%)"""
    assert report == expected


@pytest.mark.django_db
def test_server_storage_cleaner_some_data_to_clear() -> None:
    """The command detects when some users need data cleared."""
    setup_server_storage_test_data(add_user_no_storage=True, add_address_data=True)
    cleaner = ServerStorageCleaner()
    assert cleaner.issues() == 5
    assert cleaner.counts == {
        "summary": {"ok": 4, "needs_cleaning": 5},
        "profiles": {"all": 2, "no_server_storage": 1},
        "relay_addresses": {
            "all": 6,
            "no_server_storage": 5,
            "no_server_storage_or_data": 2,
            "no_server_storage_but_data": 3,
        },
        "domain_addresses": {
            "all": 5,
            "no_server_storage": 4,
            "no_server_storage_or_data": 2,
            "no_server_storage_but_data": 2,
        },
    }
    report = cleaner.markdown_report()
    expected = """\
Profiles:
  All: 2
  Without Server Storage: 1 (50.0%)
Relay Addresses:
  All: 6
  Without Server Storage: 5 (83.3%)
    No Data : 2 (40.0%)
    Has Data: 3 (60.0%)
Domain Addresses:
  All: 5
  Without Server Storage: 4 (80.0%)
    No Data : 2 (50.0%)
    Has Data: 2 (50.0%)"""
    assert report == expected

    # Clean the data and repeat
    assert cleaner.clean() == 5
    assert cleaner.counts["summary"]["cleaned"] == 5
    assert cleaner.counts["relay_addresses"]["cleaned"] == 3
    assert cleaner.counts["domain_addresses"]["cleaned"] == 2
    report = cleaner.markdown_report()
    expected = """\
Profiles:
  All: 2
  Without Server Storage: 1 (50.0%)
Relay Addresses:
  All: 6
  Without Server Storage: 5 (83.3%)
    No Data : 2 (40.0%)
    Has Data: 3 (60.0%)
      Cleaned: 3 (100.0%)
Domain Addresses:
  All: 5
  Without Server Storage: 4 (80.0%)
    No Data : 2 (50.0%)
    Has Data: 2 (50.0%)
      Cleaned: 2 (100.0%)"""
    assert report == expected

    # Check that data is cleaned or remains as desired
    for r_address in RelayAddress.objects.all():
        profile = r_address.user.profile_set.first()
        assert profile
        if profile.server_storage:
            assert r_address.used_on
            assert r_address.description
            assert r_address.generated_for
        else:
            assert r_address.used_on in ("", None)
            assert r_address.description == ""
            assert r_address.generated_for == ""

    for d_address in DomainAddress.objects.all():
        profile = d_address.user.profile_set.first()
        assert profile
        if profile.server_storage:
            assert d_address.used_on
            assert d_address.description
        else:
            assert d_address.used_on in ("", None)
            assert d_address.description == ""

    # Second call to clean() returns same results
    # This is a test of DataIssueTask(), but is easier with a implemented subclass
    assert cleaner.clean() == 5


def setup_profile_mismatch_test_data(add_problems=False):
    """Setup users and profiles for testing."""
    baker.make(User, email="superuser@example.com", is_superuser=True)
    baker.make(User, email="old_su@example.com", is_superuser=True, is_active=False)
    baker.make(User, email="old_user@example.com", is_active=False)
    baker.make(User, email="regular1@example.com")

    if not add_problems:
        return

    r2 = baker.make(User, email="regular2@example.com")
    p2 = r2.profile_set.first()
    r3 = baker.make(User, email="regular3@example.com")
    # Assign user #2's profile to user #3, leaving r2 with none and r3 with 3
    Profile.objects.filter(id=p2.id).update(user_id=r3.id)


@pytest.mark.django_db
def test_profile_mismatch_no_data() -> None:
    """ProfileMismatchDetector works on an empty database."""
    task = ProfileMismatchDetector()
    assert task.issues() == 0
    assert task.counts == {
        "summary": {"ok": 0, "needs_cleaning": 0},
        "users": {"all": 0, "one_profile": 0, "no_profiles": 0, "many_profiles": 0},
    }
    assert task.clean() == 0
    report = task.markdown_report()
    expected = """\
Users:
  All: 0"""
    assert report == expected


@pytest.mark.django_db
def test_profile_mismatch_with_users() -> None:
    """ProfileMismatchDetector works when data is consistant."""
    setup_profile_mismatch_test_data()

    task = ProfileMismatchDetector()
    assert task.issues() == 0
    assert task.counts == {
        "summary": {"ok": 4, "needs_cleaning": 0},
        "users": {"all": 4, "one_profile": 4, "no_profiles": 0, "many_profiles": 0},
    }
    assert task.clean() == 0
    report = task.markdown_report()
    expected = """\
Users:
  All: 4
    ✓ One Profile: 4 (100.0%)
    No Profile   : 0 (0.0%)
    Many Profiles: 0 (0.0%)"""
    assert report == expected


@pytest.mark.django_db
def test_profile_mismatch_with_problems() -> None:
    """ProfileMismatchDetector detects users with profile issues."""
    setup_profile_mismatch_test_data(add_problems=True)

    task = ProfileMismatchDetector()
    assert task.issues() == 2
    assert task.counts == {
        "summary": {"ok": 4, "needs_cleaning": 2},
        "users": {"all": 6, "one_profile": 4, "no_profiles": 1, "many_profiles": 1},
    }
    assert task.clean() == 0
    report = task.markdown_report()
    expected = """\
Users:
  All: 6
    ✓ One Profile: 4 (66.7%)
    No Profile   : 1 (16.7%)
    Many Profiles: 1 (16.7%)"""
    assert report == expected
