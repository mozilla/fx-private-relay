import os
import random
import string
import uuid
from io import StringIO

from django.core.management import call_command

import pytest
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

COMMAND_NAME = "deactivate_user"


@pytest.mark.django_db
def test_deactivate_by_api_key() -> None:
    sa: SocialAccount = baker.make(SocialAccount, provider="fxa")
    api_token = sa.user.profile.api_token
    out = StringIO()

    call_command(COMMAND_NAME, key=f"{api_token}", stdout=out)

    output = out.getvalue()
    assert f"SUCCESS: deactivated user with api_token: {api_token}\n" == output
    sa.user.refresh_from_db()
    assert sa.user.is_active is False


@pytest.mark.django_db
def test_deactivate_by_api_key_does_not_exist() -> None:
    out = StringIO()
    api_token = uuid.uuid4()

    call_command(COMMAND_NAME, key=f"{api_token}", stdout=out)

    output = out.getvalue()
    assert "ERROR: Could not find user with that API key.\n" == output


@pytest.mark.django_db
def test_deactivate_by_email() -> None:
    localpart = "".join(random.choice(string.ascii_lowercase) for i in range(9))
    email = f"{localpart}@test.com"
    sa: SocialAccount = baker.make(SocialAccount, provider="fxa")
    sa.user.email = email
    sa.user.save()
    out = StringIO()

    call_command(COMMAND_NAME, email=f"{email}", stdout=out)

    output = out.getvalue()
    assert f"SUCCESS: deactivated user with email: {email}\n" == output
    sa.user.refresh_from_db()
    assert sa.user.is_active is False


@pytest.mark.django_db
def test_deactivate_by_email_does_not_exist() -> None:
    out = StringIO()
    localpart = "".join(random.choice(string.ascii_lowercase) for i in range(9))
    email = f"{localpart}@test.com"

    call_command(COMMAND_NAME, email=f"{email}", stdout=out)

    output = out.getvalue()
    assert "ERROR: Could not find user with that email address.\n" == output


@pytest.mark.django_db
def test_deactivate_by_fxa_uid() -> None:
    sa: SocialAccount = baker.make(SocialAccount, provider="fxa")
    out = StringIO()

    call_command(COMMAND_NAME, uid=f"{sa.uid}", stdout=out)

    output = out.getvalue()
    assert f"SUCCESS: deactivated user with FXA UID: {sa.uid}\n" == output
    sa.user.refresh_from_db()
    assert sa.user.is_active is False


@pytest.mark.django_db
def test_deactivate_by_fxa_uid_does_not_exist() -> None:
    out = StringIO()
    uid = os.urandom(16).hex()

    call_command(COMMAND_NAME, uid=f"{uid}", stdout=out)

    output = out.getvalue()
    assert "ERROR: Could not find user with that FXA UID.\n" == output
