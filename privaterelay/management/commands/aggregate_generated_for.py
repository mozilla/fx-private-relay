import re
from argparse import ArgumentParser
from collections.abc import Iterable
from csv import DictReader, DictWriter
from datetime import timedelta
from io import TextIOBase
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from emails.models import RelayAddress

FIELD_NAMES = [
    "domain",
    "rank",
    "count",
    "row_count",
    "total_usage",
    "ratio_usage",
    "total_forwarded",
    "ratio_forwarded",
    "total_blocked",
    "ratio_blocked",
    "total_level_one_trackers_blocked",
    "ratio_level_one_trackers_blocked",
    "total_replied",
    "ratio_replied",
    "total_spam",
    "ratio_spam",
]
# A dotted hostname. API callers can set generated_for to any text, and the
# output goes to a spreadsheet and to agents. Requiring a hostname keeps out
# formulas like =IMPORTXML(...), prompt text, and labels like
# "account registration" or "localhost" that QA cannot test. No port, because
# Firefox matches the Relay allow and deny lists against hosts without ports.
HOSTNAME_RE = re.compile(r"[a-z0-9-]+(\.[a-z0-9-]+)+", re.IGNORECASE)


def normalize(url: str) -> str:
    """
    The url in data may not have // which urlparse requires to recognize the netloc
    script from:
    https://stackoverflow.com/questions/53816559/python-3-netloc-value-in-urllib-parse-is-empty-if-url-doesnt-have
    """
    if not (url.startswith("//") or "://" in url):
        return "//" + url
    return url


def aggregate_by_generated_for(
    file_path: str, data: Iterable[dict[str, Any]]
) -> dict[str, dict[str, int]]:
    aggregate_usage: dict[str, dict[str, int]] = {}
    columns = [
        "count",  # Number of masks with the generated_for
        "total_usage",  # Sum of emails forwarded, emails blocked,
        # trackers blocked in emails, emails replied, and spam blocked
        "total_forwarded",  # Total emails forwarded to masks
        "total_blocked",  # Total emails blocked for masks
        "total_level_one_trackers_blocked",  # Total number of trackers
        # blocked in emails forwarded to masks
        "total_replied",  # Total number of emails replied to masks
        "total_spam",  # Total number of spam
    ]

    for row in data:
        aggregate_data: dict[str, int] = {
            "count": 0,
            "row_count": 0,
            "total_usage": 0,
            "total_forwarded": 0,
            "total_blocked": 0,
            "total_level_one_trackers_blocked": 0,
            "total_replied": 0,
            "total_spam": 0,
        }
        url = row["generated_for"]

        # TODO: good candidate for a unit-tested function
        # clean the domain for multiple domains in generated_for
        # separated by space, strip www, and others like stripping path
        if url:
            parsed_url = urlparse(normalize(url))
            # Skip Android apps (androidapp://) and extension pages
            # (moz-extension://), which QA cannot test as websites.
            if parsed_url.scheme not in ("", "http", "https"):
                continue
            domain = parsed_url.netloc
        else:
            domain = url

        if domain in aggregate_usage:
            aggregate_data = aggregate_usage[domain]

        aggregate_data["row_count"] = aggregate_data["row_count"] + 1
        for col in columns:
            d = int(row[col])
            aggregate_data[col] += d
        aggregate_usage[domain] = aggregate_data
    return aggregate_usage


def query_generated_for(days: int) -> list[dict[str, Any]]:
    """
    Sum mask usage per generated_for value for random masks created in the last
    `days` days. Custom (domain) masks have no generated_for, so they are skipped.
    """
    since = timezone.now() - timedelta(days=days)
    rows = (
        RelayAddress.objects.filter(created_at__gt=since)
        # Matches the partial index on generated_for, and skips the millions of
        # masks made outside the add-on and Firefox, which have no value.
        .exclude(generated_for="")
        .values("generated_for")
        .annotate(
            count=Count("id"),
            total_forwarded=Coalesce(Sum("num_forwarded"), 0),
            total_blocked=Coalesce(Sum("num_blocked"), 0),
            total_level_one_trackers_blocked=Coalesce(
                Sum("num_level_one_trackers_blocked"), 0
            ),
            total_replied=Coalesce(Sum("num_replied"), 0),
            total_spam=Coalesce(Sum("num_spam"), 0),
        )
    )
    with transaction.atomic():
        if connection.vendor == "postgresql":
            # This runs against the production primary. Guard against writes.
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")
        data: list[dict[str, Any]] = [dict(row) for row in rows]
    for row in data:
        row["total_usage"] = (
            row["total_forwarded"]
            + row["total_blocked"]
            + row["total_level_one_trackers_blocked"]
            + row["total_replied"]
            + row["total_spam"]
        )
    return data


def is_hostname(domain: str) -> bool:
    # Check the exact string we output. Browsers send IDNs as punycode, and
    # prod data has no non-ASCII domains, so ASCII-only loses nothing real.
    return domain.isascii() and bool(HOSTNAME_RE.fullmatch(domain))


def rank_domains(
    aggregate_usage: dict[str, dict[str, int]], limit: int | None = None
) -> list[dict[str, Any]]:
    """Rank domains by mask count, then usage. Drop values that are not hostnames."""
    ranked: list[dict[str, Any]] = [
        {"domain": domain, **values}
        for domain, values in aggregate_usage.items()
        if is_hostname(domain)
    ]
    ranked.sort(key=lambda row: (-row["count"], -row["total_usage"]))
    ranked = ranked[:limit]
    for rank, row in enumerate(ranked, start=1):
        row["rank"] = rank
    return ranked


def write_csv(csvfile: TextIOBase, ranked: list[dict[str, Any]]) -> None:
    writer = DictWriter(csvfile, fieldnames=FIELD_NAMES)
    writer.writeheader()
    writer.writerows(ranked)


def generate_csv_file(file_path: str, ranked: list[dict[str, Any]]) -> Path:
    aggregate_file_path = Path(file_path).parent.joinpath("aggregate.csv")
    with open(aggregate_file_path, "w", newline="") as csvfile:
        write_csv(csvfile, ranked)
    return aggregate_file_path


class Command(BaseCommand):
    help = (
        "Normalizes generated_for URLs to domains, aggregates mask usage, and ranks "
        "the domains for mask acceptance testing. Reads a CSV file with --path and "
        "writes aggregate.csv beside it, or queries the database with --from-db and "
        "writes CSV to stdout. See .agents/skills/relay-top-sites/SKILL.md."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        source = parser.add_mutually_exclusive_group(required=True)
        source.add_argument(
            "--path",
            type=str,
            help="Path to the CSV file to normalize and aggregate",
        )
        source.add_argument(
            "--from-db",
            action="store_true",
            help="Query random masks in the database instead of reading a CSV file",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="With --from-db, include masks created in the last N days",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Only output the top N domains",
        )

    def handle(self, *args: Any, **options: Any) -> str:
        limit: int | None = options.get("limit")

        if options.get("from_db"):
            data = query_generated_for(options["days"])
            ranked = rank_domains(aggregate_by_generated_for("", data), limit)
            write_csv(self.stdout, ranked)
            return ""

        file_path: str = options.get("path") or ""
        if file_path == "":
            raise CommandError(
                "Aggregate generated_for failed: File path must be entered"
            )

        with open(file_path, newline="") as csvfile:
            datareader = DictReader(csvfile, delimiter=",", quotechar="|")
            aggregate_usage = aggregate_by_generated_for(file_path, datareader)
            ranked = rank_domains(aggregate_usage, limit)
            aggregate_file_path = generate_csv_file(file_path, ranked)
        return f"Completed updates to {aggregate_file_path}"
