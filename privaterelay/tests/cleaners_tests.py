"""Tests for privaterelay.cleaners"""

from itertools import product
from uuid import uuid4

from django.contrib.auth.models import User

import pytest
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount, SocialApp
from model_bakery import baker

from privaterelay.cleaner_task import DataItem
from privaterelay.cleaners import IDNAEmailCleaner, MissingEmailCleaner


def setup_missing_email_cleaner_test_data(provider_id: str = "") -> None:
    """
    Setup users and addresses for testing.

    provider_id: Set a provider ID for the SocialApp. When set, it is used as the
    provider string for the SocialAccount. When it is a blank string, the default
    id, 'fxa', is used.
    """

    def yn(has_item: bool) -> str:
        return "yes" if has_item else "no"

    social_app: SocialApp | None = None
    for has_email, has_fxa, has_fxa_email in product((True, False), repeat=3):
        key = f"{yn(has_email)}_email_{yn(has_fxa)}_fxa_{yn(has_fxa_email)}_fxa_email"
        if has_email:
            user = baker.make(User, email=f"{key}@example.com", username=key)
        else:
            user = baker.make(User, username=key)
        if has_fxa:
            extra = {"uid": str(uuid4())}
            if has_fxa_email:
                extra["email"] = f"{key}.FXA@example.com"
            if social_app is None:
                social_app = baker.make(
                    SocialApp,
                    name="example.com",
                    provider="fxa",
                    provider_id=provider_id,
                    client_id="client_id",
                )
            baker.make(
                SocialAccount,
                provider=social_app.provider_id or social_app.provider,
                user=user,
                extra_data=extra,
            )


@pytest.mark.django_db
def test_missing_email_cleaner_no_data() -> None:
    """MissingEmailCleaner works on an empty database."""
    cleaner = MissingEmailCleaner()
    assert cleaner.issues() == 0
    assert cleaner.counts == {
        "summary": {"ok": 0, "needs_cleaning": 0},
        "users": {"!email": 0, "!email.fxa": 0, "all": 0, "email": 0},
    }
    assert cleaner.clean() == 0
    report = cleaner.markdown_report()
    expected = """\
Users:
  All: 0"""
    assert report == expected


@pytest.mark.parametrize("provider_id", ("", "fxa", "test.example.com"))
@pytest.mark.django_db
def test_missing_email_cleaner_data_to_clear(provider_id: str) -> None:
    """MissingEmailCleaner detects that some users do not have email."""
    setup_missing_email_cleaner_test_data(provider_id)
    cleaner = MissingEmailCleaner()
    assert cleaner.issues() == 2
    assert cleaner.counts == {
        "summary": {"ok": 4, "needs_cleaning": 2},
        "users": {"!email": 4, "!email.fxa": 2, "all": 8, "email": 4},
    }
    assert cleaner.clean() == 1
    report = cleaner.markdown_report()
    expected = """\
Users:
  All: 8
    Email   : 4 ( 50.0%)
    No Email: 4 ( 50.0%)
      Has FxA: 2 ( 50.0%)
        Cleaned: 1 ( 50.0%)"""
    assert report == expected


@pytest.mark.parametrize("provider_id", ("", "fxa", "test.example.com"))
@pytest.mark.django_db
def test_missing_email_cleaner_data_clean_users_handles_missing_fxa_data(
    provider_id: str,
) -> None:
    """The cleaner function works with FxA data, or no 'email' in the extra_data"""
    setup_missing_email_cleaner_test_data(provider_id)
    cleaner = MissingEmailCleaner()
    item = cleaner.data_items["users.!email"]
    assert isinstance(item, DataItem)
    assert item.count() == 4
    assert cleaner.clean_users(item.get_queryset()) == 1


@pytest.mark.django_db
def test_idna_email_cleaner_no_data() -> None:
    """IDNAEmailCleaner works on an empty database."""
    cleaner = IDNAEmailCleaner()
    assert cleaner.issues() == 0
    assert cleaner.counts == {
        "summary": {"ok": 0, "needs_cleaning": 0},
        "users": {"!ascii_domain": 0, "ascii_domain": 0, "all": 0},
    }
    assert cleaner.clean() == 0
    report = cleaner.markdown_report()
    expected = """\
Users:
  All: 0"""
    assert report == expected


@pytest.mark.django_db
def test_idna_email_cleaner_valid_ascii_emails_skipped() -> None:
    """Emails with ASCII-only domains are not modified."""
    baker.make(User, email="ascii@example.com", username="ascii_user")
    cleaner = IDNAEmailCleaner()
    assert cleaner.issues() == 0
    assert cleaner.clean() == 0
    assert User.objects.get(username="ascii_user").email == "ascii@example.com"


@pytest.mark.django_db
def test_idna_email_cleaner_converts_non_ascii_domains() -> None:
    """Emails with non-ASCII domains are converted to Punycode."""
    user = baker.make(User, email="test@nçaismo.com", username="nonascii_user")
    ea: EmailAddress = baker.make(EmailAddress, user=user, email=user.email)
    sa: SocialAccount = baker.make(
        SocialAccount, user=user, extra_data={"email": user.email}
    )
    cleaner = IDNAEmailCleaner()

    assert cleaner.issues() == 1
    assert cleaner.counts["users"]["!ascii_domain"] == 1
    assert cleaner.clean() == 1

    user.refresh_from_db()
    assert user.email == "test@xn--naismo-wua.com"
    ea.refresh_from_db()
    assert ea.email == user.email
    sa.refresh_from_db()
    assert sa.extra_data["email"] == user.email


@pytest.mark.django_db
def test_idna_email_cleaner_ignores_invalid_emails() -> None:
    """Malformed emails without @ are skipped gracefully."""
    baker.make(User, email="bademail", username="broken_user")
    cleaner = IDNAEmailCleaner()
    assert cleaner.issues() == 0
    assert cleaner.clean() == 0
