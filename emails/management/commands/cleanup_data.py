from __future__ import annotations
from typing import TYPE_CHECKING
import json

from django.db.models import Q
from django.core.management.base import BaseCommand

from emails.models import DomainAddress, Profile, RelayAddress

if TYPE_CHECKING:
    from argparse import ArgumentParser
    from django.db.models import QuerySet


_CountDict = dict[str, dict[str, int]]


class Command(BaseCommand):
    help = (
        "Clears description, generated_for, and used_on data of all addresses that"
        " belong to a Profile with server_storage set to False."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--clear", action="store_true", help="Clear data")
        parser.add_argument("--json", action="store_true", help="Output as JSON")

    def handle(self, *args, **kwargs) -> str:
        to_clear = kwargs["clear"]
        as_json = kwargs["json"]
        if not to_clear and not as_json:
            self.stdout.write("Dry run. Use --clear to clear server-stored data.")

        counts, relay_addresses, domain_addresses = self.get_data()

        if to_clear:
            counts["relay_addresses"]["cleared"] = relay_addresses.update(
                description="", generated_for="", used_on=""
            )
            counts["domain_addresses"]["cleared"] = domain_addresses.update(
                description="", used_on=""
            )

        if as_json:
            output = {"cleared": to_clear}
            output.update(counts)
            return json.dumps(output, indent=2)
        else:
            return self.get_report(to_clear, counts)

    def get_data(
        self,
    ) -> tuple[_CountDict, QuerySet[RelayAddress], QuerySet[DomainAddress]]:
        profiles_without_server_storage = Profile.objects.filter(server_storage=False)
        relay_addresses = RelayAddress.objects.filter(
            user__profile__server_storage=False
        )
        domain_addresses = DomainAddress.objects.filter(
            user__profile__server_storage=False
        )
        blank_relay_data = Q(description="", generated_for="", used_on="")
        blank_domain_data = Q(description="", used_on="")

        empty_relay_addresses = relay_addresses.filter(blank_relay_data)
        empty_domain_addresses = relay_addresses.filter(blank_domain_data)
        non_empty_relay_addresses = relay_addresses.filter(~blank_relay_data)
        non_empty_domain_addresses = domain_addresses.filter(~blank_domain_data)

        counts = {
            "profiles": {
                "total": Profile.objects.count(),
                "no_server_storage": profiles_without_server_storage.count(),
            },
            "relay_addresses": {
                "total": RelayAddress.objects.count(),
                "no_server_storage": relay_addresses.count(),
                "no_server_storage_or_data": empty_relay_addresses.count(),
                "no_server_storage_but_data": non_empty_relay_addresses.count(),
            },
            "domain_addresses": {
                "total": DomainAddress.objects.count(),
                "no_server_storage": domain_addresses.count(),
                "no_server_storage_or_data": empty_domain_addresses.count(),
                "no_server_storage_but_data": non_empty_domain_addresses.count(),
            },
        }
        return counts, non_empty_relay_addresses, non_empty_domain_addresses

    def get_report(self, to_clear: bool, counts: _CountDict) -> str:
        """Generate a human-readable report."""

        def with_percent_str(part: int, whole: int) -> str:
            """Return value followed by percent of whole, like '5 (30.0%)'"""
            assert whole != 0
            return f"{part} ({part / whole:.1%})"

        def model_lines(name: str, counts: dict[str, int]) -> list[str]:
            """Get the report lines for a model (Profile, Relay Addresses, etc.)"""
            total = counts["total"]
            lines = [f"{name}:", f"  Total: {total}"]
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

            cleared = counts.get("cleared")
            if cleared is None:
                return lines
            lines.append(f"      Cleared: {with_percent_str(cleared, has_data)}")
            return lines

        lines: list[str] = (
            model_lines("Profiles", counts["profiles"])
            + model_lines("Relay Addresses", counts["relay_addresses"])
            + model_lines("Domain Addresses", counts["domain_addresses"])
        )

        return "\n".join(lines)
