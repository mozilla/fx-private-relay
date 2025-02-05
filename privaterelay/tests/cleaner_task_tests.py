"""Tests for privaterelay/cleaner_task.py"""

from datetime import UTC, datetime
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet

import pytest
from model_bakery import baker

from privaterelay.cleaner_task import (
    CleanedItem,
    CleanerTask,
    DataBisectSpec,
    DataIssueTask,
    DataItem,
    DataModelItem,
    DataModelSpec,
    ReportEntry,
)
from privaterelay.models import Profile


@pytest.fixture
def four_users(db: None) -> dict[str, User]:
    date_joined = [
        datetime(2023, 5, 17, tzinfo=UTC),
        datetime(2023, 8, 2, tzinfo=UTC),
        datetime(2024, 1, 22, tzinfo=UTC),
        datetime(2024, 5, 17, tzinfo=UTC),
    ]
    is_active = [True, False, True, False]

    return {
        f"user{n}": baker.make(
            User,
            username=f"user{n}",
            email=f"user{n}@example.com",
            is_active=is_active[n - 1],
            date_joined=date_joined[n - 1],
        )
        for n in range(1, 5)
    }


_CLEANED_ITEM_INIT_RAISES_TEST_CASES = {
    "count_negative": ({"count": -1}, r"^count can not be negative$"),
    "report_name_empty": (
        {"report_name": ""},
        r"^report_name is an empty string, should be None$",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _CLEANED_ITEM_INIT_RAISES_TEST_CASES.values(),
    ids=_CLEANED_ITEM_INIT_RAISES_TEST_CASES.keys(),
)
def test_cleaned_item_init_raises(args: dict[str, str | int], expected: str) -> None:
    init_args = {key: str(val) for key, val in args.items()}
    count = int(init_args.pop("count", 0))
    with pytest.raises(ValueError, match=expected):
        CleanedItem(count=count, **init_args)


def test_cleaned_item_init_count_only() -> None:
    cleaned = CleanedItem(5)
    assert cleaned.metric_name == "cleaned"
    assert cleaned.report_name == "Cleaned"
    assert cleaned.count() == 5
    assert repr(cleaned) == "CleanedItem(5)"
    assert cleaned == CleanedItem(5)
    assert cleaned != CleanedItem(5, report_name="Fixed")
    assert cleaned != Exception()


def test_cleaned_item_init_all() -> None:
    cleaned = CleanedItem(6, "Report")
    assert cleaned.metric_name == "cleaned"
    assert cleaned.report_name == "Report"
    assert cleaned.count() == 6
    assert repr(cleaned) == "CleanedItem(6, report_name='Report')"
    assert cleaned == CleanedItem(6, "Report")
    assert cleaned != CleanedItem(6)


def test_data_model_item_equality() -> None:
    assert DataModelItem(User) == DataModelItem(User)
    assert DataModelItem(User) != DataModelItem(Profile)
    assert DataModelItem(User) != User()


def test_data_model_item_repr() -> None:
    assert repr(DataModelItem(User)) == "DataModelItem(User)"


_DATA_ITEM_INIT_RAISES_TEST_CASES = {
    "filter_by_empty": (
        {"filter_by": ""},
        r"^filter_by is an empty string, should be set$",
    ),
    "report_name_but_no_metric_name": (
        {"filter_by": "a_column", "report_name": "Report"},
        r"^report_name is 'Report', but metric_name is None$",
    ),
    "clean_group_but_no_metric_name": (
        {"filter_by": "a_column", "clean_group": "ok"},
        r"^clean_group is 'ok', but metric_name is None$",
    ),
    "clean_group_invalid": (
        {"filter_by": "a_column", "metric_name": "profiles", "clean_group": "invalid"},
        r"^clean_group has invalid value 'invalid'$",
    ),
    "metric_name_cleaned": (
        {"filter_by": "a_column", "metric_name": "cleaned"},
        r"^metric_name 'cleaned' is reserved for CleanedItem",
    ),
    "metric_name_one_bad_char": (
        {"filter_by": "a_column", "metric_name": "profile~.foo"},
        r"^metric_name 'profile~\.foo' has disallowed character '~'$",
    ),
    "metric_name_two_bad_chars": (
        {"filter_by": "a_column", "metric_name": "pro~file^.foo"},
        r"^metric_name 'pro~file\^\.foo' has disallowed characters '\^~'$",
    ),
    "metric_name_empty": (
        {"filter_by": "a_column", "metric_name": ""},
        r"^metric_name is an empty string, should be None$",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_ITEM_INIT_RAISES_TEST_CASES.values(),
    ids=_DATA_ITEM_INIT_RAISES_TEST_CASES.keys(),
)
def test_data_item_init_bad_args_raises(args: dict[str, Any], expected: str) -> None:
    with pytest.raises(ValueError, match=expected):
        DataItem(parent=DataModelItem(Profile), **args)


def test_data_item_queryset_and_count_and_repr(four_users: dict[str, User]) -> None:

    user_item = DataModelItem(User)
    dt_2024_plus = Q(date_joined__gte=datetime(2024, 1, 1, tzinfo=UTC))
    joined_2024_or_later = DataItem(
        parent=user_item, filter_by=dt_2024_plus, metric_name="2024_or_later"
    )
    joined_2023_or_earlier = DataItem(
        parent=user_item,
        filter_by=dt_2024_plus,
        exclude=True,
        metric_name="2023_or_earlier",
    )
    active_users_2024 = DataItem(
        parent=joined_2024_or_later, filter_by="is_active", metric_name="active"
    )
    inactive_users_2024 = DataItem(
        parent=joined_2024_or_later,
        filter_by="is_active",
        exclude=True,
        metric_name="inactive",
    )
    active_users_2023 = DataItem(
        parent=joined_2023_or_earlier, filter_by="is_active", metric_name="active"
    )
    inactive_users_2023 = DataItem(
        parent=joined_2023_or_earlier,
        filter_by="is_active",
        exclude=True,
        metric_name="inactive",
    )

    assert user_item.count() == 4
    assert joined_2024_or_later.count() == 2
    assert joined_2023_or_earlier.count() == 2
    assert active_users_2024.get_queryset().get() == four_users["user3"]
    assert inactive_users_2024.get_queryset().get() == four_users["user4"]
    assert active_users_2023.get_queryset().get() == four_users["user1"]
    assert inactive_users_2023.get_queryset().get() == four_users["user2"]


_DATA_ITEM_REPR_TEST_CASES = {
    "minimum": ({}, "DataModelItem(User), 'is_active'"),
    "exclude": ({"exclude": True}, "DataModelItem(User), 'is_active', exclude=True"),
    "metric_name": (
        {"metric_name": "users"},
        "DataModelItem(User), 'is_active', metric_name='users'",
    ),
    "report_name": (
        {"metric_name": "users", "report_name": "Users"},
        "DataModelItem(User), 'is_active', metric_name='users', report_name='Users'",
    ),
    "clean_group": (
        {"metric_name": "users", "clean_group": "ok"},
        "DataModelItem(User), 'is_active', metric_name='users', clean_group='ok'",
    ),
    "parent_is_data_item": (
        {
            "parent": DataItem(
                DataModelItem(User), filter_by="is_active", metric_name="active"
            ),
            "filter_by": "is_staff",
            "metric_name": "active.staff",
        },
        "<DataItem(metric_name='active', ...)>, 'is_staff', metric_name='active.staff'",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_ITEM_REPR_TEST_CASES.values(),
    ids=_DATA_ITEM_REPR_TEST_CASES.keys(),
)
def test_data_item_repr(args: dict[str, Any], expected: str) -> None:
    init_args: dict[str, Any] = {
        "parent": DataModelItem(User),
        "filter_by": "is_active",
        "exclude": False,
        "metric_name": None,
        "report_name": None,
        "clean_group": None,
    }
    for name, value in args.items():
        assert name in init_args
        set_value = value
        init_args[name] = set_value

    item: DataItem[User] = DataItem(**init_args)
    assert repr(item) == f"DataItem({expected})"


_DATA_MODEL_SPEC_INIT_RAISES_TEST_CASES = {
    "model_none": ({"model": None}, r"^model None is not a Django model."),
    "model_exception": (
        {"model": Exception("foo")},
        r"^model Exception\('foo'\) is not a Django model.",
    ),
    "omit_key_prefixes_includes_metric_name_overrides_key": (
        {
            "model": User,
            "subdivisions": [DataBisectSpec("metric", "is_metric")],
            "omit_key_prefixes": ["metric"],
            "metric_name_overrides": {"metric": "override_name"},
        },
        r"^The metric_name_overrides key 'metric'"
        r" should not be in omit_key_prefixes \['metric'\]$",
    ),
    "omit_key_prefixes_includes_report_name_overrides_key": (
        {
            "model": User,
            "subdivisions": [DataBisectSpec("key", "is_key")],
            "omit_key_prefixes": ["key"],
            "report_name_overrides": {"key": "Is Overridden"},
        },
        r"^The report_name_overrides key 'key'"
        r" should not be in omit_key_prefixes \['key'\]$",
    ),
    "omit_key_prefixes_includes_ok_key": (
        {
            "model": User,
            "subdivisions": [DataBisectSpec("ok", "is_active")],
            "omit_key_prefixes": ["ok"],
            "ok_key": "ok",
        },
        r"^The ok_key 'ok' should not be in omit_key_prefixes \['ok'\]$",
    ),
    "omit_key_prefixes_includes_needs_cleaning_key": (
        {
            "model": User,
            "subdivisions": [DataBisectSpec("needs_cleaning", "is_active")],
            "omit_key_prefixes": ["needs_cleaning"],
            "needs_cleaning_key": "needs_cleaning",
        },
        r"^The needs_cleaning_key 'needs_cleaning'"
        r" should not be in omit_key_prefixes \['needs_cleaning'\]$",
    ),
    "omit_key_prefixes_includes_blank_string": (
        {
            "model": User,
            "omit_key_prefixes": [""],
        },
        r"^omit_key_prefixes should not include the empty string$",
    ),
    "subdivisions_duplicate_key": (
        {
            "model": User,
            "subdivisions": [
                DataBisectSpec("active", "is_active"),
                DataBisectSpec("active", Q(is_active=True)),
            ],
        },
        r"^Duplicate key 'active' in subdivisions",
    ),
    "omit_key_prefixes_missing": (
        {"model": User, "omit_key_prefixes": ["missing"]},
        r"^omit_key_prefixes key 'missing' not found in subdivision keys \[\]$",
    ),
    "metric_name_overrides_missing": (
        {"model": User, "metric_name_overrides": {"missing": "is_missing"}},
        r"^metric_name_overrides key 'missing' not found in subdivision keys \[\]$",
    ),
    "report_name_overrides_missing": (
        {"model": User, "report_name_overrides": {"missing": "is_missing"}},
        r"^report_name_overrides key 'missing' not found in subdivision keys \[\]$",
    ),
    "ok_key_missing": (
        {
            "model": User,
            "subdivisions": [DataBisectSpec("active", "is_active")],
            "ok_key": "missing",
        },
        r"^ok_key 'missing' not found in subdivision keys \['!active', 'active'\]$",
    ),
    "needs_cleaning_key_missing": (
        {"model": User, "needs_cleaning_key": "missing"},
        r"^needs_cleaning_key 'missing' not found in subdivision keys \[\]$",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_MODEL_SPEC_INIT_RAISES_TEST_CASES.values(),
    ids=_DATA_MODEL_SPEC_INIT_RAISES_TEST_CASES.keys(),
)
def test_data_model_spec_init_raises(args: dict[str, Any], expected: str) -> None:
    with pytest.raises(ValueError, match=expected):
        DataModelSpec(**args)


_DATA_MODEL_SPEC_REPR_TEST_CASES = {
    "subdivisions": (
        {"subdivisions": [DataBisectSpec("key", "filter")]},
        "model=User, subdivisions=[DataBisectSpec(key='key', bisect_by='filter')]",
    ),
    "omit_key_prefixes": (
        {
            "subdivisions": [DataBisectSpec("omit", "is_active")],
            "omit_key_prefixes": ["omit"],
        },
        "model=User, subdivisions=[DataBisectSpec(key='omit', bisect_by='is_active')],"
        " omit_key_prefixes=['omit']",
    ),
    "metric_name_overrides": (
        {
            "subdivisions": [DataBisectSpec("foo", "is_active")],
            "metric_name_overrides": {"foo": "bar"},
        },
        "model=User, subdivisions=[DataBisectSpec(key='foo', bisect_by='is_active')],"
        " metric_name_overrides={'foo': 'bar'}",
    ),
    "report_name_overrides": (
        {
            "subdivisions": [DataBisectSpec("foo", "is_active")],
            "report_name_overrides": {"foo": "bar"},
        },
        "model=User, subdivisions=[DataBisectSpec(key='foo', bisect_by='is_active')],"
        " report_name_overrides={'foo': 'bar'}",
    ),
    "ok_key": (
        {"subdivisions": [DataBisectSpec("foo", "is_active")], "ok_key": "foo"},
        "model=User, subdivisions=[DataBisectSpec(key='foo', bisect_by='is_active')],"
        " ok_key='foo'",
    ),
    "needs_cleaning_key": (
        {
            "subdivisions": [DataBisectSpec("foo", "is_active")],
            "needs_cleaning_key": "foo",
        },
        "model=User, subdivisions=[DataBisectSpec(key='foo', bisect_by='is_active')],"
        " needs_cleaning_key='foo'",
    ),
    "cleaned_report_name": (
        {"cleaned_report_name": "Done"},
        "model=User, cleaned_report_name='Done'",
    ),
    "defaults": (
        {
            "subdivisions": None,
            "omit_key_prefixes": None,
            "metric_name_overrides": None,
            "report_name_overrides": None,
            "ok_key": None,
            "needs_cleaning_key": None,
            "cleaned_report_name": "Cleaned",
        },
        "model=User",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_MODEL_SPEC_REPR_TEST_CASES.values(),
    ids=_DATA_MODEL_SPEC_REPR_TEST_CASES.keys(),
)
def test_data_model_spec_repr(args: dict[str, Any], expected: str) -> None:
    init_args: dict[str, Any] = {
        "subdivisions": [],
        "omit_key_prefixes": None,
        "metric_name_overrides": None,
        "report_name_overrides": None,
        "ok_key": None,
        "needs_cleaning_key": None,
        "cleaned_report_name": "Cleaned",
    }
    for name, value in args.items():
        assert name in init_args
        init_args[name] = value

    spec = DataModelSpec(model=User, **init_args)
    assert repr(spec) == f"DataModelSpec({expected})"


def test_data_model_spec_model_key() -> None:
    model_spec = DataModelSpec(User)
    assert model_spec.model_key == "users"


def test_data_model_spec_omit_key() -> None:
    model_spec = DataModelSpec(
        User,
        [
            DataBisectSpec("is_active", "is_active"),
            DataBisectSpec("is_active.is_staff", "is_staff"),
        ],
        omit_key_prefixes=["!is_active"],
    )
    assert not model_spec.omit_key("is_active")
    assert model_spec.omit_key("!is_active")  # Exact match
    assert not model_spec.omit_key("!is_active_is_staff")  # Not a subkey
    assert model_spec.omit_key("!is_active.is_staff")  # Is a subkey


def test_data_model_spec_metric_name() -> None:
    model_spec = DataModelSpec(
        User,
        [
            DataBisectSpec("is_active", "is_active"),
            DataBisectSpec("is_active.is_staff", "is_staff"),
        ],
        omit_key_prefixes=["!is_active"],
        metric_name_overrides={"is_active": "is_good"},
    )
    assert model_spec.metric_name("is_active") == "is_good"
    assert model_spec.metric_name("!is_active") is None
    assert model_spec.metric_name("something_else") == "something_else"
    assert model_spec.metric_name("is_active.is_staff") == "is_active.is_staff"


def test_data_model_spec_report_name() -> None:
    model_spec = DataModelSpec(
        User,
        [
            DataBisectSpec("is_active", "is_active"),
            DataBisectSpec("is_active.staff", "is_staff"),
        ],
        omit_key_prefixes=["!is_active"],
        report_name_overrides={"is_active": "Good"},
    )
    assert model_spec.report_name("is_active") == "Good"
    assert model_spec.report_name("!is_active") is None
    assert model_spec.report_name("something_else") == "Something Else"
    assert model_spec.report_name("is_active.staff") == "Staff"
    assert model_spec.report_name("is_active.!staff") == "Not Staff"


def test_data_model_spec_clean_group() -> None:
    model_spec = DataModelSpec(
        User,
        [
            DataBisectSpec("is_active", "is_active"),
            DataBisectSpec("is_active.staff", "staff"),
        ],
        ok_key="is_active",
        needs_cleaning_key="!is_active",
    )
    assert model_spec.clean_group("is_active") == "ok"
    assert model_spec.clean_group("!is_active") == "needs_cleaning"
    assert model_spec.clean_group("something_else") is None
    assert model_spec.clean_group("is_active.staff") is None


def test_data_model_spec_to_data_items_no_subdivisions() -> None:
    model_spec = DataModelSpec(User)
    assert model_spec.to_data_items() == {"users": DataModelItem(User)}


def test_data_model_spec_to_data_items_with_bisect() -> None:
    model_spec = DataModelSpec(User, [DataBisectSpec("active", "is_active")])
    model_item = DataModelItem(User)
    assert model_spec.to_data_items() == {
        "users": model_item,
        "users.active": DataItem(
            parent=DataModelItem(User),
            filter_by="is_active",
            metric_name="active",
            report_name="Active",
        ),
        "users.!active": DataItem(
            parent=DataModelItem(User),
            filter_by="is_active",
            exclude=True,
            metric_name="!active",
            report_name="Not Active",
        ),
    }


def test_data_model_spec_to_data_items_with_bisect_two_levels() -> None:
    """A DataBisectSpec key can have a separator, and the last key part is used."""
    model_spec = DataModelSpec(
        User,
        [
            DataBisectSpec("superuser", "is_superuser"),
            DataBisectSpec("superuser.staff", "is_staff"),
        ],
    )
    items = model_spec.to_data_items()
    assert items == {
        "users": DataModelItem(User),
        "users.superuser": DataItem(
            parent=DataModelItem(User),
            filter_by="is_superuser",
            metric_name="superuser",
            report_name="Superuser",
        ),
        "users.!superuser": DataItem(
            parent=DataModelItem(User),
            filter_by="is_superuser",
            exclude=True,
            metric_name="!superuser",
            report_name="Not Superuser",
        ),
        # The "include" part of superuser.staff
        "users.superuser.staff": DataItem(
            parent=items["users.superuser"],
            filter_by="is_staff",
            metric_name="superuser.staff",
            report_name="Staff",
        ),
        # The "exclude" part of superuser.staff
        "users.superuser.!staff": DataItem(
            parent=items["users.superuser"],
            filter_by="is_staff",
            exclude=True,
            metric_name="superuser.!staff",
            report_name="Not Staff",
        ),
    }


_DATA_BISECT_INIT_RAISES_TEST_CASES = {
    "key_starts_with_period": (
        {"key": ".key", "bisect_by": "filter"},
        r"^The key '.key' should not start with '\.'$",
    ),
    "key_has_bad_character": (
        {"key": "val_as_%", "bisect_by": "filter"},
        r"^key 'val_as_%' has disallowed character '%'$",
    ),
    "key_has_bad_characters": (
        {"key": "val$_%", "bisect_by": "filter"},
        r"^key 'val\$_%' has disallowed characters '\$%'$",
    ),
    "key_has_middle_bang": (
        {"key": "!bang.ba!ng.bang", "bisect_by": "filter"},
        r"^In key '!bang.ba!ng.bang', the prefix '!' is in the middle of subkey"
        r" 'ba!ng'$",
    ),
    "key_has_end_bang_prefix": (
        {"key": "bang.bang.!bang", "bisect_by": "filter"},
        r"^In key 'bang.bang.!bang', the prefix '!' is not allowed in the last subkey"
        r" '!bang'$",
    ),
    "bisect_is_emptykey_has_bad_characters": (
        {"key": "val", "bisect_by": ""},
        r"^Set the bisect_by filter$",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_BISECT_INIT_RAISES_TEST_CASES.values(),
    ids=_DATA_BISECT_INIT_RAISES_TEST_CASES.keys(),
)
def test_data_bisect_spec_init_raises(args: dict[str, Any], expected: str) -> None:
    with pytest.raises(ValueError, match=expected):
        DataBisectSpec(**args)


_DATA_BISECT_SPEC_REPR_TEST_CASES = {
    "bisect_by_string": (
        {"key": "key", "bisect_by": "filter"},
        "key='key', bisect_by='filter'",
    ),
    "bisect_by_q": (
        {"key": "key", "bisect_by": Q(filter_col=False)},
        "key='key', bisect_by=<Q: (AND: ('filter_col', False))>",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_BISECT_SPEC_REPR_TEST_CASES.values(),
    ids=_DATA_BISECT_SPEC_REPR_TEST_CASES.keys(),
)
def test_data_bisect_spec_repr(args: dict[str, Any], expected: str) -> None:
    spec = DataBisectSpec(**args)
    assert repr(spec) == f"DataBisectSpec({expected})"


def test_data_bisect_get_keys() -> None:
    spec = DataBisectSpec("active", "is_active")
    assert sorted(spec.get_keys()) == ["!active", "active"]


def test_data_entry_repr() -> None:
    entry = ReportEntry(DataModelItem(User), 0, 0, [])
    assert repr(entry) == "ReportEntry(DataModelItem(User), 0, 0, [])"


def test_data_entry_eq() -> None:
    item = DataModelItem(User)
    assert ReportEntry(item, 0, 0, []) == ReportEntry(item, 0, 0, [])
    assert ReportEntry(item, 0, 0, []) != ReportEntry(item, 1, 0, [])
    assert ReportEntry(item, 0, 0, []) != ReportEntry(item, 0, 1, [])
    assert ReportEntry(item, 0, 0, []) != ReportEntry(item, 0, 0, ["foo"])
    assert ReportEntry(item, 0, 0, []) != item


def test_data_issue_task_init_double_model_raises() -> None:
    class OverlapTask(DataIssueTask):
        data_specification = [DataModelSpec(User), DataModelSpec(User)]

    with pytest.raises(ValueError, match=r"\nThe key 'users' already exists$"):
        OverlapTask()


def test_data_issue_task_init_no_cleaner_function_is_ok() -> None:
    class NoCleanerFunctionTask(DataIssueTask):
        data_specification = [
            DataModelSpec(
                User,
                [DataBisectSpec("active", "is_active")],
                needs_cleaning_key="!active",
            )
        ]

    NoCleanerFunctionTask()


class DeactivateOddUsersTask(CleanerTask):
    """A data task that deactivates users with an odd number in their email."""

    data_specification = [
        DataModelSpec(
            User,
            [
                DataBisectSpec("is_odd", Q(email__regex=r"user[135679]@example.com")),
                DataBisectSpec("is_odd.active", "is_active"),
            ],
            omit_key_prefixes=["!is_odd"],
            metric_name_overrides={"is_odd.active": "odd_but_active"},
            report_name_overrides={"is_odd.!active": "Inactive"},
            ok_key="is_odd.!active",
            needs_cleaning_key="is_odd.active",
            cleaned_report_name="Deactivated",
        )
    ]

    def clean_users(self, queryset: QuerySet[User]) -> int:
        return queryset.update(is_active=False)


# fmt: off
@pytest.mark.parametrize(
    "part,whole,expected",
    (
        (    0,     2,     "0 (  0.0%)"),
        (    1,     2,     "1 ( 50.0%)"),
        (    2,     2,     "2 (100.0%)"),
        (    1,    20,    " 1 (  5.0%)"),
        (   19,    20,    "19 ( 95.0%)"),
        (    1,   200,   "  1 (  0.5%)"),
        (  199,   200,   "199 ( 99.5%)"),
        (    1,  2000,  "   1 (  0.1%)"),
        ( 1999,  2000,  "1999 (100.0%)"),
        (    1, 20000, "    1 (  0.0%)"),
        (19999, 20000, "19999 (100.0%)"),
        (20000, 20000, "20000 (100.0%)"),
    ),
)
# fmt: on
def test_data_issue_task_as_percent(part: int, whole: int, expected: str) -> None:
    assert DataIssueTask._as_percent(part, whole) == expected


def test_data_issue_task_as_percent_part_greater_than_whole() -> None:
    """
    Allow the part to be greater than the whole.

    This can happen if the task is not run inside a transaction, so that user
    actions can change the state of the database.
    """
    assert DataIssueTask._as_percent(201, 200) == "201 (100.5%)"


@pytest.mark.parametrize(
    "part,whole,error",
    (
        (1, 0, r"^whole \(0\) can not be less than 0$"),
        (-1, 2, r"^part \(-1\) can not be negative$"),
    ),
)
def test_data_issue_task_as_percent_raises(part: int, whole: int, error: str) -> None:
    with pytest.raises(ValueError, match=error):
        DataIssueTask._as_percent(part, whole)


def test_cleaner_task_counts_for_deactivate_odd(four_users: dict[str, User]) -> None:
    assert DeactivateOddUsersTask().counts == {
        "summary": {"needs_cleaning": 2, "ok": 0},
        "users": {"all": 4, "is_odd": 2, "is_odd.!active": 0, "odd_but_active": 2},
    }


def test_cleaner_task_cleanup_data_for_deactivate_odd(
    four_users: dict[str, User],
) -> None:
    assert DeactivateOddUsersTask().cleanup_data == {"users": "users.is_odd.active"}


def test_cleaner_task_issues_for_deactivate_odd(four_users: dict[str, User]) -> None:
    assert DeactivateOddUsersTask().issues() == 2


def test_cleaner_task_get_report_entries_preclean_for_deactivate_odd(
    four_users: dict[str, User],
) -> None:
    task = DeactivateOddUsersTask()
    reports = task.get_report_entries()
    assert list(reports.keys()) == [
        "users",
        "users.is_odd",
        "users.is_odd.!active",
        "users.is_odd.active",
    ]
    assert reports == {
        "users": ReportEntry(task.data_items["users"], 4, 1, ["users.is_odd"]),
        "users.is_odd": ReportEntry(
            task.data_items["users.is_odd"],
            2,
            2,
            ["users.is_odd.!active", "users.is_odd.active"],
        ),
        "users.is_odd.!active": ReportEntry(
            task.data_items["users.is_odd.!active"],
            0,
            3,
            [],
        ),
        "users.is_odd.active": ReportEntry(
            task.data_items["users.is_odd.active"],
            2,
            3,
            [],
        ),
    }


def test_cleaner_task_markdown_report_preclean_for_deactivate_odd(
    four_users: dict[str, User],
) -> None:
    markdown = DeactivateOddUsersTask().markdown_report()
    expected = """\
Users:
  All: 4
    Is Odd: 2 ( 50.0%)
      Inactive: 0 (  0.0%)
      Active  : 2 (100.0%)"""
    assert markdown == expected


def test_cleaner_task_clean_for_deactivate_odd(four_users: dict[str, User]) -> None:
    task = DeactivateOddUsersTask()
    assert task.clean() == 2
    users = User.objects.order_by("email").all()
    assert len(users) == 4
    for c, user in enumerate(users):
        assert user.email == f"user{c+1}@example.com"
        if (c + 1) % 2 == 0:
            assert not user.is_active


def test_cleaner_task_counts_postclean_for_deactivate_odd(
    four_users: dict[str, User],
) -> None:
    task = DeactivateOddUsersTask()
    task.clean()
    assert task.counts == {
        "summary": {"needs_cleaning": 2, "ok": 0, "cleaned": 2},
        "users": {
            "all": 4,
            "cleaned": 2,
            "is_odd": 2,
            "is_odd.!active": 0,
            "odd_but_active": 2,
        },
    }


def test_cleaner_task_get_report_entries_postclean_for_deactivate_odd(
    four_users: dict[str, User],
) -> None:
    task = DeactivateOddUsersTask()
    task.clean()
    reports = task.get_report_entries()
    assert list(reports.keys()) == [
        "users",
        "users.is_odd",
        "users.is_odd.!active",
        "users.is_odd.active",
        "users.is_odd.active.cleaned",
    ]
    assert reports == {
        "users": ReportEntry(task.data_items["users"], 4, 1, ["users.is_odd"]),
        "users.is_odd": ReportEntry(
            task.data_items["users.is_odd"],
            2,
            2,
            ["users.is_odd.!active", "users.is_odd.active"],
        ),
        "users.is_odd.!active": ReportEntry(
            task.data_items["users.is_odd.!active"], 0, 3, []
        ),
        "users.is_odd.active": ReportEntry(
            task.data_items["users.is_odd.active"],
            2,
            3,
            ["users.is_odd.active.cleaned"],
        ),
        "users.is_odd.active.cleaned": ReportEntry(
            CleanedItem(2, report_name="Deactivated"), 2, 4, []
        ),
    }


def test_cleaner_task_markdown_report_postclean_for_deactivate_odd(
    four_users: dict[str, User],
) -> None:
    task = DeactivateOddUsersTask()
    task.clean()
    markdown = task.markdown_report()
    expected = """\
Users:
  All: 4
    Is Odd: 2 ( 50.0%)
      Inactive: 0 (  0.0%)
      Active  : 2 (100.0%)
        Deactivated: 2 (100.0%)"""
    assert markdown == expected


def test_cleaner_task_no_cleaner_function_raises() -> None:
    class NoCleanerFunctionTask(CleanerTask):
        data_specification = [
            DataModelSpec(
                User,
                [DataBisectSpec("active", "is_active")],
                needs_cleaning_key="!active",
            )
        ]

    with pytest.raises(
        ValueError,
        match=(
            r"\nThis item has clean_group='needs_cleaning', but the cleaning function"
            r" clean_users is not defined."
        ),
    ):
        NoCleanerFunctionTask()


def test_cleaner_task_no_data_specification() -> None:
    class NoDataSpecTask(CleanerTask):
        data_specification = []

    task = NoDataSpecTask()
    assert task.counts == {}
    assert task.cleanup_data == {}
    assert task.markdown_report() == ""
