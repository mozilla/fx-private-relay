"""Tasks that detect data issues and (if possible) clean them."""

from __future__ import annotations

import string
from collections import defaultdict
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
        clean_group: CLEAN_GROUP_T | None = None,
        report_name: str | None = None,
        cleaned_report_name: str | None = None,
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
        self.clean_group = clean_group
        self.report_name = report_name
        self.cleaned_report_name = cleaned_report_name

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


class CleanedItem(DataItem[M]):
    def __init__(self, model: type[M], report_name: str) -> None:
        super().__init__(
            model=model,
            stat_name="cleaned",
            report_name=report_name,
        )


class DataModelSpec(Generic[M]):
    """Define queries on a table that can identify issues."""

    def __init__(
        self,
        model: type[M],
        subdivisions: list[DataBisectSpec],
        omit_stats: list[str] | None = None,
        stat_name_overrides: dict[str, str] | None = None,
        report_name_overrides: dict[str, str] | None = None,
        ok_stat: str | None = None,
        needs_cleaning_stat: str | None = None,
        cleaned_report_name: str = "Cleaned",
    ) -> None:
        self.model = model
        self.subdivisions = subdivisions
        self.stat_name_overrides = stat_name_overrides or {}
        self.omit_stats = omit_stats or []
        self.stat_name_overrides = stat_name_overrides or {}
        self.report_name_overrides = report_name_overrides or {}
        self.ok_stat = ok_stat
        self.needs_cleaning_stat = needs_cleaning_stat
        self.cleaned_report_name = cleaned_report_name

    @property
    def name(self) -> str:
        return str(self.model._meta.verbose_name_plural).replace(" ", "_")

    def stat_name(self, subname: str) -> str | None:
        """Return None (to omit), a friendlier name, or the original name."""
        if any(subname.startswith(omit) for omit in self.omit_stats):
            return None
        return self.stat_name_overrides.get(subname, subname)

    def report_name(self, subname: str) -> str | None:
        if (stat_name := self.stat_name(subname)) is None:
            return None
        return self.report_name_overrides.get(
            stat_name, stat_name.replace("_", " ").title()
        )

    def clean_group(self, subname: str) -> CLEAN_GROUP_T | None:
        """Identify when the subname is for a key cleaning stat."""
        if subname == self.ok_stat:
            return "ok"
        elif subname == self.needs_cleaning_stat:
            return "needs_cleaning"
        else:
            return None

    def to_data_items(self) -> dict[str, DataItem[M]]:
        """Converts the spec to a dictionary of DataItems."""
        data_items: dict[str, DataItem[M]] = {
            "": DataItem(
                model=self.model,
                stat_name=self.name,
                report_name=str(self.model._meta.verbose_name_plural).title(),
                cleaned_report_name=self.cleaned_report_name,
            )
        }
        for entry in self.subdivisions:
            for name, item in entry.to_data_items(self, data_items).items():
                if name in data_items:
                    raise Exception("Duplicate name '{name}' returned by {entry}.")
                data_items[name] = item
        return {
            (f"{self.name}{_SUBNAME_SEP}{name}" if name else self.name): item
            for name, item in data_items.items()
        }


class DataBisectSpec:
    """Bisect a parent query by a true / false query."""

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

    def to_data_items(
        self, model_spec: DataModelSpec[M], existing_items: dict[str, DataItem[M]]
    ) -> dict[str, DataItem[M]]:
        """Return two data items bisecting the parent data."""
        if _SUBNAME_SEP in self.subname:
            subparent_name, part_name = self.subname.rsplit(_SUBNAME_SEP, 1)
            neg_subname = f"{subparent_name}{_SUBNAME_SEP}{_NEGATE_PREFIX}{part_name}"
        else:
            subparent_name = ""
            part_name = self.subname
            neg_subname = f"{_NEGATE_PREFIX}{part_name}"

        parent = existing_items[subparent_name]
        return {
            self.subname: self._to_bisected_data_item(
                self.subname, model_spec, parent, "positive"
            ),
            neg_subname: self._to_bisected_data_item(
                neg_subname, model_spec, parent, "negative"
            ),
        }

    def _to_bisected_data_item(
        self,
        key_name: str,
        model_spec: DataModelSpec[M],
        parent: DataItem[M],
        bisect: Literal["positive", "negative"],
    ) -> DataItem[M]:
        """Create one of the bisected data items."""
        return DataItem(
            parent=parent,
            filter_by=self.bisect_by,
            filter_by_value=self.filter_by_value,
            exclude=bisect == "negative",
            stat_name=model_spec.stat_name(key_name),
            clean_group=model_spec.clean_group(key_name),
            report_name=model_spec.report_name(key_name),
        )


class SuperCleanerTask(CleanerTask):
    """WIP: use a specification to make a more generic CleanerTask."""

    data_specification: list[DataModelSpec[Any]]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.data_items = self._get_data_items()
        super().__init__(*args, **kwargs)

    def _get_data_items(self) -> dict[str, DataItem[Any]]:
        """Turn the data_specification into a dictionary of names to DataItems."""
        data_items: dict[str, DataItem[Any]] = {}
        for model_spec in self.data_specification:
            for name, item in model_spec.to_data_items().items():
                if name in data_items:
                    raise Exception(
                        f"For model '{model_spec.name}', the statistic {name}"
                        " is already registered."
                    )
                data_items[name] = item
        return data_items

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        counts: Counts = {"summary": {"ok": 0, "needs_cleaning": 0}}
        cleanup_data: CleanupData = {}

        for name, data_item in self.data_items.items():
            if not (data_item.stat_name or data_item.clean_group):
                continue
            count = data_item.count()

            if data_item.model:
                counts[name] = {"all": count}
            elif data_item.stat_name:
                model_name = name.split(".")[0]
                counts[model_name][data_item.stat_name] = count

            if data_item.clean_group:
                counts["summary"][data_item.clean_group] += count
                if data_item.clean_group == "needs_cleaning":
                    cleanup_data[model_name] = name

        return counts, cleanup_data

    def markdown_report(self) -> str:
        """Report on data found and optionally cleaned."""

        lines: list[str] = []
        for section, counts in self.counts.items():
            try:
                section_data_item = self.data_items[section]
            except KeyError:
                pass
            else:
                if section_data_item.report_name:
                    lines.extend(
                        self._markdown_lines_for_model(
                            section, section_data_item, counts
                        )
                    )
        return "\n".join(lines)

    def _markdown_lines_for_model(
        self,
        section_name: str,
        section_data_item: DataItem[Any],
        counts: dict[str, int],
    ) -> list[str]:
        """Get the report lines for a model."""
        total = counts["all"]
        lines = [f"{section_data_item.report_name}:", f"  All: {total}"]

        if total == 0:
            return lines
        if section_data_item.stat_name is None:
            raise Exception(f"DataItem {section_name} has .stat_name None")
        if section_data_item.model is None:
            raise Exception(f"DataItem {section_name} has .model None")

        section_counts: dict[tuple[str, ...], int] = {
            (section_data_item.stat_name,): total
        }
        section_subitems: dict[tuple[str, ...], list[tuple[DataItem[Any], int]]] = (
            defaultdict(list)
        )

        prefix = section_data_item.stat_name + _SUBNAME_SEP
        cleaned = counts.get("cleaned")

        # Collect items and counts where the direct parent item has a non-zero count
        for name, item in self.data_items.items():
            if not (name.startswith(prefix) and item.stat_name and item.report_name):
                continue
            parts = tuple(name.split(_SUBNAME_SEP))
            parent_key = parts[:-1]
            parent_total = section_counts[parent_key]
            count = counts[item.stat_name]
            if parent_total != 0:
                section_counts[parts] = count
                section_subitems[parent_key].append((item, count))
                if cleaned and item.clean_group == "needs_cleaning":
                    report_name = section_data_item.cleaned_report_name
                    if report_name is None:
                        raise Exception(
                            f"DataItem {section_name} has"
                            f" .cleaned_report_name {report_name}"
                        )
                    section_counts[parts + (report_name,)] = cleaned
                    section_subitems[parts].append(
                        (CleanedItem(section_data_item.model, report_name), cleaned)
                    )

        # Add and indent subsections
        for key, subitems in section_subitems.items():
            indent = "  " * len(key)
            max_len = max(len(subitem.report_name or "") for subitem, count in subitems)
            parent_total = section_counts[key]
            for subitem, count in subitems:
                lines.append(
                    f"  {indent}{subitem.report_name:<{max_len}}:"
                    f" {self._as_percent(count, parent_total)}"
                )

        return lines

    def _clean(self) -> int:
        """Call the specified cleaners."""
        counts = self.counts
        cleanup_data = self.cleanup_data
        total_cleaned = 0
        for model_name, stat_name in cleanup_data.items():
            clean_item = self.data_items[stat_name]
            cleaner = getattr(self, f"clean_{model_name}")
            count = cleaner(clean_item)
            counts[model_name]["cleaned"] = count
            total_cleaned += count
        return total_cleaned


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
            cleaned_report_name="Now has Profile",
        ),
    ]

    def clean_users(self, item: DataItem[User]) -> int:
        count = 0
        for user in item.get_queryset():
            create_user_profile(sender=User, instance=user, created=True)
            count += 1
        return count
