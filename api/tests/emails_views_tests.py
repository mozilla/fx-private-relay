"""Tests for api/views/email_views.py"""

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

import pytest
from model_bakery import baker
from pytest_django.fixtures import SettingsWrapper
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from emails.models import DomainAddress, RelayAddress
from privaterelay.tests.utils import (
    create_expected_glean_event,
    get_glean_event,
)


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


@pytest.mark.django_db(transaction=True)
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


@pytest.mark.django_db(transaction=True)
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
    address = free_user.relayaddress_set.get()
    expected_event = create_expected_glean_event(
        category="email_mask",
        name="created",
        user=free_user,
        extra_items={
            "n_random_masks": "1",
            "has_extension": "true",
            "date_got_extension": str(int(address.created_at.timestamp())),
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
