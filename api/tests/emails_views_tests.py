"""Tests for api/views/email_views.py"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import Client
from django.urls import reverse
from django.utils import timezone

import pytest
from model_bakery import baker
from pytest_django.fixtures import DjangoAssertNumQueries, SettingsWrapper
from rest_framework.exceptions import MethodNotAllowed, NotAuthenticated
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from emails.models import DomainAddress, RelayAddress
from privaterelay.tests.utils import (
    create_expected_glean_event,
    get_glean_event,
)


@pytest.fixture
def settings_without_sqlcommenter(settings: SettingsWrapper) -> SettingsWrapper:
    """
    Remove the sqlcommenter from the middleware.

    For sqlite, it injects two queries into the recorded queries. The
    first is a plain string, the second is the expected dictionary format.
    This breaks the tests using django_assert_num_queries
    First query: "SELECT id, ...
    Second query: {"sql": "SELECT id, ..."}A
    """

    # The sqlcommenter middleware records queries twice for sqlite
    try:
        settings.MIDDLEWARE.remove(
            "google.cloud.sqlcommenter.django.middleware.SqlCommenter"
        )
    except ValueError:
        # sqlcommenter not available for Python 3.12 and later
        pass
    return settings


def test_post_domainaddress_success(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
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

    assert (event := get_glean_event(caplog)) is not None
    expected_event = create_expected_glean_event(
        category="email_mask",
        name="created",
        user=premium_user,
        extra_items={
            "n_domain_masks": "1",
            "is_random_mask": "false",
            "created_by_api": "true",
            "has_website": "false",
        },
        event_time=event["timestamp"],
    )
    assert event == expected_event


def test_post_domainaddress_no_subdomain_error(
    premium_user: User, prem_api_client: APIClient, caplog: pytest.LogCaptureFixture
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
    assert get_glean_event(caplog) is None


def test_post_domainaddress_user_flagged_error(
    premium_user: User, prem_api_client: APIClient, caplog: pytest.LogCaptureFixture
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
    assert get_glean_event(caplog) is None


def test_post_domainaddress_bad_address_error(
    prem_api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
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
    assert get_glean_event(caplog) is None


def test_post_domainaddress_free_user_error(
    free_api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
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
    assert get_glean_event(caplog) is None


@pytest.mark.django_db
def test_post_domainaddress_conflict_existing(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
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
    assert get_glean_event(caplog) is None


@pytest.mark.django_db
@override_flag("custom_domain_management_redesign", active=True)
def test_post_domainaddress_conflict_deleted(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
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
    assert get_glean_event(caplog) is None


@pytest.mark.parametrize(
    "key,value",
    [
        ("enabled", False),
        ("description", "My New Alias"),
        ("block_list_emails", True),
        ("used_on", "example.com"),
    ],
)
def test_patch_domainaddress(
    prem_api_client: APIClient,
    premium_user: User,
    caplog: pytest.LogCaptureFixture,
    key: str,
    value: str | bool,
) -> None:
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

    event = get_glean_event(caplog)
    if key == "description":
        assert event is not None
        expected_event = create_expected_glean_event(
            category="email_mask",
            name="label_updated",
            user=premium_user,
            extra_items={
                "n_domain_masks": "1",
                "is_random_mask": "false",
            },
            event_time=event["timestamp"],
        )
        assert event == expected_event
    else:
        assert event is None


@pytest.mark.parametrize("key", ("enabled", "description", "block_list_emails"))
def test_patch_domainaddress_same_value(
    prem_api_client: APIClient,
    premium_user: User,
    caplog: pytest.LogCaptureFixture,
    key: str,
) -> None:
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
    assert get_glean_event(caplog) is None


@pytest.mark.parametrize("value", ("", None))
def test_patch_domainaddress_same_value_used_on(
    prem_api_client: APIClient,
    premium_user: User,
    caplog: pytest.LogCaptureFixture,
    value: str | None,
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
    assert get_glean_event(caplog) is None


@pytest.mark.parametrize(
    "key,value",
    [
        ("id", -1),
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
    prem_api_client: APIClient,
    premium_user: User,
    caplog: pytest.LogCaptureFixture,
    key: str,
    value: int | str,
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
    assert get_glean_event(caplog) is None


def test_patch_domainaddress_read_only_mask_type(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    """PATCH succeeds but does not change or return the mask_type."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    url = reverse("domainaddress-detail", args=[existing.id])
    get_json = prem_api_client.get(url).json()
    assert get_json["mask_type"] == "custom"
    response = prem_api_client.patch(url, data={"mask_type": "random"})

    assert response.status_code == 200
    ret_data = response.json()
    assert "mask_type" not in ret_data
    assert get_glean_event(caplog) is None


def test_patch_domainaddress_address_fails(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    """PATCH should not succeed when attempting to update the address field."""
    existing = DomainAddress.objects.create(user=premium_user, address="my-new-alias")
    url = reverse("domainaddress-detail", args=[existing.id])
    get_json = prem_api_client.get(url).json()
    assert get_json["address"] == "my-new-alias"
    response = prem_api_client.patch(url, data={"address": "my-new-edited-alias"})
    ret_data = response.json()

    assert response.status_code == 400
    assert ret_data["detail"] == "You cannot edit an existing domain address field."
    assert ret_data["error_code"] == "address_not_editable"
    assert get_glean_event(caplog) is None


def test_patch_domainaddress_addr_with_id_fails(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    """
    PATCH should not succeed when updating the address field and an 'id' field should
    have no effect on the request because it is a read-only field
    """

    existing_alias = DomainAddress.objects.create(
        user=premium_user, address="my-new-alias"
    )

    url = reverse("domainaddress-detail", args=[existing_alias.id])
    get_json = prem_api_client.get(url).json()
    assert get_json["address"] == "my-new-alias"
    response = prem_api_client.patch(
        url, data={"id": 100, "address": "my-new-edited-alias"}
    )
    ret_data = response.json()

    assert response.status_code == 400
    assert ret_data["detail"] == "You cannot edit an existing domain address field."
    assert ret_data["error_code"] == "address_not_editable"
    assert get_glean_event(caplog) is None


@pytest.mark.parametrize("address_count", (0, 1, 2, 5))
def test_get_domainaddress(
    prem_api_client: APIClient,
    premium_user: User,
    django_assert_num_queries: DjangoAssertNumQueries,
    settings_without_sqlcommenter: SettingsWrapper,
    address_count: int,
) -> None:
    """
    A GET request makes 1 request for no results, and 3 requests for any results.
    """
    address_qs = DomainAddress.objects.filter(user=premium_user)
    count = address_qs.count()
    assert count <= address_count
    while count < address_count:
        DomainAddress.objects.create(user=premium_user, address=f"address-{count}")
        count = address_qs.count()

    url = reverse("domainaddress-list")
    expected_queries = 3 if address_count else 1
    with django_assert_num_queries(expected_queries):
        response = prem_api_client.get(url)
    data = response.json()
    assert response.status_code == 200
    assert len(data) == address_count


def test_delete_domainaddress(
    prem_api_client: APIClient, premium_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    existing = DomainAddress.objects.create(user=premium_user, address="my-doomed-mask")
    url = reverse("domainaddress-detail", args=[existing.id])
    response = prem_api_client.delete(url)
    assert response.status_code == 204
    assert not DomainAddress.objects.filter(id=existing.id).exists()

    assert (event := get_glean_event(caplog)) is not None
    expected_event = create_expected_glean_event(
        category="email_mask",
        name="deleted",
        user=premium_user,
        extra_items={
            "n_deleted_domain_masks": "1",
            "is_random_mask": "false",
        },
        event_time=event["timestamp"],
    )
    assert event == expected_event


def test_post_relayaddress_success(
    free_api_client: APIClient, free_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    """A free user is able to create a random address."""
    response = free_api_client.post(
        reverse("relayaddress-list"), data={}, format="json"
    )

    assert response.status_code == 201
    ret_data = response.json()
    assert ret_data["enabled"]

    assert (event := get_glean_event(caplog)) is not None
    expected_event = create_expected_glean_event(
        category="email_mask",
        name="created",
        user=free_user,
        extra_items={
            "n_random_masks": "1",
            "is_random_mask": "true",
            "created_by_api": "true",
            "has_website": "false",
        },
        event_time=event["timestamp"],
    )
    assert event == expected_event


def test_post_relayaddress_with_generated_for_success(
    free_api_client: APIClient, free_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    """A mask generated on a website sets has_generated_for"""
    response = free_api_client.post(
        reverse("relayaddress-list"),
        data={"generated_for": "example.com"},
        format="json",
    )
    assert response.status_code == 201

    assert (event := get_glean_event(caplog)) is not None
    expected_event = create_expected_glean_event(
        category="email_mask",
        name="created",
        user=free_user,
        extra_items={
            "n_random_masks": "1",
            "has_extension": "false",
            "date_got_extension": "-2",
            "is_random_mask": "true",
            "created_by_api": "true",
            "has_website": "true",
        },
        event_time=event["timestamp"],
    )
    assert event == expected_event


def test_post_relayaddress_free_mask_email_limit_error(
    settings: SettingsWrapper,
    free_user: User,
    free_api_client: APIClient,
    caplog: pytest.LogCaptureFixture,
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


def test_post_relayaddress_flagged_error(
    free_user: User, free_api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
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


def test_post_relayaddress_inactive_user_error(
    free_user: User, free_api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
    """An inactive user is unable to create a random mask."""
    free_user.is_active = False
    free_user.save()

    response = free_api_client.post(reverse("relayaddress-list"), {}, format="json")

    assert response.status_code == 403
    ret_data = response.json()
    assert ret_data == {
        "detail": "Your account is not active.",
        "error_code": "account_is_inactive",
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
def test_patch_relayaddress(
    free_api_client: APIClient,
    free_user: User,
    caplog: pytest.LogCaptureFixture,
    key: str,
    value: str | bool,
) -> None:
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

    event = get_glean_event(caplog)
    if key == "description":
        assert event is not None
        expected_event = create_expected_glean_event(
            category="email_mask",
            name="label_updated",
            user=free_user,
            extra_items={
                "n_random_masks": "1",
                "is_random_mask": "true",
            },
            event_time=event["timestamp"],
        )
        assert event == expected_event
    else:
        assert event is None


@pytest.mark.parametrize(
    "key", ("enabled", "description", "generated_for", "block_list_emails")
)
def test_patch_relayaddress_same_value(
    free_api_client: APIClient,
    free_user: User,
    caplog: pytest.LogCaptureFixture,
    key: str,
) -> None:
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
    assert get_glean_event(caplog) is None


@pytest.mark.parametrize("value", ("", None))
def test_patch_relayaddress_same_value_used_on(
    free_api_client: APIClient,
    free_user: User,
    caplog: pytest.LogCaptureFixture,
    value: str | None,
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
    assert get_glean_event(caplog) is None


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
def test_patch_relayaddress_read_only(
    free_api_client: APIClient, free_user: User, key: str, value: str | int
) -> None:
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


def test_patch_relayaddress_read_only_mask_type(
    free_api_client: APIClient, free_user: User
) -> None:
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
    free_user: User, free_api_client: APIClient, caplog: pytest.LogCaptureFixture
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
    premium_user: User, prem_api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
    """A formerly-premium user can set block_list_emails to False"""
    # Create a Relay Address with promotions blocked
    ra = baker.make(
        RelayAddress, user=premium_user, enabled=False, block_list_emails=True
    )

    # Unsubscribe the premium user
    fxa_account = premium_user.profile.fxa
    assert fxa_account
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
    url = reverse("relayaddress-detail", args=[existing.id])
    response = free_api_client.delete(url)
    assert response.status_code == 204
    assert not RelayAddress.objects.filter(id=existing.id).exists()

    assert (event := get_glean_event(caplog)) is not None
    expected_event = create_expected_glean_event(
        category="email_mask",
        name="deleted",
        user=free_user,
        extra_items={
            "n_deleted_random_masks": "1",
            "is_random_mask": "true",
        },
        event_time=event["timestamp"],
    )
    assert event == expected_event


@pytest.mark.parametrize("address_count", (0, 1, 2))
def test_get_relayaddress(
    free_api_client: APIClient,
    free_user: User,
    django_assert_num_queries: DjangoAssertNumQueries,
    settings_without_sqlcommenter: SettingsWrapper,
    address_count: int,
) -> None:
    """A GET request should make 1 query, no matter the address count."""
    address_qs = RelayAddress.objects.filter(user=free_user)
    count = address_qs.count()
    assert count <= address_count
    while count < address_count:
        RelayAddress.objects.create(user=free_user)
        count = address_qs.count()

    url = reverse("relayaddress-list")
    with django_assert_num_queries(1):
        response = free_api_client.get(url)
    data = response.json()
    assert response.status_code == 200
    assert len(data) == address_count


def test_first_forwarded_email_unauth(client: Client) -> None:
    response = client.post("/api/v1/first-forwarded-email/")
    assert response.status_code == 401
    assert response.json() == {"detail": str(NotAuthenticated())}


def test_first_forwarded_email_bad_method(free_api_client: APIClient) -> None:
    response = free_api_client.get("/api/v1/first-forwarded-email/")
    assert response.status_code == 405
    assert response.json() == {"detail": str(MethodNotAllowed("GET"))}


def test_first_forwarded_email_no_flag(free_api_client: APIClient) -> None:
    with override_flag("free_user_onboarding", False):
        response = free_api_client.post("/api/v1/first-forwarded-email/")
    assert response.status_code == 403
    assert response.json() == {"detail": "Requires free_user_onboarding waffle flag."}


def test_first_forwarded_email_bad_request(free_api_client: APIClient) -> None:
    with override_flag("free_user_onboarding", True):
        response = free_api_client.post(
            "/api/v1/first-forwarded-email/", {"bad": "data"}
        )
    assert response.status_code == 400
    assert response.json() == {"mask": ["This field is required."]}


def test_first_forwarded_email_unknown_mask(free_api_client: APIClient) -> None:
    with override_flag("free_user_onboarding", True):
        response = free_api_client.post(
            "/api/v1/first-forwarded-email/", {"mask": "not_found@example.com"}
        )
    assert response.status_code == 404
    assert response.content == b'"not_found@example.com does not exist for user."'


def test_first_forwarded_email_success(
    free_api_client: APIClient,
    free_user: User,
    settings: SettingsWrapper,
) -> None:
    settings.RELAY_FROM_ADDRESS = "reply@relay.example.com"
    address = free_user.relayaddress_set.create()
    with (
        override_flag("free_user_onboarding", True),
        patch(
            "emails.apps.EmailsConfig.ses_client",
            spec_set=["send_email"],
        ) as mock_ses_client,
    ):
        response = free_api_client.post(
            "/api/v1/first-forwarded-email/", {"mask": address.full_address}
        )
    assert response.status_code == 201
    assert response.content == b""
    mock_ses_client.send_email.assert_called_once()
