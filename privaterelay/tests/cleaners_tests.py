"""Tests for privaterelay/cleaners.py (shared functionality)"""

from datetime import UTC, datetime
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Q

import pytest
from model_bakery import baker

from emails.models import Profile
from privaterelay.cleaners import DataBisectSpec, DataItem, DataModelSpec


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


def test_data_item_init_with_model() -> None:
    model_item = DataItem(model=Profile)
    assert model_item.model == Profile
    assert model_item.parent is None


def test_data_item_init_with_parent() -> None:
    model_item = DataItem(model=Profile)
    item = DataItem(parent=model_item, filter_by="subdomain__isnull")
    item.model is None
    assert item.parent is model_item


_DATA_ITEM_INIT_RAISES_TEST_CASES = {
    "no_model_or_parent": ({}, r"^Set model or parent$"),
    "model_and_parent": (
        {"model": Profile, "parent": DataItem(model=Profile)},
        r"^Set model or parent, but not both$",
    ),
    "model_and_filter": (
        {"model": Profile, "filter_by": "sent_welcome_email"},
        r"^When model is set, filter_by should not be set$",
    ),
    "parent_and_filter_none": (
        {"parent": DataItem(model=Profile)},
        r"^When parent is set, filter_by should be set$",
    ),
    "parent_and_filter_empty": (
        {"parent": DataItem(model=Profile), "filter_by": ""},
        r"^When parent is set, filter_by should be set$",
    ),
    "metric_name_one_bad_char": (
        {"model": Profile, "metric_name": "profile~.foo"},
        r"^metric_name 'profile~\.foo' has disallowed character '~'$",
    ),
    "metric_name_two_bad_chars": (
        {"model": Profile, "metric_name": "pro~file^.foo"},
        r"^metric_name 'pro~file\^\.foo' has disallowed characters '\^~'$",
    ),
    "metric_name_empty": (
        {"model": Profile, "metric_name": ""},
        r"^metric_name is an empty string, should be None$",
    ),
    "clean_group_but_no_metric_name": (
        {"model": Profile, "clean_group": "ok"},
        r"^clean_group is 'ok', but metric_name is None$",
    ),
    "clean_group_invalid": (
        {"model": Profile, "metric_name": "profiles", "clean_group": "invalid"},
        r"^clean_group has invalid value 'invalid'$",
    ),
    "report_name_but_no_metric_name": (
        {"model": Profile, "report_name": "profile"},
        r"^report_name is 'profile', but metric_name is None$",
    ),
    "report_name_empty": (
        {"model": Profile, "metric_name": "profiles", "report_name": ""},
        r"^report_name is an empty string, should be None$",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_ITEM_INIT_RAISES_TEST_CASES.values(),
    ids=_DATA_ITEM_INIT_RAISES_TEST_CASES.keys(),
)
def test_data_item_init_bad_args_raises(args: dict[str, Any], expected: str) -> None:
    with pytest.raises(ValueError, match=expected):
        DataItem(**args)


def test_data_item_queryset_and_count_and_repr(four_users: dict[str, User]) -> None:

    user_item = DataItem(model=User, metric_name="user")
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
    "model": ({"model": User}, "model=User"),
    "parent": (
        {"parent": User, "filter_by": "is_active"},
        "parent=DataItem(model=User), filter_by='is_active'",
    ),
    "exclude": (
        {"parent": User, "filter_by": "is_active", "exclude": True},
        "parent=DataItem(model=User), filter_by='is_active', exclude=True",
    ),
    "metric_name": (
        {"model": User, "metric_name": "users"},
        "model=User, metric_name='users'",
    ),
    "report_name": (
        {"model": User, "metric_name": "users", "report_name": "Users"},
        "model=User, metric_name='users', report_name='Users'",
    ),
    "clean_group": (
        {"model": User, "metric_name": "users", "clean_group": "ok"},
        "model=User, metric_name='users', clean_group='ok'",
    ),
    "defaults": (
        {
            "model": User,  # Well, mostly defaults...
            "parent": None,
            "filter_by": None,
            "exclude": False,
            "metric_name": None,
            "report_name": None,
            "clean_group": None,
        },
        "model=User",
    ),
}


@pytest.mark.parametrize(
    "args,expected",
    _DATA_ITEM_REPR_TEST_CASES.values(),
    ids=_DATA_ITEM_REPR_TEST_CASES.keys(),
)
def test_data_item_repr(args: dict[str, Any], expected: str) -> None:
    init_args: dict[str, Any] = {
        "model": None,
        "parent": None,
        "filter_by": None,
        "exclude": False,
        "metric_name": None,
        "report_name": None,
        "clean_group": None,
    }
    for name, value in args.items():
        assert name in init_args
        if name == "parent" and value:
            set_value: Any = DataItem(model=value)
        else:
            set_value = value
        init_args[name] = set_value

    item: DataItem[User] = DataItem(**init_args)
    assert repr(item) == f"DataItem({expected})"


_DATA_MODEL_SPEC_REPR_TEST_CASES = {
    "subdivisions": (
        {"subdivisions": [DataBisectSpec("key", "filter")]},
        "model=User, subdivisions=[DataBisectSpec(key='key', bisect_by='filter')]",
    ),
    "omit_key_prefixes": (
        {"omit_key_prefixes": ["omit"]},
        "model=User, omit_key_prefixes=['omit']",
    ),
    "metric_name_overrides": (
        {"metric_name_overrides": {"foo": "bar"}},
        "model=User, metric_name_overrides={'foo': 'bar'}",
    ),
    "report_name_overrides": (
        {"report_name_overrides": {"foo": "bar"}},
        "model=User, report_name_overrides={'foo': 'bar'}",
    ),
    "ok_key": ({"ok_key": "foo"}, "model=User, ok_key='foo'"),
    "needs_cleaning_key": (
        {"needs_cleaning_key": "foo"},
        "model=User, needs_cleaning_key='foo'",
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
    model_spec = DataModelSpec(User, omit_key_prefixes=["!is_active"])
    assert not model_spec.omit_key("is_active")
    assert model_spec.omit_key("!is_active")  # Exact match
    assert not model_spec.omit_key("!is_active_for_today")  # Not a subkey
    assert model_spec.omit_key("!is_active.for_today")  # Is a subkey


def test_data_model_spec_metric_name() -> None:
    model_spec = DataModelSpec(
        User,
        omit_key_prefixes=["!is_active"],
        metric_name_overrides={
            "is_active": "is_good",
            "!is_active": "is_bad",
        },
    )
    assert model_spec.metric_name("is_active") == "is_good"
    assert model_spec.metric_name("!is_active") is None  # omit wins
    assert model_spec.metric_name("something_else") == "something_else"
    assert model_spec.metric_name("is_active.today") == "is_active.today"


def test_data_model_spec_report_name() -> None:
    model_spec = DataModelSpec(
        User,
        omit_key_prefixes=["!is_active"],
        report_name_overrides={
            "is_active": "Good",
            "!is_active": "Bad",
        },
    )
    assert model_spec.report_name("is_active") == "Good"
    assert model_spec.report_name("!is_active") is None  # omit wins
    assert model_spec.report_name("something_else") == "Something Else"
    assert model_spec.report_name("is_active.today") == "Today"
    assert model_spec.report_name("is_active.!today") == "Not Today"


def test_data_model_spec_clean_group() -> None:
    model_spec = DataModelSpec(
        User,
        ok_key="is_active",
        needs_cleaning_key="!is_active",
    )
    assert model_spec.clean_group("is_active") == "ok"
    assert model_spec.clean_group("!is_active") == "needs_cleaning"
    assert model_spec.clean_group("something_else") is None
    assert model_spec.clean_group("is_active.today") is None


def test_data_model_to_data_items_no_subdivisions() -> None:
    model_spec = DataModelSpec(User)
    assert model_spec.to_data_items() == {
        "users": DataItem(model=User, metric_name="users", report_name="Users")
    }


def test_data_model_to_data_items_with_bisect() -> None:
    model_spec = DataModelSpec(User, [DataBisectSpec("active", "is_active")])
    model_item = DataItem(model=User, metric_name="users", report_name="Users")
    assert model_spec.to_data_items() == {
        "users": model_item,
        "users.active": DataItem(
            parent=model_item,
            filter_by="is_active",
            metric_name="active",
            report_name="Active",
        ),
        "users.!active": DataItem(
            parent=model_item,
            filter_by="is_active",
            exclude=True,
            metric_name="!active",
            report_name="Not Active",
        ),
    }


def test_data_model_to_data_items_with_bisect_two_levels() -> None:
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
        "users": DataItem(model=User, metric_name="users", report_name="Users"),
        "users.superuser": DataItem(
            parent=items["users"],
            filter_by="is_superuser",
            metric_name="superuser",
            report_name="Superuser",
        ),
        "users.!superuser": DataItem(
            parent=items["users"],
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


def test_data_model_to_data_items_with_duplicates_fails() -> None:
    model_spec = DataModelSpec(
        User,
        [
            DataBisectSpec("active", "is_active"),
            DataBisectSpec("active", Q(is_active=True)),
        ],
    )
    with pytest.raises(Exception, match="^Duplicate key 'active' returned by DataItem"):
        model_spec.to_data_items()


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
