"""Framework for tasks that identify data issues and (if possible) clean them up"""

from __future__ import annotations

import string
from collections import defaultdict
from typing import Any, Generic, Literal, TypeVar, get_args

from django.db.models import Model, Q
from django.db.models.query import QuerySet

Counts = dict[str, dict[str, int]]
CleanupData = dict[str, Any]

M = TypeVar("M", bound=Model)
CLEAN_GROUP_T = Literal["ok", "needs_cleaning"]

# Define allowed characters for item keys
# {model_plural}.[!]{sub_name1}.[!]{sub_name2}
_KEY_SEP = "."
_NEGATE_PREFIX = "!"
_ITEM_KEY_CHAR_SET = set(
    string.ascii_lowercase + string.digits + "_" + _NEGATE_PREFIX + _KEY_SEP
)


class DataItem(Generic[M]):
    """
    A DataItem is a query against a Model, plus settings for reports.

    A top-level model DataItem represents all the items in a table. A query that selects
    some rows is a DataItem with a parent. The specific rows of interest can be
    represented by multiple levels of DataItems, giving context to the specific rows.
    """

    def __init__(
        self,
        model: type[M] | None = None,
        parent: DataItem[M] | None = None,
        filter_by: str | Q | None = None,
        exclude: bool = False,
        metric_name: str | None = None,
        report_name: str | None = None,
        clean_group: CLEAN_GROUP_T | None = None,
    ) -> None:
        """
        Initialize a DataItem, checking for init-time issues.

        These are created by the DataModelSpec.to_data_items() calls, but can be created
        manually for tests.

        To create a model DataItem, set the `model`. A `filter_by` is not allowed.
        To create a subquery DataItem, set the `parent` to a model DataItem or another
        DataItem. A `filter_by` is required.

        The `filter_by` parameter sets the filter (`filter` is a Python keyword). It can
        be a string, which represents a boolean filter. It can be a Django Q object,
        such as `Q(num_deleted_relay_addresses__gt=5)`. The default is to include rows
        matching the query. If `exclude` is set to `True`, then the query is for rows
        that do not match the filter.

        The `metric_name` parameter sets the name of the query when it appears as a
        `dict` or JSON key. The default is `None`, which omits the DataItem from
        reports.

        The `report_name` parameter sets the name of the query when it appears in a
        report for humans. It can be omitted when `metric_name` is None.

        The `clean_group` parameter identifies the DataItem as a query of interest,
        usually in the context of a CleanerTask. An 'ok' value means the query
        represents rows without a problem, and a 'needs_cleaning' value means the rows
        need fixing.
        """

        # Query settings
        if model is not None and parent is None:
            self._model_or_parent: type[M] | DataItem[M] = model
            if filter_by is not None:
                raise ValueError("When model is set, filter_by should not be set")
        elif parent is not None and model is None:
            self._model_or_parent = parent
            if filter_by is None or filter_by == "":
                raise ValueError("When parent is set, filter_by should be set")
        elif model is None and parent is None:
            raise ValueError("Set model or parent")
        else:
            raise ValueError("Set model or parent, but not both")
        self.filter_by = filter_by
        self.exclude = exclude

        # Report settings
        if metric_name and (
            bad_chars := [c for c in metric_name if c not in _ITEM_KEY_CHAR_SET]
        ):
            raise ValueError(
                f"metric_name '{metric_name}' has disallowed character"
                f"{'' if len(bad_chars) == 1 else 's'} '{''.join(sorted(bad_chars))}'"
            )
        if metric_name == "":
            raise ValueError("metric_name is an empty string, should be None")
        if metric_name is None and clean_group is not None:
            raise ValueError(f"clean_group is '{clean_group}', but metric_name is None")
        if metric_name is None and report_name is not None:
            raise ValueError(f"report_name is '{report_name}', but metric_name is None")
        if report_name == "":
            raise ValueError("report_name is an empty string, should be None")
        if clean_group is not None and clean_group not in get_args(CLEAN_GROUP_T):
            raise ValueError(f"clean_group has invalid value '{clean_group}'")
        self.metric_name = metric_name
        self.clean_group = clean_group
        self.report_name = report_name

    def __repr__(self) -> str:
        if isinstance(self._model_or_parent, DataItem):
            args = [f"parent={self._model_or_parent!r}"]
        else:
            args = [f"model={self._model_or_parent.__name__}"]
        if self.filter_by:
            args.append(f"filter_by={self.filter_by!r}")
        if self.exclude:
            args.append(f"exclude={self.exclude!r}")
        if self.metric_name:
            args.append(f"metric_name={self.metric_name!r}")
        if self.report_name:
            args.append(f"report_name={self.report_name!r}")
        if self.clean_group:
            args.append(f"clean_group={self.clean_group!r}")
        return f'{type(self).__name__}({", ".join(args)})'

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, DataItem):
            return (
                self._model_or_parent == other._model_or_parent
                and self.filter_by == other.filter_by
                and self.exclude == other.exclude
                and self.metric_name == other.metric_name
                and self.report_name == other.report_name
                and self.clean_group == other.clean_group
            )
        return NotImplemented

    @property
    def model(self) -> type[M] | None:
        """If this is a model DataItem, return the Model, else None."""
        if isinstance(self._model_or_parent, DataItem):
            return None
        return self._model_or_parent

    @property
    def parent(self) -> DataItem[M] | None:
        """If this is a subquery DataItem, return the parent DataItem, else None."""
        if isinstance(self._model_or_parent, DataItem):
            return self._model_or_parent
        return None

    def get_queryset(self) -> QuerySet[M]:
        """Return the Django query for this DataItem."""
        if isinstance(self._model_or_parent, DataItem):
            query = self._model_or_parent.get_queryset()
        else:
            query = self._model_or_parent._default_manager.all()

        if isinstance(self.filter_by, str):
            filter_by = {self.filter_by: True}
            if self.exclude:
                query = query.exclude(**filter_by)
            else:
                query = query.filter(**filter_by)
        elif isinstance(self.filter_by, Q):
            if self.exclude:
                query = query.exclude(self.filter_by)
            else:
                query = query.filter(self.filter_by)
        return query

    def count(self) -> int:
        """Return the number of rows matched for this DataItem."""
        return self.get_queryset().count()


class DataModelSpec(Generic[M]):
    """
    Define queries on a Model that can identify issues.

    This provides a higher-level interface for constructing a hierarchy of DataItems.
    The top-level is the most general, and queries are filtered to focus on more
    specific sets of rows as you go down the hierarchy.

    Each DataItem is identified by a key which represents its place in the hierarchy.
    For example, the key for a DataItem for active users created in 2023 might be
    'active.created_in_2023'.

    When exporting the {key: DataItem} dict with `to_data_items`, the keys are turned
    into fully-qualified key by prefixing them with the model key. The model key is
    derived from the `verbose_plural_name` of the model. For example, a fully-qualified
    key would be 'users.active.created_in_2023'.

    https://docs.djangoproject.com/en/4.2/ref/models/options/#verbose-name-plural
    """

    def __init__(
        self,
        model: type[M],
        subdivisions: list[DataBisectSpec] | None = None,
        omit_key_prefixes: list[str] | None = None,
        metric_name_overrides: dict[str, str] | None = None,
        report_name_overrides: dict[str, str] | None = None,
        ok_key: str | None = None,
        needs_cleaning_key: str | None = None,
        cleaned_report_name: str = "Cleaned",
    ) -> None:
        """
        Initialize a DataModelSpec, checking for init-time issues.

        Keyword arguments:

        model - The model for this hierarchy of queries
        subdivisions - The subqueries, as a list of DataBisectSpecs
        omit_key_prefixes - A list of key prefixes that should be omitted from reports.
            Since the key name represents the hierarchy, omitting a prefix removes a
            whole branch of queries and subqueries.
        metric_name_overrides - A dict of keys to the metric names as used in `dict` and
            JSON keys. The default metric name is the last component of the key.
        report_name_overrides - A dict of keys to the human-suitable report names. The
            default report name is the last component of the key, converted to a
            title-cased phrase.
        ok_key - The key for the "ok" DataItem, such as rows that have already been
            cleaned.
        needs_cleaning_key - The key for the "needs_cleaning" DataItem, such as rows
            that need manual or automated cleaning.
        cleaned_report_name - The report name for the cleaned DataItem, added after
            running cleaning. This defaults to "Cleaned".
        """
        self.model = model
        self.subdivisions = subdivisions or []
        self.omit_key_prefixes = omit_key_prefixes or []
        self.metric_name_overrides = metric_name_overrides or {}
        self.report_name_overrides = report_name_overrides or {}
        self.ok_key = ok_key
        self.needs_cleaning_key = needs_cleaning_key
        self.cleaned_report_name = cleaned_report_name

    def __repr__(self) -> str:
        args = [f"model={self.model.__name__}"]
        if self.subdivisions:
            args.append(f"subdivisions={self.subdivisions!r}")
        if self.omit_key_prefixes:
            args.append(f"omit_key_prefixes={self.omit_key_prefixes!r}")
        if self.metric_name_overrides:
            args.append(f"metric_name_overrides={self.metric_name_overrides!r}")
        if self.report_name_overrides:
            args.append(f"report_name_overrides={self.report_name_overrides!r}")
        if self.ok_key:
            args.append(f"ok_key={self.ok_key!r}")
        if self.needs_cleaning_key:
            args.append(f"needs_cleaning_key={self.needs_cleaning_key!r}")
        if self.cleaned_report_name != "Cleaned":
            args.append(f"cleaned_report_name={self.cleaned_report_name!r}")
        return f'{type(self).__name__}({", ".join(args)})'

    @property
    def model_key(self) -> str:
        """Return the key for this DataModelSpec, used in DataIssueTask."""
        return str(self.model._meta.verbose_name_plural).replace(" ", "_")

    def omit_key(self, key: str) -> bool:
        return any(
            key == omit or key.startswith(omit + _KEY_SEP)
            for omit in self.omit_key_prefixes
        )

    def metric_name(self, key: str) -> str | None:
        """Return None (to omit), a friendlier name, or the original name."""
        if self.omit_key(key):
            return None
        return self.metric_name_overrides.get(key, key)

    def report_name(self, key: str) -> str | None:
        if self.omit_key(key):
            return None
        return self.report_name_overrides.get(
            key, key.split(_KEY_SEP)[-1].replace("_", " ").replace("!", "not ").title()
        )

    def clean_group(self, subname: str) -> CLEAN_GROUP_T | None:
        """Identify when the subname is for a key cleaning stat."""
        if subname == self.ok_key:
            return "ok"
        elif subname == self.needs_cleaning_key:
            return "needs_cleaning"
        else:
            return None

    def to_data_items(self) -> dict[str, DataItem[M]]:
        """Converts the spec to a dictionary of DataItems."""
        data_items: dict[str, DataItem[M]] = {
            "": DataItem(
                model=self.model,
                metric_name=self.model_key,
                report_name=str(self.model._meta.verbose_name_plural).title(),
            )
        }
        for subdivision in self.subdivisions:
            for key, item in subdivision.to_data_items(self, data_items).items():
                if key in data_items:
                    raise Exception(f"Duplicate key '{key}' returned by {item}")
                data_items[key] = item
        return {
            (f"{self.model_key}{_KEY_SEP}{key}" if key else self.model_key): item
            for key, item in data_items.items()
        }


class DataBisectSpec:
    """Bisect a parent query."""

    def __init__(
        self,
        key: str,
        bisect_by: str | Q,
    ) -> None:
        if key.startswith(_KEY_SEP):
            raise ValueError(f"The key '{key}' should not start with '{_KEY_SEP}'")
        if bad_chars := [c for c in key if c not in _ITEM_KEY_CHAR_SET]:
            raise ValueError(
                f"key '{key}' has disallowed character"
                f"{'' if len(bad_chars) == 1 else 's'} '{''.join(sorted(bad_chars))}'"
            )
        if not bisect_by:
            raise ValueError("Set the bisect_by filter")
        parts = key.split(".")
        for part in parts:
            if _NEGATE_PREFIX in part[1:]:
                raise ValueError(
                    f"In key '{key}', the prefix '{_NEGATE_PREFIX}' is in the"
                    f" middle of subkey '{part}'"
                )
        if parts[-1][0] == _NEGATE_PREFIX:
            raise ValueError(
                f"In key '{key}', the prefix '{_NEGATE_PREFIX}' is not allowed"
                f" in the last subkey '{parts[-1]}'"
            )

        self.key = key
        self.bisect_by = bisect_by

    def __repr__(self) -> str:
        args = [f"key={self.key!r}", f"bisect_by={self.bisect_by!r}"]
        return f'{type(self).__name__}({", ".join(args)})'

    def to_data_items(
        self, model_spec: DataModelSpec[M], existing_items: dict[str, DataItem[M]]
    ) -> dict[str, DataItem[M]]:
        """Return two data items bisecting the parent data."""
        if _KEY_SEP in self.key:
            subparent_name, part_name = self.key.rsplit(_KEY_SEP, 1)
            neg_key = f"{subparent_name}{_KEY_SEP}{_NEGATE_PREFIX}{part_name}"
        else:
            subparent_name = ""
            part_name = self.key
            neg_key = f"{_NEGATE_PREFIX}{part_name}"

        parent = existing_items[subparent_name]
        return {
            self.key: self._to_bisected_data_item(
                self.key, model_spec, parent, "positive"
            ),
            neg_key: self._to_bisected_data_item(
                neg_key, model_spec, parent, "negative"
            ),
        }

    def _to_bisected_data_item(
        self,
        key: str,
        model_spec: DataModelSpec[M],
        parent: DataItem[M],
        bisect: Literal["positive", "negative"],
    ) -> DataItem[M]:
        """Create one of the bisected data items."""
        return DataItem(
            parent=parent,
            filter_by=self.bisect_by,
            exclude=bisect == "negative",
            metric_name=model_spec.metric_name(key),
            clean_group=model_spec.clean_group(key),
            report_name=model_spec.report_name(key),
        )


class CleanedItem(DataItem[M]):
    def __init__(self, model: type[M], report_name: str) -> None:
        super().__init__(
            model=model,
            metric_name="cleaned",
            report_name=report_name,
        )


class DataIssueTask:
    """Base class for data issue / cleaner tasks."""

    slug: str  # Short name, appropriate for command-line option
    title: str  # Short title for reports
    check_description: str  # A sentence describing what this cleaner is checking.
    can_clean: bool  # True if the issue can be automatically cleaned
    data_specification: list[DataModelSpec[Any]] = []  # The specification for this task

    _counts: Counts | None
    _cleanup_data: CleanupData | None
    _cleaned: bool
    _cleaned_report_name: dict[str, str]

    def __init__(self) -> None:
        self._counts = None
        self._cleanup_data = None
        self._cleaned = False
        self._cleaned_report_name = {}
        self.data_items = self._get_data_items()

    def _get_data_items(self) -> dict[str, DataItem[Any]]:
        """Turn the data_specification into a dictionary of names to DataItems."""
        data_items: dict[str, DataItem[Any]] = {}
        for model_spec in self.data_specification:
            model_items = self._get_data_items_for_model_spec(model_spec)
            overlap_keys = set(data_items.keys()) & set(model_items.keys())
            if overlap_keys:
                raise Exception(
                    f"For model '{model_spec.model_key}', these metric_name keys"
                    f" already exist: {sorted(overlap_keys)}"
                )
            data_items.update(model_items)
        return data_items

    def _get_data_items_for_model_spec(
        self, model_spec: DataModelSpec[M]
    ) -> dict[str, DataItem[M]]:
        # TODO: more spec checking
        data_items: dict[str, DataItem[M]] = {}
        has_needs_cleaning = False
        self._cleaned_report_name[model_spec.model_key] = model_spec.cleaned_report_name
        for name, item in model_spec.to_data_items().items():
            except_prefix = f"For model '{model_spec.model_key}', the data item {name}"
            if item.clean_group == "needs_cleaning":
                if has_needs_cleaning:
                    raise Exception(
                        f"{except_prefix} is 2nd item with clean_group='needs_cleaning'"
                    )
                if not model_spec.cleaned_report_name:
                    raise Exception(
                        f"{except_prefix} has clean_group='needs_cleaning', but the"
                        " model_spec has not set cleaned_report_name"
                    )
                has_needs_cleaning = True
            if name in data_items:
                raise Exception(f"{except_prefix} is already registered.")
            data_items[name] = item
        return data_items

    @property
    def counts(self) -> Counts:
        """Get relevant counts for data issues and prepare to clean if possible."""
        if self._counts is None:
            if self._cleanup_data is not None:
                raise ValueError(
                    "self.cleanup_data should be None when self._counts is None"
                )
            self._counts, self._cleanup_data = self._get_counts_and_data()
        return self._counts

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        counts: Counts = {"summary": {"ok": 0, "needs_cleaning": 0}}
        cleanup_data: CleanupData = {}

        for name, data_item in self.data_items.items():
            if not (data_item.metric_name or data_item.clean_group):
                continue
            count = data_item.count()

            if data_item.model:
                counts[name] = {"all": count}
            elif data_item.metric_name:
                model_name = name.split(".")[0]
                counts[model_name][data_item.metric_name] = count

            if data_item.clean_group:
                counts["summary"][data_item.clean_group] += count
                if data_item.clean_group == "needs_cleaning":
                    cleanup_data[model_name] = name

        return counts, cleanup_data

    @property
    def cleanup_data(self) -> CleanupData:
        """Get data needed to clean data issues."""
        if not self.counts:
            raise ValueError("self.counts must have a value when calling cleanup_data.")
        if not self._cleanup_data:
            raise ValueError(
                "self._cleanup_data must have a value when calling cleanup_data."
            )
        return self._cleanup_data

    def issues(self) -> int:
        """Return the number of detected data issues."""
        return self.counts["summary"]["needs_cleaning"]

    def _clean(self) -> int:
        """
        Clean the detected items.

        Returns the number of cleaned items. Implementors can add detailed
        counts to self._counts as needed.
        """
        raise NotImplementedError("_clean() not implemented")

    def markdown_report(self) -> str:
        """Return Markdown-formatted report of issues found and (maybe) fixed."""

        lines: list[str] = []
        for model_metric_name, model_counts in self.counts.items():
            if model_metric_name != "summary":
                model_data_item = self.data_items[model_metric_name]
                lines.extend(
                    self._markdown_lines_for_model(
                        model_metric_name, model_data_item, model_counts
                    )
                )
        return "\n".join(lines)

    def _markdown_lines_for_model(
        self,
        model_metric_name: str,
        model_data_item: DataItem[Any],
        model_counts: dict[str, int],
    ) -> list[str]:
        """Get the report lines for a model."""
        if not model_data_item.report_name:
            return []

        total = model_counts["all"]
        lines = [f"{model_data_item.report_name}:", f"  All: {total}"]

        if total == 0:
            return lines
        if model_data_item.metric_name is None:
            raise Exception(f"DataItem {model_metric_name} has .metric_name None")
        if model_data_item.model is None:
            raise Exception(f"DataItem {model_metric_name} has .model None")

        section_counts: dict[tuple[str, ...], int] = {
            (model_data_item.metric_name,): total
        }
        section_subitems: dict[tuple[str, ...], list[tuple[DataItem[Any], int]]] = (
            defaultdict(list)
        )

        prefix = model_data_item.metric_name + _KEY_SEP
        cleaned = model_counts.get("cleaned")

        # Collect items and counts where the direct parent item has a non-zero count
        for name, item in self.data_items.items():
            if not (name.startswith(prefix) and item.metric_name and item.report_name):
                continue
            parts = tuple(name.split(_KEY_SEP))
            parent_key = parts[:-1]
            parent_total = section_counts[parent_key]
            count = model_counts[item.metric_name]
            if parent_total != 0:
                section_counts[parts] = count
                section_subitems[parent_key].append((item, count))
                if cleaned and item.clean_group == "needs_cleaning":
                    cleaned_report_name = self._cleaned_report_name[model_metric_name]
                    section_counts[parts + (cleaned_report_name,)] = cleaned
                    section_subitems[parts].append(
                        (
                            CleanedItem(model_data_item.model, cleaned_report_name),
                            cleaned,
                        )
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

    @staticmethod
    def _as_percent(part: int, whole: int) -> str:
        """Return value followed by percent of whole, like '5 ( 30.0%)'"""
        if not whole > 0:
            raise ValueError("whole must be greater than 0 when calling _as_percent")
        len_whole = len(str(whole))
        return f"{part:{len_whole}d} ({part / whole:6.1%})"


class CleanerTask(DataIssueTask):
    """Base class for tasks that can clean up detected issues."""

    can_clean = True

    def clean(self) -> int:
        """Clean the detected items, and update counts["summary"]"""
        summary = self.counts["summary"]
        if not self._cleaned:
            summary["cleaned"] = self._clean()
            self._cleaned = True
        return summary["cleaned"]

    def _clean(self) -> int:
        """Call the specified cleaners."""
        counts = self.counts
        cleanup_data = self.cleanup_data
        total_cleaned = 0
        for model_name, metric_name in cleanup_data.items():
            clean_item = self.data_items[metric_name]
            cleaner = getattr(self, f"clean_{model_name}")
            count = cleaner(clean_item)
            counts[model_name]["cleaned"] = count
            total_cleaned += count
        return total_cleaned


class DetectorTask(DataIssueTask):
    """Base class for tasks that cannot clean up detected issues."""

    can_clean = False

    def _clean(self) -> int:
        """DetectorTask can't clean any detected issues."""
        return 0
