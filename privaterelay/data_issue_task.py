"""Framework for tasks that identify data issues and (if possible) clean them up"""

from __future__ import annotations

import string
from abc import ABCMeta, abstractmethod
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


# Used by CleanedItem
_CLEANED_METRIC_NAME = "cleaned"


def _metric_name_for_model(model: type[M]) -> str:
    """The model's metric key, used in metrics and as a dictionary key."""
    return str(model._meta.verbose_name_plural).replace(" ", "_")


class ReportItem(metaclass=ABCMeta):
    """
    An item in a data task report.

    This is the base model in the reporting item hierarchy. Code should use the derived
    classes CleanedItem, DataModelItem, and DataItem.
    """

    def __init__(self, metric_name: str | None = None, report_name: str | None = None):
        """
        Initialize a ReportItem.

        The `metric_name` parameter sets the name of the entry when it appears as a
        `dict` or JSON key. The default is `None`, which omits the entry from
        reports.

        The `report_name` parameter sets the name of the entry when it appears in a
        report for humans. It can be omitted when `metric_name` is None.
        """
        if metric_name and (
            bad_chars := [c for c in metric_name if c not in _ITEM_KEY_CHAR_SET]
        ):
            raise ValueError(
                f"metric_name '{metric_name}' has disallowed character"
                f"{'' if len(bad_chars) == 1 else 's'} '{''.join(sorted(bad_chars))}'"
            )
        if metric_name == "":
            raise ValueError("metric_name is an empty string, should be None")
        if metric_name is None and report_name is not None:
            raise ValueError(f"report_name is '{report_name}', but metric_name is None")
        if report_name == "":
            raise ValueError("report_name is an empty string, should be None")

        self.metric_name = metric_name
        self.report_name = report_name

    @abstractmethod
    def count(self) -> int:
        raise NotImplementedError


class CleanedItem(ReportItem):
    """Represents the results of cleaning a Model."""

    def __init__(self, count: int, report_name: str = "Cleaned") -> None:
        if count < 0:
            raise ValueError("count can not be negative")
        self._count = count
        super().__init__(metric_name=_CLEANED_METRIC_NAME, report_name=report_name)

    def __repr__(self) -> str:
        args = [str(self._count)]
        if self.report_name != "Cleaned":
            args.append(f"report_name={self.report_name!r}")
        return f'{type(self).__name__}({", ".join(args)})'

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, CleanedItem):
            return (
                self.__class__ == other.__class__
                and self._count == other._count
                and self.metric_name == other.metric_name
                and self.report_name == other.report_name
            )
        return NotImplemented

    def count(self) -> int:
        return self._count


class BaseDataItem(ReportItem, Generic[M]):
    """An entry in a data task report backed by a database query."""

    def __init__(
        self,
        model_or_parent: type[M] | BaseDataItem[M],
        filter_by: str | Q | None = None,
        exclude: bool = False,
        metric_name: str | None = None,
        report_name: str | None = None,
    ) -> None:
        if metric_name == _CLEANED_METRIC_NAME:
            raise ValueError(f"metric_name '{metric_name}' is reserved for CleanedItem")

        self._model_or_parent = model_or_parent
        self.filter_by = filter_by
        self.exclude = exclude
        super().__init__(metric_name=metric_name, report_name=report_name)

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, BaseDataItem):
            return (
                self._model_or_parent == other._model_or_parent
                and self.filter_by == other.filter_by
                and self.exclude == other.exclude
                and self.metric_name == other.metric_name
                and self.report_name == other.report_name
            )
        return NotImplemented

    def get_queryset(self) -> QuerySet[M]:
        """Return the Django query for this BaseDataItem."""
        if isinstance(self._model_or_parent, BaseDataItem):
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
        """Return the number of rows matched for this BaseDataItem."""
        return self.get_queryset().count()


class DataModelItem(BaseDataItem[M]):
    """A BaseDataItem representing the top-level Model"""

    _model_or_parent: type[M]
    metric_name: str
    report_name: str
    filter_by: None

    def __init__(self, model: type[M]) -> None:
        """Initialize a DataModelItem."""
        super().__init__(
            model_or_parent=model,
            metric_name=_metric_name_for_model(model),
            report_name=str(model._meta.verbose_name_plural).title(),
        )

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self._model_or_parent.__name__})"


class DataItem(BaseDataItem[M]):
    """
    A DataItem is a subquery of a DataModelItem or DataItem.

    A top-level model DataItem represents all the items in a table. A query that selects
    some rows is a DataItem with a parent. The specific rows of interest can be
    represented by multiple levels of DataItems, giving context to the specific rows.
    """

    _model_or_parent: BaseDataItem[M]

    def __init__(
        self,
        parent: BaseDataItem[M],
        filter_by: str | Q,
        exclude: bool = False,
        metric_name: str | None = None,
        report_name: str | None = None,
        clean_group: CLEAN_GROUP_T | None = None,
    ) -> None:
        """
        Initialize a DataItem, checking for init-time issues.

        The `filter_by` parameter sets the filter (`filter` is a Python keyword). It can
        be a string, which represents a boolean filter. It can be a Django Q object,
        such as `Q(num_deleted_relay_addresses__gt=5)`.

        The default is to include rows matching the query. If `exclude` is set to
        `True`, then the query is for rows that do not match the filter.

        The `clean_group` parameter identifies the DataItem as a query of interest,
        usually in the context of a CleanerTask. An 'ok' value means the query
        represents rows without a problem, and a 'needs_cleaning' value means the rows
        need fixing.
        """

        if filter_by == "":
            raise ValueError("filter_by is an empty string, should be set")
        if metric_name is None and clean_group is not None:
            raise ValueError(f"clean_group is '{clean_group}', but metric_name is None")
        if clean_group is not None and clean_group not in get_args(CLEAN_GROUP_T):
            raise ValueError(f"clean_group has invalid value '{clean_group}'")
        self.clean_group = clean_group

        super().__init__(
            model_or_parent=parent,
            filter_by=filter_by,
            exclude=exclude,
            metric_name=metric_name,
            report_name=report_name,
        )

    def __repr__(self) -> str:
        if isinstance(self._model_or_parent, DataItem):
            args = [
                f"<{type(self._model_or_parent).__name__}"
                f"(metric_name={self._model_or_parent.metric_name!r}, ...)>"
            ]
        else:
            args = [repr(self._model_or_parent)]
        args.append(repr(self.filter_by))
        if self.exclude:
            args.append(f"exclude={self.exclude!r}")
        if self.metric_name:
            args.append(f"metric_name={self.metric_name!r}")
        if self.report_name:
            args.append(f"report_name={self.report_name!r}")
        if self.clean_group:
            args.append(f"clean_group={self.clean_group!r}")
        return f'{type(self).__name__}({", ".join(args)})'


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
        if not isinstance(model, type) or not issubclass(model, Model):
            raise ValueError(f"model {model!r} is not a Django model.")

        subkeys: set[str] = set()
        for sub in subdivisions or []:
            for key in sub.get_keys():
                if key in subkeys:
                    raise ValueError("Duplicate key 'active' in subdivisions")
                subkeys.add(key)

        if omit_key_prefixes:
            if "" in omit_key_prefixes:
                raise ValueError(
                    "omit_key_prefixes should not include the empty string"
                )
            for key in omit_key_prefixes:
                if key not in subkeys:
                    raise ValueError(
                        f"omit_key_prefixes key '{key}' not found in subdivision"
                        f" keys {sorted(subkeys)}"
                    )
            for key in (metric_name_overrides or {}).keys():
                if key in omit_key_prefixes:
                    raise ValueError(
                        f"The metric_name_overrides key '{key}'"
                        f" should not be in omit_key_prefixes {omit_key_prefixes}"
                    )
            for key in (report_name_overrides or {}).keys():
                if key in omit_key_prefixes:
                    raise ValueError(
                        f"The report_name_overrides key '{key}'"
                        f" should not be in omit_key_prefixes {omit_key_prefixes}"
                    )
            if ok_key and ok_key in omit_key_prefixes:
                raise ValueError(
                    f"The ok_key '{ok_key}'"
                    f" should not be in omit_key_prefixes {omit_key_prefixes}"
                )
            if needs_cleaning_key and needs_cleaning_key in omit_key_prefixes:
                raise ValueError(
                    f"The needs_cleaning_key '{needs_cleaning_key}'"
                    f" should not be in omit_key_prefixes {omit_key_prefixes}"
                )

        if metric_name_overrides:
            for key in metric_name_overrides.keys():
                if key not in subkeys:
                    raise ValueError(
                        f"metric_name_overrides key '{key}' not found in subdivision"
                        f" keys {sorted(subkeys)}"
                    )
        if report_name_overrides:
            for key in report_name_overrides.keys():
                if key not in subkeys:
                    raise ValueError(
                        f"report_name_overrides key '{key}' not found in subdivision"
                        f" keys {sorted(subkeys)}"
                    )
        if ok_key and ok_key not in subkeys:
            raise ValueError(
                f"ok_key '{ok_key}' not found in subdivision keys {sorted(subkeys)}"
            )
        if needs_cleaning_key and needs_cleaning_key not in subkeys:
            raise ValueError(
                f"needs_cleaning_key '{needs_cleaning_key}' not found in subdivision"
                f" keys {sorted(subkeys)}"
            )

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
        return _metric_name_for_model(self.model)

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

    def to_data_items(self) -> dict[str, BaseDataItem[M]]:
        """Converts the spec to a dictionary of DataItems."""
        model_item = DataModelItem(self.model)
        data_items: dict[str, BaseDataItem[M]] = {"": model_item}
        for subdivision in self.subdivisions:
            data_items.update(subdivision.to_data_items(self, data_items).items())

        # For the return dict, prefix with model's metric name
        model_key = model_item.metric_name
        return {
            (f"{model_key}{_KEY_SEP}{key}" if key else model_key): item
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

    def get_keys(self) -> list[str]:
        if _KEY_SEP in self.key:
            subparent_name, part_name = self.key.rsplit(_KEY_SEP, 1)
            neg_key = f"{subparent_name}{_KEY_SEP}{_NEGATE_PREFIX}{part_name}"
        else:
            subparent_name = ""
            part_name = self.key
            neg_key = f"{_NEGATE_PREFIX}{part_name}"
        return [self.key, neg_key]

    def to_data_items(
        self, model_spec: DataModelSpec[M], existing_items: dict[str, BaseDataItem[M]]
    ) -> dict[str, DataItem[M]]:
        """Return two data items bisecting the parent data."""
        if _KEY_SEP in self.key:
            subparent_name, _ = self.key.rsplit(_KEY_SEP, 1)
        else:
            subparent_name = ""
        parent = existing_items[subparent_name]
        pos_key, neg_key = self.get_keys()
        return {
            pos_key: self._to_bisected_data_item(
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
        parent: BaseDataItem[M],
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


class ReportEntry:
    """An entry in a report."""

    def __init__(
        self,
        item: ReportItem,
        count: int,
        depth: int,
        child_keys: list[str],
    ) -> None:
        self.item = item
        self.count = count
        self.depth = depth
        self.child_keys = child_keys

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}({self.item!r}, {self.count!r}, {self.depth!r},"
            f" {self.child_keys!r})"
        )

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, self.__class__):
            return (
                self.__class__ == other.__class__
                and self.item == other.item
                and self.count == other.count
                and self.depth == other.depth
                and self.child_keys == other.child_keys
            )
        return NotImplemented


class DataIssueTask:
    """Base class for data issue / cleaner tasks."""

    slug: str  # Short name, appropriate for command-line option
    title: str  # Short title for reports
    check_description: str  # A sentence describing what this cleaner is checking.
    can_clean: bool = False  # True if the issue can be automatically cleaned
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

    def _get_data_items(self) -> dict[str, BaseDataItem[Any]]:
        """Turn the data_specification into a dictionary of names to DataItems."""
        data_items: dict[str, BaseDataItem[Any]] = {}
        for model_spec in self.data_specification:
            if model_spec.model_key in data_items:
                raise ValueError(
                    f"{model_spec!r}\nThe key '{model_spec.model_key}' already exists"
                )
            data_items.update(self._get_data_items_for_model_spec(model_spec))
        return data_items

    def _get_data_items_for_model_spec(
        self, model_spec: DataModelSpec[M]
    ) -> dict[str, BaseDataItem[M]]:
        data_items: dict[str, BaseDataItem[M]] = {}
        self._cleaned_report_name[model_spec.model_key] = model_spec.cleaned_report_name
        for name, item in model_spec.to_data_items().items():
            if (
                self.can_clean
                and isinstance(item, DataItem)
                and item.clean_group == "needs_cleaning"
                and not hasattr(self, f"clean_{model_spec.model_key}")
            ):
                raise ValueError(
                    f"{model_spec!r}\n{item}\n"
                    "This item has clean_group='needs_cleaning', but the"
                    f" cleaning function clean_{model_spec.model_key} is not defined."
                )
            data_items[name] = item
        return data_items

    @property
    def counts(self) -> Counts:
        """Get relevant counts for data issues and prepare to clean if possible."""
        if self._counts is None:
            self._counts, self._cleanup_data = self._get_counts_and_data()
        return self._counts

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        if not self.data_items:
            return {}, {}

        counts: Counts = {"summary": {"ok": 0, "needs_cleaning": 0}}
        cleanup_data: CleanupData = {}

        for name, data_item in self.data_items.items():
            if not data_item.metric_name:
                continue
            count = data_item.count()

            if isinstance(data_item, DataModelItem):
                counts[name] = {"all": count}
            else:
                model_name = name.split(".")[0]
                counts[model_name][data_item.metric_name] = count

            if isinstance(data_item, DataItem) and data_item.clean_group:
                counts["summary"][data_item.clean_group] += count
                if data_item.clean_group == "needs_cleaning":
                    cleanup_data[model_name] = name
        return counts, cleanup_data

    @property
    def cleanup_data(self) -> CleanupData:
        """Get data needed to clean data issues."""
        if not self.counts:
            return {}
        return self._cleanup_data or {}

    def issues(self) -> int:
        """Return the number of detected data issues."""
        return self.counts["summary"]["needs_cleaning"]

    def get_report_entries(self) -> dict[str, ReportEntry]:
        """
        Return an ordered dict of ReportEntries and related data.

        The key of the returned dict is a dotted path representing the path to the top
        of the hierarchy. If the ReportEntry is a DataModelItem or DataItem, it is the
        same key as used in `data_items`.

        The value of the returned dict is a 4-element tuple:
        - The ReportEntry, which may be a DataModelItem or DataItem
        - The count at this level
        - The key of the parent to this entry, or '' if a top element
        - A list of keys of the child elements of the entry, in sorted order

        Any DataModelItem or DataItem with a blank `metric_name` is omitted. Additional
        ReportEntry items may be added, for example to represent the cleaned data.
        """
        # Pass 1: Gather report items and sorting data.
        # The sorting data:
        # clean_group_keys - what DataItems have .clean_group set
        # count_by_key - the pre-computed count from .counts
        # model_keys - the order models appeared in .data_specification
        # report_items - the items that have a .metric_name
        clean_group_keys: dict[CLEAN_GROUP_T, set[str]] = {
            "ok": set(),
            "needs_cleaning": set(),
        }
        count_by_key: dict[str, int] = {}
        model_keys: list[str] = []
        report_items: dict[str, ReportItem] = {}
        for key, data_item in self.data_items.items():
            if not (metric_name := data_item.metric_name):
                continue
            report_items[key] = data_item
            if _KEY_SEP in key:
                # Handle DataItem
                if not isinstance(data_item, DataItem):  # pragma: no cover
                    raise Exception(
                        f"For key '{key}', expected a DataItem, got {data_item!r}"
                    )
                model_key, _ = key.split(_KEY_SEP, 1)
                count_by_key[key] = self.counts[model_key][metric_name]
                if data_item.clean_group:
                    clean_group_keys[data_item.clean_group].add(key)
            else:
                # Handle DataModelItem
                if not isinstance(data_item, DataModelItem):  # pragma: no cover
                    raise Exception(
                        f"For key '{key}', expected a DataModelItem, got {data_item!r}"
                    )
                model_keys.append(key)
                count_by_key[key] = self.counts[key]["all"]

        # Pass 1.2: Created CleanedItem records
        for key in clean_group_keys["needs_cleaning"]:
            model_key, _ = key.split(_KEY_SEP, 1)
            try:
                clean_count = self.counts[model_key][_CLEANED_METRIC_NAME]
            except KeyError:
                continue
            clean_item = CleanedItem(
                clean_count, report_name=self._cleaned_report_name[model_key]
            )
            clean_key = f"{key}{_KEY_SEP}cleaned"
            count_by_key[clean_key] = clean_count
            report_items[clean_key] = clean_item

        # Pass 2: Create index parts for sorting
        # This determines the sort order between siblings
        _INDEX_PART = tuple[int, int, str]
        sort_index_part: dict[str, _INDEX_PART] = {}
        for key, item in report_items.items():
            # First, sort by if this or a descendant has a cleaning_order
            # None, then ok, then needs_cleaning, then both
            has_ok_descendant = any(
                ok_key.startswith(key) for ok_key in clean_group_keys["ok"]
            )
            has_nc_descendant = any(
                nc_key.startswith(key) for nc_key in clean_group_keys["needs_cleaning"]
            )
            cleaning_order = (1 if has_ok_descendant else 0) + (
                2 if has_nc_descendant else 0
            )

            # Next, sort by negation
            # No negation then negation
            if _KEY_SEP in key:
                key_part = key.rsplit(_KEY_SEP, 1)[1]
            else:
                key_part = key
            if key_part.startswith(_NEGATE_PREFIX):
                neg_order = 1
                key_part = key_part[1:]
            else:
                neg_order = 0

            # Finally, sort by name
            sort_index_part[key] = (cleaning_order, neg_order, key_part)

        # Pass 3: Create the sort index
        # Short paths come before long paths
        # Next, use the index part to sort
        _INDEX_FULL = tuple[int, int, tuple[_INDEX_PART, ...]]
        sort_index: dict[str, _INDEX_FULL] = {}
        for key in report_items.keys():
            key_parts = key.split(_KEY_SEP)
            index_parts: list[_INDEX_PART] = []
            model_index = -1
            while key_parts:
                if len(key_parts) == 1:
                    model_index = model_keys.index(key_parts[0])
                subkey = _KEY_SEP.join(key_parts)
                index_parts.insert(0, sort_index_part[subkey])
                key_parts.pop()
            sort_index[key] = (model_index, len(index_parts), tuple(index_parts))

        # Pass 4: Return the sort dict of ReportEntries
        def get_sort_index(key: str) -> _INDEX_FULL:
            return sort_index[key]

        reports: dict[str, ReportEntry] = {}
        for key in sorted(report_items, key=get_sort_index):
            item = report_items[key]
            reports[key] = ReportEntry(
                item, count_by_key[key], key.count(_KEY_SEP) + 1, []
            )
            if _KEY_SEP in key:
                parent_key = key.rsplit(_KEY_SEP, 1)[0]
                reports[parent_key].child_keys.append(key)
        return reports

    def markdown_report(self) -> str:
        """Return Markdown-formatted report of issues found and (maybe) fixed."""

        lines: list[str] = []
        report_entries = self.get_report_entries()

        # Get the maximum length of children for each entry with children
        max_len_children: dict[str, int] = {}
        for key, entry in report_entries.items():
            if entry.child_keys:
                children = [report_entries[subkey] for subkey in entry.child_keys]
                max_len_children[key] = max(
                    len(child.item.report_name or "") for child in children
                )

        # Output the markdown lines
        for key, entry in report_entries.items():
            if isinstance(entry.item, DataModelItem):
                lines.append(f"{entry.item.report_name}:")
                lines.append(f"  All: {entry.count}")
            else:
                parent_key, _ = key.rsplit(_KEY_SEP, 1)
                parent_entry = report_entries[parent_key]
                if parent_entry.count <= 0:
                    continue
                indent = "  " * entry.depth
                max_len = max_len_children[parent_key]
                lines.append(
                    f"{indent}{entry.item.report_name:<{max_len}}:"
                    f" {self._as_percent(entry.count, parent_entry.count)}"
                )
        return "\n".join(lines)

    @staticmethod
    def _as_percent(part: int, whole: int) -> str:
        """Return value followed by percent of whole, like '5 ( 30.0%)'"""
        if whole <= 0:
            raise ValueError(f"whole ({whole}) can not be less than 0")
        if part < 0:
            raise ValueError(f"part ({part}) can not be negative")
        if part > whole:
            raise ValueError(f"part ({part}) can not be greater than whole ({whole})")
        len_whole = len(str(whole))
        return f"{part:{len_whole}d} ({part / whole:6.1%})"


class CleanerTask(DataIssueTask):
    """Base class for tasks that can clean up detected issues."""

    can_clean = True

    def clean(self) -> int:
        """Clean the detected items, and update counts["summary"]"""
        summary = self.counts["summary"]
        if not self._cleaned:
            summary[_CLEANED_METRIC_NAME] = self._clean()
            self._cleaned = True
        return summary[_CLEANED_METRIC_NAME]

    def _clean(self) -> int:
        """Call the specified cleaners."""
        counts = self.counts
        cleanup_data = self.cleanup_data
        total_cleaned = 0
        for model_name, metric_name in cleanup_data.items():
            clean_item = self.data_items[metric_name]
            cleaner = getattr(self, f"clean_{model_name}")
            count = cleaner(clean_item)
            counts[model_name][_CLEANED_METRIC_NAME] = count
            total_cleaned += count
        return total_cleaned
