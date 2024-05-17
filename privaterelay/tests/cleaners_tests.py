"""Tests for privaterelay/cleaners.py (shared functionality)"""

from datetime import UTC, datetime

from django.contrib.auth.models import User
from django.db.models import Q

import pytest
from model_bakery import baker

from emails.models import Profile
from privaterelay.cleaners import DataItem


def test_data_item_init_no_model_or_parent_raises():
    with pytest.raises(ValueError, match=r"^Set model or parent$"):
        DataItem()


def test_data_item_init_no_model_and_parent_raises():
    parent = DataItem(model=Profile)
    with pytest.raises(ValueError, match=r"^Set model or parent, but not both$"):
        DataItem(model=Profile, parent=parent)


def test_data_item_init_with_model():
    model_item = DataItem(model=Profile)
    assert model_item.model == Profile
    assert model_item.parent is None


def test_data_item_init_with_model_and_filter_raises():
    with pytest.raises(
        ValueError, match=r"^When model is set, filter_by should not be set$"
    ):
        DataItem(model=Profile, filter_by="sent_welcome_email")


def test_data_item_init_with_parent():
    model_item = DataItem(model=Profile)
    item = DataItem(parent=model_item, filter_by="subdomain__isnull")
    item.model is None
    assert item.parent is model_item


@pytest.mark.parametrize("filter_by", ["none", "empty_string"])
def test_data_item_init_with_parent_and_no_filter_raises(filter_by):
    model_item = DataItem(model=Profile)
    _filter_by = None if filter_by == "none" else ""
    with pytest.raises(
        ValueError, match=r"^When parent is set, filter_by should be set$"
    ):
        DataItem(parent=model_item, filter_by=_filter_by)


def test_data_item_init_with_invalid_stat_name_raises():
    with pytest.raises(
        ValueError, match=r"^stat_name 'profile~\.foo' has disallowed characters '\.~'$"
    ):
        DataItem(model=Profile, stat_name="profile~.foo")


def test_data_item_init_with_empty_stat_name_raises():
    with pytest.raises(
        ValueError, match=r"^stat_name is an empty string, should be None$"
    ):
        DataItem(model=Profile, stat_name="")


def test_data_item_init_with_no_stat_name_but_clean_group_raises():
    with pytest.raises(
        ValueError, match=r"^clean_group is 'ok', but stat_name is None$"
    ):
        DataItem(model=Profile, clean_group="ok")


def test_data_item_init_with_no_stat_name_but_report_name_raises():
    with pytest.raises(
        ValueError, match=r"^report_name is 'Profiles', but stat_name is None$"
    ):
        DataItem(model=Profile, report_name="Profiles")


def test_data_item_init_with_empty_report_name_raises():
    with pytest.raises(
        ValueError, match=r"^report_name is an empty string, should be None$"
    ):
        DataItem(model=Profile, stat_name="profiles", report_name="")


@pytest.mark.django_db
def test_data_item_queryset_and_count():
    user1 = baker.make(
        User,
        username="user1",
        email="user1@example.com",
        is_active=True,
        date_joined=datetime(2023, 5, 17, tzinfo=UTC),
    )
    user2 = baker.make(
        User,
        username="user2",
        email="user2@example.com",
        is_active=False,
        date_joined=datetime(2023, 8, 2, tzinfo=UTC),
    )
    user3 = baker.make(
        User,
        username="user3",
        email="user3@example.com",
        is_active=True,
        date_joined=datetime(2024, 1, 22, tzinfo=UTC),
    )
    user4 = baker.make(
        User,
        username="user4",
        email="user4@example.com",
        is_active=False,
        date_joined=datetime(2024, 5, 17, tzinfo=UTC),
    )

    user_item = DataItem(model=User, stat_name="user")
    dt_2024_plus = Q(date_joined__gte=datetime(2024, 1, 1, tzinfo=UTC))
    joined_2024_or_later = DataItem(
        parent=user_item, filter_by=dt_2024_plus, stat_name="2024_or_later"
    )
    joined_2023_or_earlier = DataItem(
        parent=user_item,
        filter_by=dt_2024_plus,
        exclude=True,
        stat_name="2023_or_earlier",
    )
    active_users_2024 = DataItem(
        parent=joined_2024_or_later, filter_by="is_active", stat_name="active"
    )
    inactive_users_2024 = DataItem(
        parent=joined_2024_or_later,
        filter_by="is_active",
        exclude=True,
        stat_name="inactive",
    )
    active_users_2023 = DataItem(
        parent=joined_2023_or_earlier, filter_by="is_active", stat_name="active"
    )
    inactive_users_2023 = DataItem(
        parent=joined_2023_or_earlier,
        filter_by="is_active",
        exclude=True,
        stat_name="inactive",
    )

    assert user_item.count() == 4
    assert joined_2024_or_later.count() == 2
    assert joined_2023_or_earlier.count() == 2
    assert active_users_2024.get_queryset().get() == user3
    assert inactive_users_2024.get_queryset().get() == user4
    assert active_users_2023.get_queryset().get() == user1
    assert inactive_users_2023.get_queryset().get() == user2
