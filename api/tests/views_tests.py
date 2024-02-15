from datetime import datetime
import logging
from allauth.account.models import EmailAddress
import pytest
from model_bakery import baker
import responses

from django.contrib.auth.models import User
from django.contrib.sites.models import Site
from django.core.cache import cache
from django.test import RequestFactory, TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from allauth.socialaccount.models import SocialAccount, SocialApp
from waffle.testutils import override_flag

from api.authentication import get_cache_key, INTROSPECT_TOKEN_URL
from api.tests.authentication_tests import (
    _setup_fxa_response,
    _setup_fxa_response_no_json,
)
from api.views import FXA_PROFILE_URL
from emails.models import Profile, RelayAddress, DomainAddress
from emails.tests.models_tests import make_free_test_user, make_premium_test_user
from privaterelay.tests.utils import log_extra, get_glean_event


@pytest.fixture
def free_user(db) -> User:
    return make_free_test_user()


@pytest.fixture
def free_api_client(free_user: User) -> APIClient:
    """Return an APIClient for a newly created free user."""
    client = APIClient()
    client.force_authenticate(user=free_user)
    return client


@pytest.fixture
def premium_user(db) -> User:
    premium_user = make_premium_test_user()
    premium_profile = premium_user.profile
    premium_profile.subdomain = "premium"
    premium_profile.save()
    return premium_user


@pytest.fixture
def prem_api_client(premium_user: User) -> APIClient:
    """Return an APIClient for a newly created premium user."""
    client = APIClient()
    client.force_authenticate(user=premium_user)
    return client


@pytest.fixture
def fxa_social_app(db) -> SocialApp:
    app: SocialApp = baker.make(SocialApp, provider="fxa", sites=[Site.objects.first()])
    return app


@pytest.mark.parametrize("subpath", ("swagger", "swagger.", "swagger.txt"))
def test_swagger_unknown_format(client, subpath):
    path = f"/api/v1/{subpath}/"
    response = client.get(path)
    assert response.status_code == 404


@pytest.mark.django_db
def test_runtime_data(client):
    path = "/api/v1/runtime_data/"
    response = client.get(path)
    assert response.status_code == 200


def test_post_domainaddress_success(prem_api_client, premium_user, caplog) -> None:
    """A premium user can create a domain address."""
    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )
    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]
    assert ret_data["full_address"].startswith("my-new-mask@premium.")
    address = premium_user.domainaddress_set.get()

    event = get_glean_event(caplog)
    assert event is not None
    date_joined_ts = int(premium_user.date_joined.timestamp())
    date_subscribed_ts = int(premium_user.profile.date_subscribed.timestamp())
    assert event == {
        "category": "email_mask",
        "name": "created",
        "extra": {
            "client_id": "",
            "fxa_id": premium_user.profile.fxa.uid,
            "platform": "",
            "n_random_masks": "0",
            "n_domain_masks": "1",
            "n_deleted_random_masks": "0",
            "n_deleted_domain_masks": "0",
            "date_joined_relay": str(date_joined_ts),
            "premium_status": "email_unknown",
            "date_joined_premium": str(date_subscribed_ts),
            "has_extension": "false",
            "date_got_extension": "-1",
            "mask_id": address.metrics_id,
            "is_random_mask": "false",
            "created_by_api": "true",
            "has_website": "false",
        },
        "timestamp": event["timestamp"],
    }


def test_post_domainaddress_no_subdomain_error(
    premium_user, prem_api_client, caplog
) -> None:
    """A premium user needs to select a subdomain before creating a domain address."""
    premium_profile = premium_user.profile
    premium_profile.subdomain = ""
    premium_profile.save()

    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )

    assert response.status_code == 400
    ret_data = response.json()
    assert ret_data == {
        "detail": ("Please select a subdomain before creating a custom email address."),
        "error_code": "need_subdomain",
    }
    event = get_glean_event(caplog)
    assert event is None


def test_patch_premium_user_subdomain_cannot_be_changed(
    premium_user, prem_api_client
) -> None:
    """A premium user should not be able to edit their subdomain."""
    premium_profile = premium_user.profile
    original_subdomain = "helloworld"
    premium_profile.subdomain = original_subdomain
    premium_profile.save()

    new_subdomain = "helloworldd"
    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={"subdomain": new_subdomain},
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert ret_data.get("subdomain", [""])[0] == "This field is read only"
    assert premium_profile.subdomain == original_subdomain
    assert response.status_code == 400


def test_patch_profile_fields_are_read_only_by_default(premium_user, prem_api_client):
    """
    A field in the Profile model should be read only by default, and return a 400
    response code (see StrictReadOnlyFieldsMixin in api/serializers/__init__.py), if it
    is not mentioned in the ProfileSerializer class fields.

    Two fields were tested, num_address_deleted, and sent_welcome_email to see if the
    behavior matches what is described here:
    https://www.django-rest-framework.org/api-guide/serializers/#specifying-read-only-fields
    """
    premium_profile = premium_user.profile
    expected_num_address_deleted = premium_profile.num_address_deleted
    expected_sent_welcome_email = premium_profile.sent_welcome_email

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={
            "num_address_deleted": 5,
            "sent_welcome_email": True,
        },
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert premium_profile.num_address_deleted == expected_num_address_deleted
    assert premium_profile.sent_welcome_email == expected_sent_welcome_email
    assert ret_data.get("sent_welcome_email", [""])[0] == "This field is read only"
    assert ret_data.get("num_address_deleted", [""])[0] == "This field is read only"
    assert response.status_code == 400


def test_profile_non_read_only_fields_update_correctly(premium_user, prem_api_client):
    """
    A field that is not read only should update correctly on a patch request.

    "Not read only" meaning that it was defined in the serializers fields, but not
    read_only_fields.
    """
    premium_profile = premium_user.profile
    old_onboarding_state = premium_profile.onboarding_state
    old_email_tracker_remove_value = premium_profile.remove_level_one_email_trackers

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={
            "onboarding_state": 1,
            "remove_level_one_email_trackers": True,
        },
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert (
        ret_data.get("remove_level_one_email_trackers", None)
        != old_email_tracker_remove_value
    )
    assert (
        premium_profile.remove_level_one_email_trackers
        != old_email_tracker_remove_value
    )
    assert premium_profile.remove_level_one_email_trackers is True
    assert ret_data.get("remove_level_one_email_trackers", None) is True
    assert ret_data.get("onboarding_state", None) != old_onboarding_state
    assert premium_profile.onboarding_state == 1
    assert ret_data.get("onboarding_state", None) == 1
    assert response.status_code == 200


def test_profile_patch_with_model_and_serializer_fields(premium_user, prem_api_client):
    premium_profile = premium_user.profile

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={"subdomain": "vanilla", "num_address_deleted": 5},
        format="json",
    )

    premium_profile.refresh_from_db()

    assert response.status_code == 400
    assert premium_profile.subdomain != "vanilla"
    assert premium_profile.num_address_deleted == 0


def test_profile_patch_with_non_read_only_and_read_only_fields(
    premium_user, prem_api_client
):
    """A request that includes at least one read only field will give a 400 response"""
    premium_profile = premium_user.profile
    old_onboarding_state = premium_profile.onboarding_state

    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_profile.id]),
        data={"onboarding_state": 1, "subdomain": "vanilla"},
        format="json",
    )

    ret_data = response.json()
    premium_profile.refresh_from_db()

    assert premium_profile.onboarding_state == old_onboarding_state
    assert ret_data.get("subdomain", [""])[0] == "This field is read only"
    assert response.status_code == 400


def test_profile_patch_fields_that_dont_exist(premium_user, prem_api_client):
    """
    A request sent with only fields that don't exist give a 200 response (this is the
    default behavior django provides, we decided to leave it as is)
    """
    response = prem_api_client.patch(
        reverse(viewname="profiles-detail", args=[premium_user.profile.id]),
        data={
            "nonsense": False,
            "blabla": "blabla",
        },
        format="json",
    )

    assert response.status_code == 200


def test_post_domainaddress_user_flagged_error(
    premium_user, prem_api_client, caplog
) -> None:
    """A flagged user cannot create a new domain address."""
    premium_profile = premium_user.profile
    premium_profile.last_account_flagged = timezone.now()
    premium_profile.save()

    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "my-new-mask"},
        format="json",
    )

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "detail": "Your account is on pause.",
        "error_code": "account_is_paused",
    }

    event = get_glean_event(caplog)
    assert event is None


def test_post_domainaddress_bad_address_error(prem_api_client, caplog) -> None:
    """A domain address can be rejected due to the address format or content."""
    response = prem_api_client.post(
        reverse("domainaddress-list"),
        data={"address": "myNewAlias"},
        format="json",
    )

    assert response.status_code == 400
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation. See:
    # https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation
    assert ret_data == {
        "detail": (
            "“\u2068myNewAlias\u2069” could not be created."
            " Please try again with a different mask name."
        ),
        "error_code": "address_unavailable",
        "error_context": {"unavailable_address": "myNewAlias"},
    }

    event = get_glean_event(caplog)
    assert event is None


def test_post_domainaddress_free_user_error(free_api_client, caplog):
    """A free user is not allowed to create a domain address."""
    response = free_api_client.post(
        reverse("domainaddress-list"), data={"address": "my-new-alias"}, format="json"
    )

    assert response.status_code == 403
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation. See:
    # https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation
    assert ret_data == {
        "detail": (
            "Your free account does not include custom subdomains for masks."
            " To create custom masks, upgrade to \u2068Relay Premium\u2069."
        ),
        "error_code": "free_tier_no_subdomain_masks",
    }

    event = get_glean_event(caplog)
    assert event is None


@pytest.mark.django_db(transaction=True)
def test_post_domainaddress_conflict_existing(prem_api_client, premium_user, caplog):
    """A user can not create a duplicate domain address."""
    DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    response = prem_api_client.post(
        reverse("domainaddress-list"), data={"address": "my-new-alias"}, format="json"
    )

    assert response.status_code == 409
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation. See:
    # https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation
    assert ret_data == {
        "detail": (
            "“\u2068my-new-alias\u2069” already exists."
            " Please try again with a different mask name."
        ),
        "error_code": "duplicate_address",
        "error_context": {"duplicate_address": "my-new-alias"},
    }

    event = get_glean_event(caplog)
    assert event is None


@pytest.mark.django_db(transaction=True)
@override_flag("custom_domain_management_redesign", active=True)
def test_post_domainaddress_conflict_deleted(prem_api_client, premium_user, caplog):
    """A user can not create a domain address that matches a deleted address."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    existing.delete()
    response = prem_api_client.post(
        reverse("domainaddress-list"), data={"address": "my-new-alias"}, format="json"
    )

    assert response.status_code == 400
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation. See:
    # https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation
    assert ret_data == {
        "detail": (
            "“\u2068my-new-alias\u2069” could not be created."
            " Please try again with a different mask name."
        ),
        "error_code": "address_unavailable",
        "error_context": {"unavailable_address": "my-new-alias"},
    }

    event = get_glean_event(caplog)
    assert event is None


@pytest.mark.parametrize(
    "key,value",
    [
        ("enabled", False),
        ("description", "My New Alias"),
        ("block_list_emails", True),
        ("used_on", "example.com"),
    ],
)
def test_patch_domainaddress(prem_api_client, premium_user, key, value) -> None:
    """PATCH can update a writable field for a domain address."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    assert getattr(existing, key) != value
    url = reverse("domainaddress-detail", args=[existing.id])
    response = prem_api_client.patch(url, data={key: value})

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data[key] == value
    existing.refresh_from_db()
    assert getattr(existing, key) == value


@pytest.mark.parametrize("key", ("enabled", "description", "block_list_emails"))
def test_patch_domainaddress_same_value(prem_api_client, premium_user, key) -> None:
    """PATCH can write the same value to a writable field for a domain address."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    value = getattr(existing, key)
    url = reverse("domainaddress-detail", args=[existing.id])
    response = prem_api_client.patch(url, data={key: value})

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data[key] == value
    existing.refresh_from_db()
    assert getattr(existing, key) == value


@pytest.mark.parametrize("value", ("", None))
def test_patch_domainaddress_same_value_used_on(
    prem_api_client, premium_user, value
) -> None:
    """
    PATCH can write an empty value to used_on on a domain address.

    The default form-encoding can not encode None, so we force JSON mode.
    """
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    assert existing.used_on is None
    url = reverse("domainaddress-detail", args=[existing.id])
    response = prem_api_client.patch(url, data={"used_on": value}, format="json")

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data["used_on"] == value
    existing.refresh_from_db()
    assert existing.used_on == value


@pytest.mark.parametrize(
    "key,value",
    [
        ("id", -1),
        # TODO: Make address a read-only field
        pytest.param("address", "a-different-alias", marks=pytest.mark.xfail),
        ("domain", 1),
        ("full_address", "a-different-alias@premium.test.com"),
        ("created_at", "2024-02-15"),
        ("last_used_at", "2024-02-15"),
        ("num_forwarded", -1),
        ("num_blocked", -1),
        ("num_spam", -1),
        ("num_level_one_trackers_blocked", -1),
        ("num_replied", -1),
    ],
)
def test_patch_domainaddress_read_only(
    prem_api_client, premium_user, key, value
) -> None:
    """PATCH succeeds but does not change read-only fields."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    old_value = getattr(existing, key)
    old_modified_at = existing.last_modified_at
    assert old_value != value
    url = reverse("domainaddress-detail", args=[existing.id])
    old_json = prem_api_client.get(url).json()
    response = prem_api_client.patch(url, data={key: value})

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data[key] == old_json[key]
    existing.refresh_from_db()
    assert getattr(existing, key) == old_value
    assert existing.last_modified_at > old_modified_at


def test_patch_domainaddress_read_only_mask_type(prem_api_client, premium_user) -> None:
    """PATCH succeeds but does not change or return the mask_type."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    url = reverse("domainaddress-detail", args=[existing.id])
    get_json = prem_api_client.get(url).json()
    assert get_json["mask_type"] == "custom"
    response = prem_api_client.patch(url, data={"mask_type": "random"})

    assert response.status_code == 200
    ret_data = response.json()
    assert "mask_type" not in ret_data


def test_delete_domainaddress(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    existing = DomainAddress.objects.create(user=premium_user, address="my-doomed-mask")
    existing_mask_id = existing.metrics_id
    url = reverse("domainaddress-detail", args=[existing.id])
    response = prem_api_client.delete(url)
    assert response.status_code == 204
    assert not DomainAddress.objects.filter(id=existing.id).exists()

    event = get_glean_event(caplog)
    assert premium_user.profile.fxa
    assert premium_user.profile.date_subscribed
    date_subscribed_ts = int(premium_user.profile.date_subscribed.timestamp())
    assert event is not None
    assert event == {
        "category": "email_mask",
        "name": "deleted",
        "extra": {
            "client_id": "",
            "fxa_id": premium_user.profile.fxa.uid,
            "platform": "",
            "n_random_masks": "0",
            "n_domain_masks": "0",
            "n_deleted_random_masks": "0",
            "n_deleted_domain_masks": "1",
            "date_joined_relay": str(int(premium_user.date_joined.timestamp())),
            "premium_status": "email_unknown",
            "date_joined_premium": str(date_subscribed_ts),
            "has_extension": "false",
            "date_got_extension": "-1",
            "mask_id": existing_mask_id,
            "is_random_mask": "false",
        },
        "timestamp": event["timestamp"],
    }


def test_post_relayaddress_success(free_api_client, free_user, caplog) -> None:
    """A free user is able to create a random address."""
    response = free_api_client.post(
        reverse("relayaddress-list"), data={}, format="json"
    )

    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]
    address = free_user.relayaddress_set.get()

    event = get_glean_event(caplog)
    assert event is not None
    assert event == {
        "category": "email_mask",
        "name": "created",
        "extra": {
            "client_id": "",
            "fxa_id": free_user.profile.fxa.uid,
            "platform": "",
            "n_random_masks": "1",
            "n_domain_masks": "0",
            "n_deleted_random_masks": "0",
            "n_deleted_domain_masks": "0",
            "date_joined_relay": str(int(free_user.date_joined.timestamp())),
            "premium_status": "free",
            "date_joined_premium": "-1",
            "has_extension": "false",
            "date_got_extension": "-1",
            "mask_id": address.metrics_id,
            "is_random_mask": "true",
            "created_by_api": "true",
            "has_website": "false",
        },
        "timestamp": event["timestamp"],
    }


def test_post_relayaddress_with_generated_for_success(
    free_api_client, free_user, caplog
) -> None:
    """A mask generated on a website sets has_generated_for"""
    response = free_api_client.post(
        reverse("relayaddress-list"),
        data={"generated_for": "example.com"},
        format="json",
    )
    assert response.status_code == 201
    address = free_user.relayaddress_set.get()

    event = get_glean_event(caplog)
    assert event is not None
    assert event == {
        "category": "email_mask",
        "name": "created",
        "extra": {
            "client_id": "",
            "fxa_id": free_user.profile.fxa.uid,
            "platform": "",
            "n_random_masks": "1",
            "n_domain_masks": "0",
            "n_deleted_random_masks": "0",
            "n_deleted_domain_masks": "0",
            "date_joined_relay": str(int(free_user.date_joined.timestamp())),
            "premium_status": "free",
            "date_joined_premium": "-1",
            "has_extension": "true",
            "date_got_extension": str(int(address.created_at.timestamp())),
            "mask_id": address.metrics_id,
            "is_random_mask": "true",
            "has_website": "true",
            "created_by_api": "true",
        },
        "timestamp": event["timestamp"],
    }


def test_post_relayaddress_free_mask_email_limit_error(
    settings, free_user, free_api_client, caplog
) -> None:
    """A free user is unable to exceed the mask limit."""
    for _ in range(settings.MAX_NUM_FREE_ALIASES):
        baker.make(RelayAddress, user=free_user)

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 403
    ret_data = response.json()
    # Add unicode characters to get around Fluent.js using unicode isolation. See:
    # https://github.com/projectfluent/fluent.js/wiki/Unicode-Isolation

    assert ret_data == {
        "detail": (
            "You’ve used all"
            f" \u2068{settings.MAX_NUM_FREE_ALIASES}\u2069 email masks included with"
            " your free account. You can reuse an existing mask, but using a unique"
            " mask for each account is the most secure option."
        ),
        "error_code": "free_tier_limit",
        "error_context": {"free_tier_limit": 5},
    }
    assert get_glean_event(caplog) is None


def test_post_relayaddress_flagged_error(free_user, free_api_client, caplog) -> None:
    """A flagged user is unable to create a random mask."""
    free_profile = free_user.profile
    free_profile.last_account_flagged = timezone.now()
    free_profile.save()

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "detail": "Your account is on pause.",
        "error_code": "account_is_paused",
    }
    assert get_glean_event(caplog) is None


@pytest.mark.parametrize(
    "key,value",
    [
        ("enabled", False),
        ("description", "My New Alias"),
        ("generated_for", "example.com"),
        ("used_on", "example.com"),
    ],
)
def test_patch_relayaddress(free_api_client, free_user, key, value) -> None:
    """PATCH can update a writable field for a random address."""
    existing = RelayAddress.objects.create(user=free_user)
    assert getattr(existing, key) != value
    url = reverse("relayaddress-detail", args=[existing.id])
    response = free_api_client.patch(url, data={key: value})

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data[key] == value
    existing.refresh_from_db()
    assert getattr(existing, key) == value


@pytest.mark.parametrize(
    "key", ("enabled", "description", "generated_for", "block_list_emails")
)
def test_patch_relayaddress_same_value(free_api_client, free_user, key) -> None:
    """PATCH can write the same value to a writable field for a random address."""
    existing = RelayAddress.objects.create(user=free_user)
    value = getattr(existing, key)
    url = reverse("relayaddress-detail", args=[existing.id])
    response = free_api_client.patch(url, data={key: value})

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data[key] == value
    existing.refresh_from_db()
    assert getattr(existing, key) == value


@pytest.mark.parametrize("value", ("", None))
def test_patch_relayaddress_same_value_used_on(
    free_api_client, free_user, value
) -> None:
    """
    PATCH can write an empty value to used_on on a random address.

    The default form-encoding can not encode None, so we force JSON mode.
    """
    existing = RelayAddress.objects.create(user=free_user)
    assert existing.used_on is None
    url = reverse("relayaddress-detail", args=[existing.id])
    response = free_api_client.patch(url, data={"used_on": value}, format="json")

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data["used_on"] == value
    existing.refresh_from_db()
    assert existing.used_on == value


@pytest.mark.parametrize(
    "key,value",
    [
        ("id", -1),
        ("address", "a-different-alias"),
        ("domain", 1),
        ("full_address", "a-different-alias@premium.test.com"),
        ("created_at", "2024-02-15"),
        ("last_used_at", "2024-02-15"),
        ("num_forwarded", -1),
        ("num_blocked", -1),
        ("num_spam", -1),
        ("num_level_one_trackers_blocked", -1),
        ("num_replied", -1),
    ],
)
def test_patch_relayaddress_read_only(free_api_client, free_user, key, value) -> None:
    """PATCH succeeds but does not change read-only fields."""
    existing = RelayAddress.objects.create(user=free_user)
    old_value = getattr(existing, key)
    old_modified_at = existing.last_modified_at
    assert old_value != value
    url = reverse("relayaddress-detail", args=[existing.id])
    old_json = free_api_client.get(url).json()
    response = free_api_client.patch(url, data={key: value})

    assert response.status_code == 200
    ret_data = response.json()
    assert ret_data[key] == old_json[key]
    existing.refresh_from_db()
    assert getattr(existing, key) == old_value
    assert existing.last_modified_at > old_modified_at


def test_patch_relayaddress_read_only_mask_type(free_api_client, free_user) -> None:
    """PATCH succeeds but does not change or return the mask_type."""
    existing = RelayAddress.objects.create(user=free_user)
    url = reverse("relayaddress-detail", args=[existing.id])
    get_json = free_api_client.get(url).json()
    assert get_json["mask_type"] == "random"
    response = free_api_client.patch(url, data={"mask_type": "custom"})

    assert response.status_code == 200
    ret_data = response.json()
    assert "mask_type" not in ret_data


def test_patch_relayaddress_free_user_cannot_set_block_list_emails(
    free_user, free_api_client, caplog
) -> None:
    """A free user cannot set block_list_emails to True"""
    ra = baker.make(RelayAddress, user=free_user, enabled=True, block_list_emails=False)
    response = free_api_client.patch(
        reverse("relayaddress-detail", args=[ra.id]),
        {"enabled": False, "block_list_emails": True},
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Must be premium to set block_list_emails."}
    ra.refresh_from_db()
    assert ra.enabled is True
    assert ra.block_list_emails is False
    assert get_glean_event(caplog) is None


def test_patch_relayaddress_format_premium_user_can_clear_block_list_emails(
    premium_user, prem_api_client, caplog
) -> None:
    """A formerly-premium user can set block_list_emails to False"""
    # Create a Relay Address with promotions blocked
    ra = baker.make(
        RelayAddress, user=premium_user, enabled=False, block_list_emails=True
    )

    # Unsubscribe the premium user
    fxa_account = premium_user.profile.fxa
    fxa_account.extra_data["subscriptions"] = []
    fxa_account.save()
    assert not premium_user.profile.has_premium

    # Re-enable the Relay Address
    response = prem_api_client.patch(
        reverse("relayaddress-detail", args=[ra.id]),
        {"enabled": True, "block_list_emails": False},
        format="json",
    )
    assert response.status_code == 200
    ra.refresh_from_db()
    assert ra.enabled is True
    assert ra.block_list_emails is False
    assert get_glean_event(caplog) is None


def test_delete_randomaddress(
    free_api_client: APIClient, free_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    existing = RelayAddress.objects.create(user=free_user)
    existing_mask_id = existing.metrics_id
    url = reverse("relayaddress-detail", args=[existing.id])
    response = free_api_client.delete(url)
    assert response.status_code == 204
    assert not RelayAddress.objects.filter(id=existing.id).exists()

    event = get_glean_event(caplog)
    assert free_user.profile.fxa
    assert event is not None
    assert event == {
        "category": "email_mask",
        "name": "deleted",
        "extra": {
            "client_id": "",
            "fxa_id": free_user.profile.fxa.uid,
            "platform": "",
            "n_random_masks": "0",
            "n_domain_masks": "0",
            "n_deleted_random_masks": "1",
            "n_deleted_domain_masks": "0",
            "date_joined_relay": str(int(free_user.date_joined.timestamp())),
            "premium_status": "free",
            "date_joined_premium": "-1",
            "has_extension": "false",
            "date_got_extension": "-1",
            "mask_id": existing_mask_id,
            "is_random_mask": "true",
        },
        "timestamp": event["timestamp"],
    }


@pytest.mark.usefixtures("fxa_social_app")
class TermsAcceptedUserViewTest(TestCase):
    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.path = "/api/v1/terms-accepted-user/"
        self.fxa_verify_path = INTROSPECT_TOKEN_URL
        self.uid = "relay-user-fxa-uid"

    def _setup_client(self, token: str) -> None:
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def tearDown(self) -> None:
        cache.clear()

    @responses.activate
    def test_201_new_user_created_and_202_user_exists(self) -> None:
        email = "user@email.com"
        user_token = "user-123"
        self._setup_client(user_token)
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        fxa_response = _setup_fxa_response(
            200, {"active": True, "sub": self.uid, "exp": exp_time}
        )
        # setup fxa profile reponse
        profile_json = {
            "email": email,
            "amrValues": ["pwd", "email"],
            "twoFactorAuthentication": False,
            "metricsEnabled": True,
            "uid": self.uid,
            "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
            "avatarDefault": False,
        }
        responses.add(
            responses.GET,
            FXA_PROFILE_URL,
            status=200,
            json=profile_json,
        )
        cache_key = get_cache_key(user_token)

        # get fxa response with 201 response for new user and profile created
        response = self.client.post(self.path)
        assert response.status_code == 201
        assert hasattr(response, "data")
        assert response.data is None
        # ensure no session cookie was set
        assert len(response.cookies.keys()) == 1
        assert "csrftoken" in response.cookies
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True
        assert cache.get(cache_key) == fxa_response
        assert SocialAccount.objects.filter(user__email=email).count() == 1
        assert Profile.objects.filter(user__email=email).count() == 1
        assert Profile.objects.get(user__email=email).created_by == "firefox_resource"

        # now check that the 2nd call returns 202
        response = self.client.post(self.path)
        assert response.status_code == 202
        assert hasattr(response, "data")
        assert response.data is None
        assert responses.assert_call_count(self.fxa_verify_path, 2) is True
        assert responses.assert_call_count(FXA_PROFILE_URL, 1) is True

    @responses.activate
    def test_failed_profile_fetch_for_new_user_returns_500(self):
        user_token = "user-123"
        self._setup_client(user_token)
        now_time = int(datetime.now().timestamp())
        exp_time = (now_time + 60 * 60) * 1000
        _setup_fxa_response(200, {"active": True, "sub": self.uid, "exp": exp_time})
        # FxA profile server is down
        responses.add(responses.GET, FXA_PROFILE_URL, status=502, body="")
        response = self.client.post(self.path)

        assert response.status_code == 500
        assert response.json()["detail"] == (
            "Did not receive a 200 response for account profile."
        )

    def test_no_authorization_header_returns_400(self):
        client = APIClient()
        response = client.post(self.path)

        assert response.status_code == 400
        assert response.json()["detail"] == "Missing Bearer header."

    def test_no_token_returns_400(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer ")
        response = client.post(self.path)

        assert response.status_code == 400
        assert response.json()["detail"] == "Missing FXA Token after 'Bearer'."

    @responses.activate
    def test_invalid_bearer_token_error_from_fxa_returns_500_and_cache_returns_500(
        self,
    ):
        _setup_fxa_response(401, {"error": "401"})
        not_found_token = "not-found-123"
        self._setup_client(not_found_token)

        assert cache.get(get_cache_key(not_found_token)) is None

        response = self.client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_jsondecodeerror_returns_401_and_cache_returns_500(
        self,
    ):
        _setup_fxa_response_no_json(200)
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        self._setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with no status code for the first time
        response = self.client.post(self.path)
        assert response.status_code == 401
        assert (
            response.json()["detail"] == "Jsondecodeerror From Fxa Introspect Response"
        )
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_non_200_response_from_fxa_returns_500_and_cache_returns_500(
        self,
    ):
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        _setup_fxa_response(401, {"active": False, "sub": self.uid, "exp": exp_time})
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        self._setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with non-200 response for the first time
        response = self.client.post(self.path)
        assert response.status_code == 500
        assert response.json()["detail"] == "Did not receive a 200 response from FXA."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_inactive_fxa_oauth_token_returns_401_and_cache_returns_401(
        self,
    ):
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        old_exp_time = (now_time - 60 * 60) * 1000
        _setup_fxa_response(
            200, {"active": False, "sub": self.uid, "exp": old_exp_time}
        )
        invalid_token = "invalid-123"
        cache_key = get_cache_key(invalid_token)
        self._setup_client(invalid_token)

        assert cache.get(cache_key) is None

        # get fxa response with token inactive for the first time
        response = self.client.post(self.path)
        assert response.status_code == 401
        assert response.json()["detail"] == "Fxa Returned Active: False For Token."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True

    @responses.activate
    def test_fxa_responds_with_no_fxa_uid_returns_404_and_cache_returns_404(self):
        user_token = "user-123"
        now_time = int(datetime.now().timestamp())
        # Note: FXA iat and exp are timestamps in *milliseconds*
        exp_time = (now_time + 60 * 60) * 1000
        _setup_fxa_response(200, {"active": True, "exp": exp_time})
        cache_key = get_cache_key(user_token)
        self._setup_client(user_token)

        assert cache.get(cache_key) is None

        # get fxa response with no fxa uid for the first time
        response = self.client.post(self.path)
        assert response.status_code == 404
        assert response.json()["detail"] == "FXA did not return an FXA UID."
        assert responses.assert_call_count(self.fxa_verify_path, 1) is True


def _setup_client(token):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@responses.activate
@pytest.mark.usefixtures("fxa_social_app")
def test_duplicate_email_logs_details_for_debugging(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR)
    uid = "relay-user-fxa-uid"
    email = "user@email.com"
    baker.make(EmailAddress, email=email, verified=True)
    user_token = "user-123"
    client = _setup_client(user_token)
    now_time = int(datetime.now().timestamp())
    # Note: FXA iat and exp are timestamps in *milliseconds*
    exp_time = (now_time + 60 * 60) * 1000
    _setup_fxa_response(200, {"active": True, "sub": uid, "exp": exp_time})
    # setup fxa profile reponse
    profile_json = {
        "email": email,
        "amrValues": ["pwd", "email"],
        "twoFactorAuthentication": False,
        "metricsEnabled": True,
        "uid": uid,
        "avatar": "https://profile.stage.mozaws.net/v1/avatar/t",
        "avatarDefault": False,
    }
    responses.add(
        responses.GET,
        FXA_PROFILE_URL,
        status=200,
        json=profile_json,
    )

    response = client.post("/api/v1/terms-accepted-user/")

    assert response.status_code == 500
    (rec1,) = caplog.records
    rec1_extra = log_extra(rec1)
    assert "socialaccount_signup" in rec1.message
    assert rec1_extra.get("fxa_uid") == uid
    assert rec1_extra.get("social_login_state") == {}
