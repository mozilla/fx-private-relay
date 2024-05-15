"""Tasks that detect data issues and (if possible) clean them."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from django.contrib.auth.models import User
from django.db.models import Count, F, Model, Q
from django.db.models.query import QuerySet

from privaterelay.cleaners import CleanerTask, CleanupData, Counts

from .models import DomainAddress, Profile, RelayAddress
from .signals import create_user_profile

M = TypeVar("M", bound=Model)


class AnyDataItem(Generic[M]):

    def __init__(
        self,
        model: type[M] | None = None,
        parent: AnyDataItem[M] | None = None,
        filter_by: dict[str, Any] | F | Q | None = None,
        exclude: dict[str, Any] | F | Q | None = None,
    ) -> None:

        if model is None and parent is None:
            raise ValueError("Set model or parent")
        if model is not None and parent is not None:
            raise ValueError("Set one of model or parent, but not both.")
        self.model = model
        self.parent = parent
        self.filter_by = filter_by
        self.exclude = exclude

    def get_queryset(self) -> QuerySet[M]:
        if self.model:
            query = self.model._default_manager.all()
        elif self.parent:
            query = self.parent.get_queryset()
        else:
            raise ValueError("Neither model or parent is set.")
        if isinstance(self.filter_by, dict):
            query = query.filter(**self.filter_by)
        if isinstance(self.filter_by, (F | Q)):
            query = query.filter(self.filter_by)
        if isinstance(self.exclude, dict):
            query = query.exclude(**self.exclude)
        if isinstance(self.exclude, (F | Q)):
            query = query.exclude(self.exclude)
        return query


class DataItem(AnyDataItem[M]):

    def __init__(
        self,
        model: type[M],
        filter_by: dict[str, Any] | F | Q | None = None,
        exclude: dict[str, Any] | F | Q | None = None,
    ) -> None:
        super().__init__(model=model, filter_by=filter_by, exclude=exclude)


class SubDataItem(AnyDataItem[M]):

    def __init__(
        self,
        parent: AnyDataItem[M],
        filter_by: dict[str, Any] | F | Q | None = None,
        exclude: dict[str, Any] | F | Q | None = None,
    ) -> None:
        super().__init__(parent=parent, filter_by=filter_by, exclude=exclude)


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

    items: dict[str, AnyDataItem] = {
        "profiles": DataItem(Profile),
        "relay_addresses": DataItem(RelayAddress),
        "domain_addresses": DataItem(DomainAddress),
    }
    items.update(
        {
            "profiles_without_server_storage": SubDataItem(
                items["profiles"], filter_by={"server_storage": False}
            ),
            "no_store_relay_addresses": SubDataItem(
                items["relay_addresses"],
                filter_by={"user__profile__server_storage": False},
            ),
            "no_store_domain_addresses": SubDataItem(
                items["domain_addresses"],
                filter_by={"user__profile__server_storage": False},
            ),
        }
    )
    items.update(
        {
            "empty_relay_addresses": SubDataItem(
                items["no_store_relay_addresses"], filter_by=_blank_relay_data
            ),
            "empty_domain_addresses": SubDataItem(
                items["no_store_domain_addresses"], filter_by=_blank_domain_data
            ),
            "non_empty_relay_addresses": SubDataItem(
                items["no_store_relay_addresses"], exclude=_blank_relay_data
            ),
            "non_empty_domain_addresses": SubDataItem(
                items["no_store_domain_addresses"], exclude=_blank_domain_data
            ),
        }
    )

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        """
        Analyze usage of the server_storage flag and server-stored data.

        Returns:
        * counts: two-level dict of row counts for Profile, RelayAddress, and
          DomainAddress
        * cleanup_data: two-element dict of RelayAddresses and DomainAddress
          queries to clear
        """

        counts: dict[str, int] = {}
        cleanup_data: CleanupData = {}
        for name, item in self.items.items():
            qs = item.get_queryset()
            count = qs.count()
            counts[name] = count
            if name == "non_empty_domain_addresses":
                cleanup_data["domain_addresses"] = qs
            if name == "non_empty_relay_addresses":
                cleanup_data["relay_addresses"] = qs

        out_counts: Counts = {
            "summary": {
                "ok": counts["empty_relay_addresses"]
                + counts["empty_domain_addresses"],
                "needs_cleaning": counts["non_empty_relay_addresses"]
                + counts["non_empty_domain_addresses"],
            },
            "profiles": {
                "all": counts["profiles"],
                "no_server_storage": counts["profiles_without_server_storage"],
            },
            "relay_addresses": {
                "all": counts["relay_addresses"],
                "no_server_storage": counts["no_store_relay_addresses"],
                "no_server_storage_or_data": counts["empty_relay_addresses"],
                "no_server_storage_but_data": counts["non_empty_relay_addresses"],
            },
            "domain_addresses": {
                "all": counts["domain_addresses"],
                "no_server_storage": counts["no_store_domain_addresses"],
                "no_server_storage_or_data": counts["empty_domain_addresses"],
                "no_server_storage_but_data": counts["non_empty_domain_addresses"],
            },
        }
        return out_counts, cleanup_data

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


class MissingProfileCleaner(CleanerTask):
    slug = "missing-profile"
    title = "Ensures users have a profile"
    check_description = "All users should have one profile."

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        """
        Find users without profiles.

        Returns:
        * counts: two-level dict of summary and user counts
        * cleanup_data: empty dict
        """

        # Construct user -> profile counts
        users_with_profile_counts = User.objects.annotate(num_profiles=Count("profile"))
        ok_users = users_with_profile_counts.filter(num_profiles__gte=1)
        no_profile_users = users_with_profile_counts.filter(num_profiles=0)

        # Get counts once
        ok_user_count = ok_users.count()
        no_profile_user_count = no_profile_users.count()

        # Return counts and (empty) cleanup data
        counts: Counts = {
            "summary": {
                "ok": ok_user_count,
                "needs_cleaning": no_profile_user_count,
            },
            "users": {
                "all": User.objects.count(),
                "no_profile": no_profile_user_count,
                "has_profile": ok_user_count,
            },
        }
        cleanup_data: CleanupData = {"users": no_profile_users}
        return counts, cleanup_data

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
