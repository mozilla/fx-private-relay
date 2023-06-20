import json
import logging
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Iterator, Literal
from uuid import uuid4
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.utils import timezone

from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from allauth.account.models import EmailAddress
from cryptography.hazmat.primitives.asymmetric.rsa import (
    RSAPrivateKey,
    generate_private_key,
)
from markus.testing import MetricsMock
from model_bakery import baker
import jwt
import pytest
import responses

from emails.models import (
    DeletedAddress,
    DomainAddress,
    Profile,
    RelayAddress,
    address_hash,
)
from emails.tests.models_tests import unlimited_subscription

from ..apps import PrivateRelayConfig
from ..fxa_utils import NoSocialToken
from ..views import _update_all_data, fxa_verifying_keys


def test_no_social_token():
    exception = NoSocialToken("account_id")
    assert repr(exception) == 'NoSocialToken("account_id")'
    assert (
        str(exception) == 'NoSocialToken: The SocialAccount "account_id" has no token.'
    )


class UpdateExtraDataAndEmailTest(TestCase):
    def test_update_all_data(self):
        user = baker.make(User)
        ea = baker.make(EmailAddress, user=user)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_extra_data = json.loads('{"test": "updated"}')
        new_email = "newemail@example.com"

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202

        sa.refresh_from_db()
        ea.refresh_from_db()

        assert sa.extra_data == new_extra_data
        assert ea.email == new_email

    @patch("privaterelay.views.incr_if_enabled")
    def test_update_newly_premium(self, incr_mocked):
        user = baker.make(User)
        baker.make(EmailAddress, user=user)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_email = "newemail@example.com"
        new_extra_data = json.loads('{"subscriptions": ["premium-relay"]}')

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202
        sa.refresh_from_db()
        assert sa.user.profile.date_subscribed
        assert sa.extra_data == new_extra_data
        incr_mocked.assert_called_once()

    @patch("privaterelay.views.incr_if_enabled")
    def test_update_newly_phone(self, incr_mocked):
        user = baker.make(User)
        baker.make(EmailAddress, user=user)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_email = "newemail@example.com"
        new_extra_data = json.loads('{"subscriptions": ["relay-phones"]}')

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202
        sa.refresh_from_db()
        assert sa.user.profile.date_subscribed_phone
        assert sa.extra_data == new_extra_data
        incr_mocked.assert_called_once()

    def test_update_all_data_conflict(self):
        extra_data = json.loads('{"test": "test"}')

        user = baker.make(User, email="user@example.com")
        baker.make(EmailAddress, user=user, email="user@example.com")
        baker.make(SocialAccount, user=user, provider="fxa", extra_data=extra_data)

        user2 = baker.make(User, email="user2@example.com")
        ea2 = baker.make(EmailAddress, user=user2, email="user2@example.com")
        sa2 = baker.make(
            SocialAccount, user=user2, provider="fxa", extra_data=extra_data
        )

        new_extra_data = json.loads('{"test": "updated"}')
        new_email = "user@example.com"

        response = _update_all_data(sa2, new_extra_data, new_email)

        assert response.status_code == 409

        sa2.refresh_from_db()
        ea2.refresh_from_db()

        # values should be un-changed because of the dupe error
        assert sa2.extra_data == extra_data
        assert ea2.email == "user2@example.com"

    def test_update_all_data_no_email_address(self):
        user = baker.make(User)
        sa = baker.make(
            SocialAccount,
            user=user,
            provider="fxa",
            extra_data=json.loads('{"test": "test"}'),
        )
        new_extra_data = json.loads('{"test": "updated"}')
        new_email = "newemail@example.com"

        response = _update_all_data(sa, new_extra_data, new_email)

        assert response.status_code == 202

        sa.refresh_from_db()
        assert sa.extra_data == new_extra_data

        ea = sa.user.emailaddress_set.get()
        assert ea.email == new_email


@pytest.mark.django_db
def test_logout_page(client, settings):
    user = baker.make(User)
    client.force_login(user)
    settings.ACCOUNT_LOGOUT_ON_GET = False
    response = client.get("/accounts/logout/")
    assert response.status_code == 200


@pytest.mark.parametrize("reload", (True, False))
def test_fxa_verifying_keys(reload: bool) -> None:
    fake_key = {"key": "fake"}
    mock_app = Mock(spec=PrivateRelayConfig)
    mock_app.fxa_verifying_keys = [fake_key]
    with patch("privaterelay.views.apps.get_app_config", return_value=mock_app):
        ret = fxa_verifying_keys(reload)
    assert ret == [fake_key]
    if reload:
        mock_app.ready.assert_called_once_with()
    else:
        mock_app.ready.assert_not_called()


@pytest.fixture(scope="session")
def mock_fxa_signing_key() -> RSAPrivateKey:
    """Return a mock FxA signing key for testing."""
    return generate_private_key(public_exponent=65537, key_size=2048)


@dataclass
class FxaProfileResponse:
    """Components of a mock FxA profile response."""

    status_code: int
    headers: dict[str, str]
    data: dict[str, Any]


@dataclass
class FxaRpEventsSetupData:
    """Test data and mocks yielded by setup_fxa_rp_events."""

    app: SocialApp
    key: RSAPrivateKey
    user: User
    fxa_acct: SocialAccount
    fxa_token: SocialToken
    mock_fxa_verifying_keys: Mock
    mock_responses: responses.RequestsMock
    profile_response: FxaProfileResponse
    ra: RelayAddress
    da: DomainAddress


@pytest.fixture
def setup_fxa_rp_events(
    db, settings, mock_fxa_signing_key
) -> Iterator[FxaRpEventsSetupData]:
    """Setup data for testing /fxa_rp_events."""

    # Adjust settings for tests
    settings.DEBUG = False
    settings.STATSD_ENABLED = True
    settings.SUBSCRIPTIONS_WITH_UNLIMITED = "test-unlimited"
    settings.SUBSCRIPTIONS_WITH_PHONE = "test-phone"

    # Create user subscribed to emails and phones
    user = baker.make(User, email="test@example.com")
    profile = user.profile
    assert isinstance(profile, Profile)
    profile.server_storage = True
    profile.date_subscribed = timezone.now()
    profile.save()

    # Create FxA app, account, token, etc.
    fxa_app: SocialApp = baker.make(SocialApp, provider="fxa")
    fxa_profile_data = {
        "email": user.email,
        "locale": "en-US,en;q=0.5",
        "amrValues": ["pwd", "email"],
        "twoFactorAuthentication": False,
        "metricsEnabled": True,
        "uid": str(uuid4()),
        "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
        "avatarDefault": False,
        "subscriptions": [unlimited_subscription(), "test-phone"],
    }
    fxa_acct: SocialAccount = baker.make(
        SocialAccount,
        user=user,
        provider="fxa",
        uid=fxa_profile_data["uid"],
        extra_data=fxa_profile_data,
    )
    fxa_token: SocialToken = baker.make(
        SocialToken,
        account=fxa_acct,
        app=fxa_app,
        expires_at=timezone.now() + timedelta(days=2),
    )
    baker.make(EmailAddress, user=user, email=user.email)

    ra = baker.make(RelayAddress, user=user)
    profile.add_subdomain("premiumuser")
    da = baker.make(DomainAddress, user=user, address="premium")

    # Setup mock fxa_verifying_key
    fxa_public_key = mock_fxa_signing_key.public_key()
    fxa_public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(fxa_public_key)
    key_data = json.loads(fxa_public_jwk)
    fxa_verifying_key = {
        "kty": key_data["kty"],
        "alg": "RS256",
        "kid": "20221108-d3adb33f",
        "fxa-createdAt": int((timezone.now() - timedelta(days=10)).timestamp()),
        "use": "sig",
        "n": key_data["n"],
        "e": key_data["e"],
    }

    # Setup FxA profile response that does not change the user
    # Tests can change this if they want to simulate a changed profile
    profile_response = FxaProfileResponse(
        status_code=200,
        headers={"content_type": "application/json"},
        data=deepcopy(fxa_profile_data),
    )

    def request_callback(request) -> tuple[int, dict[str, str], str]:
        """Mock an FxA profile response, using data the test may have changed."""
        return (
            profile_response.status_code,
            profile_response.headers,
            json.dumps(profile_response.data),
        )

    with responses.RequestsMock() as mock_responses, patch(
        "privaterelay.views.fxa_verifying_keys", return_value=[fxa_verifying_key]
    ) as mock_fxa_verifying_keys:
        mock_responses.add_callback(
            responses.GET,
            f"{settings.SOCIALACCOUNT_PROVIDERS['fxa']['PROFILE_ENDPOINT']}/profile",
            callback=request_callback,
            content_type="application/json",
        )
        yield FxaRpEventsSetupData(
            app=fxa_app,
            key=mock_fxa_signing_key,
            user=user,
            fxa_acct=fxa_acct,
            fxa_token=fxa_token,
            mock_fxa_verifying_keys=mock_fxa_verifying_keys,
            mock_responses=mock_responses,
            profile_response=profile_response,
            ra=ra,
            da=da,
        )


FxaEventType = Literal[
    "password-change", "profile-change", "subscription-state-change", "delete-user"
]


def get_fxa_event_jwt(
    event_type: FxaEventType,
    fxa_id: str,
    client_id: str,
    signing_key: RSAPrivateKey,
    event_data: dict[str, Any],
    iat_skew: int = 0,
) -> str:
    """
    Return valid Firefox Accounts relying party event JWT

    See https://github.com/mozilla/fxa/tree/main/packages/fxa-event-broker
    """
    event_key = f"https://schemas.accounts.firefox.com/event/{event_type}"
    payload = {
        "iss": "https://accounts.firefox.com/",
        "sub": fxa_id,
        "aud": client_id,
        "iat": int(datetime.utcnow().timestamp()) + iat_skew,
        "jti": str(uuid4()),
        "events": {event_key: event_data},
    }
    return jwt.encode(payload, signing_key, algorithm="RS256")


def test_fxa_rp_events_password_change(
    client: Client, setup_fxa_rp_events: FxaRpEventsSetupData, caplog
) -> None:
    """A password-change event is discarded."""
    setup_fxa_rp_events.mock_responses.reset()  # No profile fetch for password-change
    event_jwt = get_fxa_event_jwt(
        "password-change",
        fxa_id=setup_fxa_rp_events.fxa_acct.uid,
        client_id=setup_fxa_rp_events.app.client_id,
        signing_key=setup_fxa_rp_events.key,
        event_data={"changeTime": int(datetime.utcnow().timestamp()) - 100},
    )
    auth_header = f"Bearer {event_jwt}"

    with MetricsMock() as mm:
        response = client.get("/fxa-rp-events", HTTP_AUTHORIZATION=auth_header)

    assert mm.get_records() == []
    assert caplog.record_tuples == [
        ("request.summary", logging.INFO, ""),
    ]
    assert response.status_code == 200


def test_fxa_rp_events_password_change_slight_future_iat(
    client: Client, setup_fxa_rp_events: FxaRpEventsSetupData, caplog
) -> None:
    """A password-change event created in the near future is discarded."""
    setup_fxa_rp_events.mock_responses.reset()  # No profile fetch for password-change
    event_jwt = get_fxa_event_jwt(
        "password-change",
        fxa_id=setup_fxa_rp_events.fxa_acct.uid,
        client_id=setup_fxa_rp_events.app.client_id,
        signing_key=setup_fxa_rp_events.key,
        event_data={"changeTime": int(datetime.utcnow().timestamp()) - 100},
        iat_skew=3,
    )
    auth_header = f"Bearer {event_jwt}"

    with MetricsMock() as mm:
        response = client.get("/fxa-rp-events", HTTP_AUTHORIZATION=auth_header)

    assert mm.get_records() == []
    assert caplog.record_tuples == [
        ("request.summary", logging.INFO, ""),
    ]
    assert response.status_code == 200


def test_fxa_rp_events_password_change_far_future_iat(
    client: Client, setup_fxa_rp_events: FxaRpEventsSetupData, caplog
) -> None:
    """
    A password-change event created in the far future fails verification.

    PyJWT 2.6.0 checks this, with leeway of 5 seconds (Issue 2738).
    """
    setup_fxa_rp_events.mock_responses.reset()  # No profile fetch for password-change
    event_jwt = get_fxa_event_jwt(
        "password-change",
        fxa_id=setup_fxa_rp_events.fxa_acct.uid,
        client_id=setup_fxa_rp_events.app.client_id,
        signing_key=setup_fxa_rp_events.key,
        event_data={"changeTime": int(datetime.utcnow().timestamp()) - 100},
        iat_skew=10,
    )
    auth_header = f"Bearer {event_jwt}"

    with MetricsMock() as mm, pytest.raises(jwt.ImmatureSignatureError):
        client.get("/fxa-rp-events", HTTP_AUTHORIZATION=auth_header)

    assert mm.get_records() == []
    assert caplog.record_tuples == [
        ("eventsinfo", logging.WARNING, "fxa_rp_event.future_iat"),
        ("request.summary", logging.ERROR, "The token is not yet valid (iat)"),
    ]
    assert -10.0 <= caplog.records[0].iat_age_s < -8.0


def test_fxa_rp_events_profile_change(
    client: Client, setup_fxa_rp_events: FxaRpEventsSetupData, caplog
) -> None:
    """The profile is re-fetched for a profile-change event."""
    setup_fxa_rp_events.profile_response.data["email"] = "new-email@example.com"
    event_jwt = get_fxa_event_jwt(
        "profile-change",
        fxa_id=setup_fxa_rp_events.fxa_acct.uid,
        client_id=setup_fxa_rp_events.app.client_id,
        signing_key=setup_fxa_rp_events.key,
        event_data={"email": "new-email@example.com"},
    )
    auth_header = f"Bearer {event_jwt}"

    with MetricsMock() as mm:
        response = client.get("/fxa-rp-events", HTTP_AUTHORIZATION=auth_header)

    assert mm.get_records() == []
    assert caplog.record_tuples == [
        ("eventsinfo", logging.INFO, "fxa_rp_event"),
        ("request.summary", logging.INFO, ""),
    ]
    assert response.status_code == 200
    user = setup_fxa_rp_events.user
    user.refresh_from_db()
    assert user.email == "new-email@example.com"
    fxa_acct = setup_fxa_rp_events.fxa_acct
    fxa_acct.refresh_from_db()
    assert fxa_acct.extra_data == setup_fxa_rp_events.profile_response.data
    assert fxa_acct.extra_data["email"] == "new-email@example.com"
    email_record = EmailAddress.objects.get(user=user)
    assert email_record.email == "new-email@example.com"


def test_fxa_rp_events_subscription_change(
    client: Client, setup_fxa_rp_events: FxaRpEventsSetupData, caplog
) -> None:
    """A subscription-state-change for an unrelated sub does not change the profile."""
    event_jwt = get_fxa_event_jwt(
        "subscription-state-change",
        fxa_id=setup_fxa_rp_events.fxa_acct.uid,
        client_id=setup_fxa_rp_events.app.client_id,
        signing_key=setup_fxa_rp_events.key,
        event_data={
            "capabilities": ["new_capability"],
            "isActive": True,
            "changeTime": int(datetime.utcnow().timestamp()) - 100,
        },
    )
    auth_header = f"Bearer {event_jwt}"

    with MetricsMock() as mm:
        response = client.get("/fxa-rp-events", HTTP_AUTHORIZATION=auth_header)
    assert mm.get_records() == []
    assert caplog.record_tuples == [
        ("eventsinfo", logging.INFO, "fxa_rp_event"),
        ("request.summary", logging.INFO, ""),
    ]
    assert response.status_code == 200


def test_fxa_rp_events_delete_user(
    client: Client, setup_fxa_rp_events: FxaRpEventsSetupData, caplog
) -> None:
    """A delete-user event deletes the user."""
    setup_fxa_rp_events.mock_responses.reset()  # No profile fetch for delete-user
    event_jwt = get_fxa_event_jwt(
        "delete-user",
        fxa_id=setup_fxa_rp_events.fxa_acct.uid,
        client_id=setup_fxa_rp_events.app.client_id,
        signing_key=setup_fxa_rp_events.key,
        event_data={},
    )
    auth_header = f"Bearer {event_jwt}"

    ra = setup_fxa_rp_events.ra
    da = setup_fxa_rp_events.da
    assert isinstance(ra, RelayAddress)
    assert RelayAddress.objects.filter(id=ra.id).exists()
    assert DomainAddress.objects.filter(id=da.id).exists()
    assert not DeletedAddress.objects.filter(
        address_hash=address_hash(ra.address)
    ).exists()
    assert not DeletedAddress.objects.filter(
        address_hash=address_hash(da.address)
    ).exists()

    with MetricsMock() as mm:
        response = client.get("/fxa-rp-events", HTTP_AUTHORIZATION=auth_header)
    assert mm.get_records() == []
    assert caplog.record_tuples == [
        ("eventsinfo", logging.INFO, "fxa_rp_event"),
        ("request.summary", logging.INFO, ""),
    ]
    assert response.status_code == 200
    assert not User.objects.filter(id=setup_fxa_rp_events.user.id).exists()
    assert not RelayAddress.objects.filter(id=ra.id).exists()
    assert not DomainAddress.objects.filter(id=da.id).exists()
    ra_address_hash = address_hash(ra.address)
    assert DeletedAddress.objects.filter(address_hash=ra_address_hash).exists()
    da_address_hash = address_hash(
        da.address, da.user.profile.subdomain, da.domain_value
    )
    assert DeletedAddress.objects.filter(address_hash=da_address_hash).exists()
