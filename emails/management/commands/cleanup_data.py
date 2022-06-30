from __future__ import annotations
from typing import Optional, TYPE_CHECKING
import json
import logging

from django.db.models import Q
from django.core.management.base import BaseCommand

from codetiming import Timer

from emails.models import DomainAddress, Profile, RelayAddress

if TYPE_CHECKING: # pragma: no cover
    from argparse import ArgumentParser
    from django.db.models import QuerySet


logger = logging.getLogger("eventsinfo.process_emails_from_sqs")
_CountDict = dict[str, dict[str, int]]


class Command(BaseCommand):
    help = (
        "Clears description, generated_for, and used_on data of all addresses that"
        " belong to a Profile with server_storage set to False."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--clear", action="store_true", help="Clear data")

    def handle(self, *args, **kwargs) -> str:
        to_clear = kwargs["clear"]
        if not to_clear:
            self.stdout.write("Dry run. Use --clear to clear server-stored data.")

        with Timer(logger=None) as query_timer:
            counts, relay_addresses, domain_addresses = self.get_data()
        timers = {"query_s": round(query_timer.last, 3)}

        if to_clear:
            with Timer(logger=None) as clear_timer:
                counts["relay_addresses"]["cleared"] = relay_addresses.update(
                    description="", generated_for="", used_on=""
                )
                counts["domain_addresses"]["cleared"] = domain_addresses.update(
                    description="", used_on=""
                )
            timers["clear_s"] = round(clear_timer.last, 3)
            count = (
                counts["relay_addresses"]["cleared"]
                + counts["domain_addresses"]["cleared"]
            )
            log_message = f"cleanup_data complete, cleaned {count} record{'' if count==1 else 's'}."
        else:
            log_message = "cleanup_data complete (dry run)."

        data = {
            "cleared": to_clear,
            "counts": counts,
            "timers": timers
        }
        logger.info(log_message, extra=data)

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
        blank_used_on = Q(used_on="") | Q(used_on__isnull=True)
        blank_relay_data = blank_used_on & Q(description="") & Q(generated_for="")
        blank_domain_data = blank_used_on & Q(description="")

        empty_relay_addresses = relay_addresses.filter(blank_relay_data)
        empty_domain_addresses = domain_addresses.filter(blank_domain_data)
        non_empty_relay_addresses = relay_addresses.exclude(blank_relay_data)
        non_empty_domain_addresses = domain_addresses.exclude(blank_domain_data)

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
