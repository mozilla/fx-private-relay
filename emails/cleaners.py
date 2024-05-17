"""Tasks that detect and fix data issues in the emails app."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q

from privaterelay.cleaners import (
    CleanerTask,
    DataBisectSpec,
    DataItem,
    DataModelSpec,
)

from .models import DomainAddress, Profile, RelayAddress
from .signals import create_user_profile


class ServerStorageCleaner(CleanerTask):
    slug = "server-storage"
    title = "Ensure no data is stored when server_storage=False"
    check_description = (
        "When Profile.server_storage is False, the addresses (both regular and domain)"
        " should have empty data (the fields description, generated_for and used_on)."
    )

    _blank_used_on = Q(used_on="") | Q(used_on__isnull=True)
    data_specification = [
        # Report on how many users have turned off server storage
        DataModelSpec(
            Profile,
            [DataBisectSpec("server_storage", "user__profile__server_storage")],
            omit_key_prefixes=["server_storage"],
            metric_name_overrides={"!server_storage": "no_server_storage"},
            report_name_overrides={"!server_storage": "Without Server Storage"},
        )
    ] + [
        # Detect users with no server storage but address records with data
        DataModelSpec(
            AddressModel,
            [
                DataBisectSpec("server_storage", "user__profile__server_storage"),
                DataBisectSpec("!server_storage.empty", blank_data),
            ],
            omit_key_prefixes=["server_storage"],
            metric_name_overrides={
                "!server_storage": "no_server_storage",
                "!server_storage.empty": "no_server_storage_or_data",
                "!server_storage.!empty": "no_server_storage_but_data",
            },
            report_name_overrides={
                "!server_storage": "Without Server Storage",
                "!server_storage.empty": "No Data",
                "!server_storage.!empty": "Has Data",
            },
            ok_key="!server_storage.empty",
            needs_cleaning_key="!server_storage.!empty",
        )
        for AddressModel, blank_data in [
            (RelayAddress, _blank_used_on & Q(description="") & Q(generated_for="")),
            (DomainAddress, _blank_used_on & Q(description="")),
        ]
    ]

    def clean_relay_addresses(self, item: DataItem[RelayAddress]) -> int:
        return item.get_queryset().update(description="", generated_for="", used_on="")

    def clean_domain_addresses(self, item: DataItem[DomainAddress]) -> int:
        return item.get_queryset().update(description="", used_on="")


class MissingProfileCleaner(CleanerTask):
    slug = "missing-profile"
    title = "Ensures users have a profile"
    check_description = "All users should have one profile."

    data_specification = [
        DataModelSpec(
            User,
            [DataBisectSpec("has_profile", Q(profile__isnull=False))],
            metric_name_overrides={"!has_profile": "no_profile"},
            report_name_overrides={"!has_profile": "No Profile"},
            ok_key="has_profile",
            needs_cleaning_key="!has_profile",
            cleaned_report_name="Now has Profile",
        ),
    ]

    def clean_users(self, item: DataItem[User]) -> int:
        count = 0
        for user in item.get_queryset():
            create_user_profile(sender=User, instance=user, created=True)
            count += 1
        return count
