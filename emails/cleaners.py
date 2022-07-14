"""Tasks that detect data issues and (if possible) clean them."""

from __future__ import annotations
from typing import Optional, TypedDict, Union

from django.db.models import Q, QuerySet

from privaterelay.cleaners import CleanerTask, CleanupData, Counts

from .models import DomainAddress, Profile, RelayAddress


class ServerStorageCleaner(CleanerTask):
    slug = "server-storage"
    title = "Ensure no data is stored when server_storage=False"
    check_description = (
        "When Profile.server_storage is False, the addresses (both regular and domain)"
        " should have empty data (the fields description, generated_for and user_on)."
    )

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        """
        Analyze usage of the server_storage flag and server-stored data.

        Returns:
        * counts: two-level dict of row counts for Profile, RelayAddress, and DomainAddress
        * non_empty_relay_addresses: RelayAddresses with data to clear
        * non_empty_domain_addresses: DomainAddress with data to clear
        """
        profiles_without_server_storage = Profile.objects.filter(server_storage=False)
        relay_addresses = RelayAddress.objects.filter(
            user__profile__server_storage=False
        )
        domain_addresses = DomainAddress.objects.filter(
            user__profile__server_storage=False
        )
        blank_used_on = Q(used_on="") | Q(used_on__isnull=True)
        blank_relay_data = blank_used_on & Q(description="") & Q(generated_for="")
        blank_domain_data = blank_used_on & Q(description="")

        empty_relay_addresses = relay_addresses.filter(blank_relay_data)
        empty_domain_addresses = domain_addresses.filter(blank_domain_data)
        non_empty_relay_addresses = relay_addresses.exclude(blank_relay_data)
        non_empty_domain_addresses = domain_addresses.exclude(blank_domain_data)

        empty_relay_addresses_count = empty_relay_addresses.count()
        empty_domain_addresses_count = empty_domain_addresses.count()
        non_empty_relay_addresses_count = non_empty_relay_addresses.count()
        non_empty_domain_addresses_count = non_empty_domain_addresses.count()

        counts: Counts = {
            "summary": {
                "ok": empty_relay_addresses_count + empty_domain_addresses_count,
                "needs_cleaning": non_empty_relay_addresses_count
                + non_empty_domain_addresses_count,
            },
            "profiles": {
                "all": Profile.objects.count(),
                "no_server_storage": profiles_without_server_storage.count(),
            },
            "relay_addresses": {
                "all": RelayAddress.objects.count(),
                "no_server_storage": relay_addresses.count(),
                "no_server_storage_or_data": empty_relay_addresses_count,
                "no_server_storage_but_data": non_empty_relay_addresses_count,
            },
            "domain_addresses": {
                "all": DomainAddress.objects.count(),
                "no_server_storage": domain_addresses.count(),
                "no_server_storage_or_data": empty_domain_addresses_count,
                "no_server_storage_but_data": non_empty_domain_addresses_count,
            },
        }
        cleanup_data: CleanupData = {
            "relay_addresses": non_empty_relay_addresses,
            "domain_addresses": non_empty_domain_addresses,
        }
        return counts, cleanup_data

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

        def with_percent_str(part: int, whole: int) -> str:
            """Return value followed by percent of whole, like '5 (30.0%)'"""
            assert whole != 0
            return f"{part} ({part / whole:.1%})"

        def model_lines(name: str, counts: dict[str, int]) -> list[str]:
            """Get the report lines for a model (Profile, Relay Addr., Domain Addrs.)"""
            total = counts["all"]
            lines = [f"{name}:", f"  All: {total}"]
            if total == 0:
                return lines

            no_server_storage = counts["no_server_storage"]
            lines.append(
                f"  Without Server Storage: {with_percent_str(no_server_storage, total)}"
            )
            if no_server_storage == 0:
                return lines

            no_data = counts.get("no_server_storage_or_data")
            has_data = counts.get("no_server_storage_but_data")
            if no_data is None or has_data is None:
                return lines
            lines.extend(
                [
                    f"    No Data : {with_percent_str(no_data, no_server_storage)}",
                    f"    Has Data: {with_percent_str(has_data, no_server_storage)}",
                ]
            )

            cleaned = counts.get("cleaned")
            if cleaned is None:
                return lines
            lines.append(f"      Cleaned: {with_percent_str(cleaned, has_data)}")
            return lines

        lines: list[str] = (
            model_lines("Profiles", self.counts["profiles"])
            + model_lines("Relay Addresses", self.counts["relay_addresses"])
            + model_lines("Domain Addresses", self.counts["domain_addresses"])
        )

        return "\n".join(lines)
