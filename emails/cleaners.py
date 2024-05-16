"""Tasks that detect data issues and (if possible) clean them."""

from __future__ import annotations

import string
from typing import Any, Generic, Literal, TypeVar

from django.contrib.auth.models import User
from django.db.models import F, Model, Q
from django.db.models.query import QuerySet

from privaterelay.cleaners import CleanerTask, CleanupData, Counts

from .models import DomainAddress, Profile, RelayAddress
from .signals import create_user_profile

M = TypeVar("M", bound=Model)
CLEAN_GROUP_T = Literal["ok", "needs_cleaning"]

# Define subdivision names
# {model_plural}.[!]{sub_name1}.[!]{sub_name2}
_SUBNAME_SEP = "."
_NEGATE_PREFIX = "!"
_SUBNAME_CHARS = string.ascii_lowercase + "_"
_SUBNAME_CHAR_SET = set(_SUBNAME_CHARS)
_NAME_CHAR_SET = set(_SUBNAME_CHARS + _SUBNAME_SEP + _NEGATE_PREFIX)


class DataItem(Generic[M]):

    def __init__(
        self,
        model: type[M] | None = None,
        parent: DataItem[M] | None = None,
        filter_by: str | F | Q | None = None,
        filter_by_value: bool = True,
        exclude: bool = False,
        stat_name: str | None = None,
        clean_group_and_name: tuple[CLEAN_GROUP_T, str] | None = None,
    ) -> None:

        if model is None and parent is None:
            raise ValueError("Set model or parent.")
        if model is not None and parent is not None:
            raise ValueError("Set model or parent, but not both.")

        self.model = model
        self.parent = parent
        self.filter_by = filter_by
        self.filter_by_value = filter_by_value
        self.exclude = exclude
        self.stat_name = stat_name
        self.clean_group_and_name = clean_group_and_name

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


class DataModelSpec(Generic[M]):

    def __init__(
        self,
        model: type[M],
        subdivisions: list[DataBisectSpec],
        omit_stats: list[str] | None = None,
        stat_name_overrides: dict[str, str] | None = None,
        ok_stat: str | None = None,
        needs_cleaning_stat: str | None = None,
    ) -> None:
        self.model = model
        self.subdivisions = subdivisions
        self.stat_name_overrides = stat_name_overrides or {}
        self.omit_stats = omit_stats or []
        self.stat_name_overrides = stat_name_overrides or {}
        self.ok_stat = ok_stat
        self.needs_cleaning_stat = needs_cleaning_stat

    @property
    def name(self) -> str:
        return str(self.model._meta.verbose_name_plural).replace(" ", "_")

    def stat_name(self, subname: str) -> str | None:
        """Return None (to omit), a friendlier name, or the original name."""
        if any(subname.startswith(omit) for omit in self.omit_stats):
            return None
        return self.stat_name_overrides.get(subname, subname)

    def clean_group_and_name(self, subname: str) -> tuple[CLEAN_GROUP_T, str] | None:
        """Identify when the subname is for a key cleaning stat."""
        if subname == self.ok_stat:
            return ("ok", self.name)
        elif subname == self.needs_cleaning_stat:
            return ("needs_cleaning", self.name)
        else:
            return None


class DataBisectSpec:

    def __init__(
        self,
        subname: str,
        bisect_by: str | Q | F,
        filter_by_value: bool = True,
    ) -> None:
        if subname.startswith(_SUBNAME_SEP):
            raise ValueError(
                f"The subname {subname} should not start with a '{_SUBNAME_SEP}'"
            )
        if bad_chars := [c for c in subname if c not in _NAME_CHAR_SET]:
            raise ValueError(
                f"subname {subname} has disallowed characters `{sorted(bad_chars)}`"
            )
        if not bisect_by:
            raise ValueError("Set the bisect_by filter")
        parts = subname.split(".")
        for part in parts:
            if _NEGATE_PREFIX in part[1:]:
                raise ValueError(
                    f"In subname {subname}, character {_NEGATE_PREFIX} is in the"
                    f" middle of a subpath in {part}, is only allowed at the start."
                )
        if parts[-1][0] == _NEGATE_PREFIX:
            raise ValueError(
                f"In subname {subname}, the prefix {_NEGATE_PREFIX} is not allowed"
                " in the last part."
            )

        self.subname = subname
        self.bisect_by = bisect_by
        self.filter_by_value = filter_by_value


class SuperCleanerTask(CleanerTask):
    """WIP: use a specification to make a more generic CleanerTask."""

    data_specification: list[DataModelSpec[Any]]

    def data_items(self) -> dict[str, DataItem[Any]]:
        """Turn the data_specification into a dictionary of names to DataItems."""
        data_items: dict[str, DataItem[Any]] = {}
        for model_spec in self.data_specification:
            model_stat_name = model_spec.name
            data_items[model_spec.name] = DataItem(
                model=model_spec.model, stat_name=model_stat_name
            )
            for entry in model_spec.subdivisions:
                if _SUBNAME_SEP in entry.subname:
                    subparent_name, part_name = entry.subname.rsplit(_SUBNAME_SEP, 1)
                    parent = data_items[
                        f"{model_stat_name}{_SUBNAME_SEP}{subparent_name}"
                    ]
                    neg_subname = (
                        f"{subparent_name}{_SUBNAME_SEP}{_NEGATE_PREFIX}{part_name}"
                    )
                else:
                    subparent_name = ""
                    part_name = entry.subname
                    parent = data_items[model_stat_name]
                    neg_subname = f"{_NEGATE_PREFIX}{part_name}"

                pos_subname = entry.subname
                pos_fullname = f"{model_stat_name}{_SUBNAME_SEP}{pos_subname}"
                data_items[pos_fullname] = DataItem(
                    parent=parent,
                    filter_by=entry.bisect_by,
                    filter_by_value=entry.filter_by_value,
                    stat_name=model_spec.stat_name(pos_subname),
                    clean_group_and_name=model_spec.clean_group_and_name(pos_subname),
                )
                neg_fullname = f"{model_stat_name}{_SUBNAME_SEP}{neg_subname}"
                data_items[neg_fullname] = DataItem(
                    parent=parent,
                    filter_by=entry.bisect_by,
                    filter_by_value=entry.filter_by_value,
                    exclude=True,
                    stat_name=model_spec.stat_name(neg_subname),
                    clean_group_and_name=model_spec.clean_group_and_name(neg_subname),
                )
        return data_items

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        counts: Counts = {"summary": {"ok": 0, "needs_cleaning": 0}}
        cleanup_data: CleanupData = {}

        for name, data_item in self.data_items().items():
            if not (data_item.stat_name or data_item.clean_group_and_name):
                continue
            count = data_item.count()

            if data_item.model:
                counts[name] = {"all": count}
            elif data_item.stat_name:
                model_name = name.split(".")[0]
                counts[model_name][data_item.stat_name] = count

            if data_item.clean_group_and_name:
                clean_group, clean_name = data_item.clean_group_and_name
                counts["summary"][clean_group] += count
                if clean_group == "needs_cleaning":
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
        DataModelSpec(
            Profile,
            [DataBisectSpec("server_storage", "user__profile__server_storage")],
            stat_name_overrides={"!server_storage": "no_server_storage"},
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
            omit_stats=["server_storage"],
            ok_stat="!server_storage.empty",
            needs_cleaning_stat="!server_storage.!empty",
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
        DataModelSpec(
            User,
            [DataBisectSpec("has_profile", "profile__isnull", filter_by_value=False)],
            stat_name_overrides={"!has_profile": "no_profile"},
            ok_stat="has_profile",
            needs_cleaning_stat="!has_profile",
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
