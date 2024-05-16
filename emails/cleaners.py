"""Tasks that detect data issues and (if possible) clean them."""

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
    _blank_relay_data = _blank_used_on & Q(description="") & Q(generated_for="")
    _blank_domain_data = _blank_used_on & Q(description="")
    data_specification = [
        DataModelSpec(
            Profile,
            [DataBisectSpec("server_storage", "user__profile__server_storage")],
            stat_name_overrides={"!server_storage": "no_server_storage"},
            report_name_overrides={"no_server_storage": "Without Server Storage"},
            omit_stats=["server_storage"],
        ),
        DataModelSpec(
            RelayAddress,
            [
                DataBisectSpec("server_storage", "user__profile__server_storage"),
                DataBisectSpec("!server_storage.empty", _blank_relay_data),
            ],
            stat_name_overrides={
                "!server_storage": "no_server_storage",
                "!server_storage.empty": "no_server_storage_or_data",
                "!server_storage.!empty": "no_server_storage_but_data",
            },
            report_name_overrides={
                "no_server_storage": "Without Server Storage",
                "no_server_storage_or_data": "No Data",
                "no_server_storage_but_data": "Has Data",
            },
            omit_stats=["server_storage"],
            ok_stat="!server_storage.empty",
            needs_cleaning_stat="!server_storage.!empty",
        ),
        DataModelSpec(
            DomainAddress,
            [
                DataBisectSpec("server_storage", "user__profile__server_storage"),
                DataBisectSpec("!server_storage.empty", _blank_domain_data),
            ],
            stat_name_overrides={
                "!server_storage": "no_server_storage",
                "!server_storage.empty": "no_server_storage_or_data",
                "!server_storage.!empty": "no_server_storage_but_data",
            },
            report_name_overrides={
                "no_server_storage": "Without Server Storage",
                "no_server_storage_or_data": "No Data",
                "no_server_storage_but_data": "Has Data",
            },
            omit_stats=["server_storage"],
            ok_stat="!server_storage.empty",
            needs_cleaning_stat="!server_storage.!empty",
        ),
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
            [DataBisectSpec("has_profile", "profile__isnull", filter_by_value=False)],
            stat_name_overrides={"!has_profile": "no_profile"},
            ok_stat="has_profile",
            needs_cleaning_stat="!has_profile",
            cleaned_report_name="Now has Profile",
        ),
    ]

    def clean_users(self, item: DataItem[User]) -> int:
        count = 0
        for user in item.get_queryset():
            create_user_profile(sender=User, instance=user, created=True)
            count += 1
        return count
