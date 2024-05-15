"""Tasks that detect data issues and (if possible) clean them."""

from __future__ import annotations

from typing import Generic, Literal, TypeVar

from django.contrib.auth.models import User
from django.db.models import F, Model, Q
from django.db.models.query import QuerySet

from privaterelay.cleaners import CleanerTask, CleanupData, Counts

from .models import DomainAddress, Profile, RelayAddress
from .signals import create_user_profile

M = TypeVar("M", bound=Model)
SUMMARY_GROUP_T = Literal["ok", "needs_cleaning"]


class DataItem(Generic[M]):

    def __init__(
        self,
        model: type[M] | None = None,
        parent: DataItem[M] | None = None,
        filter_by: str | F | Q | None = None,
        filter_by_value: bool = True,
        exclude: bool = False,
        count_name: str | None = None,
        summary_group: SUMMARY_GROUP_T | None = None,
        clean_name: str | None = None,
    ) -> None:

        if model is None and parent is None:
            raise ValueError("Set model or parent.")
        if model is not None and parent is not None:
            raise ValueError("Set model or parent, but not both.")
        if summary_group is not None and clean_name is None:
            raise ValueError("Set clean_name when setting summary_group.")
        if summary_group is None and clean_name is not None:
            raise ValueError("Set summary_group when setting clean_name.")

        self.model = model
        self.parent = parent
        self.filter_by = filter_by
        self.filter_by_value = filter_by_value
        self.exclude = exclude
        self.count_name = count_name
        self.summary_group = summary_group
        self.clean_name = clean_name

    def get_queryset(self) -> QuerySet[M]:
        if self.model:
            query = self.model._default_manager.all()
        elif self.parent:
            query = self.parent.get_queryset()
        else:
            raise ValueError("Neither model or parent is set.")

        if isinstance(self.filter_by, str):
            filter_by = {self.filter_by: self.filter_by_value}
            if self.exclude:
                query = query.exclude(**filter_by)
            else:
                query = query.filter(**filter_by)
        elif isinstance(self.filter_by, (F | Q)):
            if self.exclude:
                query = query.exclude(self.filter_by)
            else:
                query = query.filter(self.filter_by)
        return query

    def count(self) -> int:
        return self.get_queryset().count()

    @property
    def summary_group_and_name(self) -> tuple[SUMMARY_GROUP_T, str] | None:
        if self.summary_group and self.clean_name:
            return (self.summary_group, self.clean_name)
        return None


class DataModelSpec(Generic[M]):

    def __init__(self, name: str, model: type[M]) -> None:
        self.name = name
        self.model = model


class DataBisectSpec:

    def __init__(
        self,
        parent_name: str,
        bisect_name: str,
        bisect_by: str | Q | F,
        filter_by_value: bool = True,
        count_names: tuple[str | None, str | None] = (None, None),
        summary_groups: tuple[SUMMARY_GROUP_T | None, SUMMARY_GROUP_T | None] = (
            None,
            None,
        ),
        clean_name: str | None = None,
    ) -> None:
        self.parent_name = parent_name
        self.name = bisect_name
        self.bisect_by = bisect_by
        self.filter_by_value = filter_by_value
        self.count_names = count_names
        self.summary_groups = summary_groups
        self.clean_name = clean_name


class SuperCleanerTask(CleanerTask):
    """WIP: use a specification to make a more generic CleanerTask."""

    data_specification: list[DataModelSpec | DataBisectSpec]

    def data_items(self) -> dict[str, DataItem]:
        """Turn the data_specification into a dictionary of names to DataItems."""
        data_items: dict[str, DataItem] = {}
        for entry in self.data_specification:
            if isinstance(entry, DataModelSpec):
                data_items[entry.name] = DataItem(
                    model=entry.model, count_name=entry.name
                )
            elif isinstance(entry, DataBisectSpec):
                data_items[f"{entry.parent_name}.{entry.name}"] = DataItem(
                    parent=data_items[entry.parent_name],
                    filter_by=entry.bisect_by,
                    filter_by_value=entry.filter_by_value,
                    count_name=entry.count_names[0],
                    summary_group=entry.summary_groups[0],
                    clean_name=entry.clean_name,
                )
                data_items[f"{entry.parent_name}.!{entry.name}"] = DataItem(
                    parent=data_items[entry.parent_name],
                    filter_by=entry.bisect_by,
                    filter_by_value=entry.filter_by_value,
                    exclude=True,
                    count_name=entry.count_names[1],
                    summary_group=entry.summary_groups[1],
                    clean_name=entry.clean_name,
                )
        return data_items

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        counts: Counts = {"summary": {"ok": 0, "needs_cleaning": 0}}
        cleanup_data: CleanupData = {}

        for name, data_item in self.data_items().items():
            if not (data_item.count_name or data_item.summary_group):
                continue
            count = data_item.count()

            if data_item.model:
                counts[name] = {"all": count}
            elif data_item.count_name:
                model_name = name.split(".")[0]
                counts[model_name][data_item.count_name] = count

            if data_item.summary_group_and_name:
                summary_group, clean_name = data_item.summary_group_and_name
                counts["summary"][summary_group] += count
                if summary_group == "needs_cleaning":
                    cleanup_data[clean_name] = data_item.get_queryset()

        return counts, cleanup_data


class ServerStorageCleaner(SuperCleanerTask):
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
        DataModelSpec("profiles", Profile),
        DataBisectSpec(
            "profiles",
            "server_storage",
            "user__profile__server_storage",
            count_names=("", "no_server_storage"),
        ),
        DataModelSpec("relay_addresses", RelayAddress),
        DataBisectSpec(
            "relay_addresses",
            "server_storage",
            "user__profile__server_storage",
            count_names=("", "no_server_storage"),
        ),
        DataBisectSpec(
            "relay_addresses.!server_storage",
            "empty",
            _blank_relay_data,
            count_names=("no_server_storage_or_data", "no_server_storage_but_data"),
            summary_groups=("ok", "needs_cleaning"),
            clean_name="relay_addresses",
        ),
        DataModelSpec("domain_addresses", DomainAddress),
        DataBisectSpec(
            "domain_addresses",
            "server_storage",
            "user__profile__server_storage",
            count_names=("", "no_server_storage"),
        ),
        DataBisectSpec(
            "domain_addresses.!server_storage",
            "empty",
            _blank_domain_data,
            count_names=("no_server_storage_or_data", "no_server_storage_but_data"),
            summary_groups=("ok", "needs_cleaning"),
            clean_name="domain_addresses",
        ),
    ]

    def _clean(self) -> int:
        """Clean addresses with unwanted server-stored data."""
        counts = self.counts
        cleanup_data = self.cleanup_data
        counts["relay_addresses"]["cleaned"] = cleanup_data["relay_addresses"].update(
            description="", generated_for="", used_on=""
        )
        counts["domain_addresses"]["cleaned"] = cleanup_data["domain_addresses"].update(
            description="", used_on=""
        )
        return (
            counts["relay_addresses"]["cleaned"] + counts["domain_addresses"]["cleaned"]
        )

    def markdown_report(self) -> str:
        """Report on server-stored data found and optionally cleaned."""

        def model_lines(name: str, counts: dict[str, int]) -> list[str]:
            """Get the report lines for a model (Profile, Relay Addr., Domain Addrs.)"""
            total = counts["all"]
            lines = [f"{name}:", f"  All: {total}"]
            if total == 0:
                return lines

            no_server_storage = counts["no_server_storage"]
            lines.append(
                "    Without Server Storage: "
                f"{self._as_percent(no_server_storage, total)}"
            )
            if no_server_storage == 0:
                return lines

            no_data = counts.get("no_server_storage_or_data")
            has_data = counts.get("no_server_storage_but_data")
            if no_data is None or has_data is None:
                return lines
            lines.extend(
                [
                    "      No Data : "
                    f"{self._as_percent(no_data, no_server_storage)}",
                    "      Has Data: "
                    f"{self._as_percent(has_data, no_server_storage)}",
                ]
            )

            cleaned = counts.get("cleaned")
            if cleaned is None or has_data == 0:
                return lines
            lines.append(f"        Cleaned: {self._as_percent(cleaned, has_data)}")
            return lines

        lines: list[str] = (
            model_lines("Profiles", self.counts["profiles"])
            + model_lines("Relay Addresses", self.counts["relay_addresses"])
            + model_lines("Domain Addresses", self.counts["domain_addresses"])
        )

        return "\n".join(lines)


class MissingProfileCleaner(SuperCleanerTask):
    slug = "missing-profile"
    title = "Ensures users have a profile"
    check_description = "All users should have one profile."

    data_specification = [
        DataModelSpec("users", User),
        DataBisectSpec(
            "users",
            "has_profile",
            "profile__isnull",
            filter_by_value=False,
            count_names=("has_profile", "no_profile"),
            summary_groups=("ok", "needs_cleaning"),
            clean_name="users",
        ),
    ]

    def _clean(self) -> int:
        """Assign users to groups and create profiles."""
        counts = self.counts
        counts["users"]["cleaned"] = 0
        for user in self.cleanup_data["users"]:
            create_user_profile(sender=User, instance=user, created=True)
            counts["users"]["cleaned"] += 1
        return counts["users"]["cleaned"]

    def markdown_report(self) -> str:
        """Report on user with / without profiles."""

        # Report on users
        user_counts = self.counts["users"]
        all_users = user_counts["all"]
        has_profile = user_counts["has_profile"]
        no_profile = user_counts["no_profile"]
        cleaned = user_counts.get("cleaned")
        lines = [
            "Users:",
            f"  All: {all_users}",
        ]
        if all_users > 0:
            # Breakdown users by profile count
            lines.extend(
                [
                    f"    Has Profile: {self._as_percent(has_profile, all_users)}",
                    f"    No Profile : {self._as_percent(no_profile, all_users)}",
                ]
            )
        if no_profile and cleaned is not None:
            lines.append(
                f"      Now has Profile: {self._as_percent(cleaned, no_profile)}"
            )

        return "\n".join(lines)
