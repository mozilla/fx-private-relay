from argparse import ArgumentParser
from csv import DictReader, DictWriter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from django.core.management.base import BaseCommand, CommandError


def normalize(url: str) -> str:
    """
    The url in data may not have // which urlparse requires to recognize the netloc
    script from:
    https://stackoverflow.com/questions/53816559/python-3-netloc-value-in-urllib-parse-is-empty-if-url-doesnt-have
    """
    if not (
        url.startswith("//") or url.startswith("http://") or url.startswith("https://")
    ):
        return "//" + url
    return url


def aggregate_by_generated_for(file_path: str) -> Path:
    aggregate_usage: dict[str, dict[str, int]] = {}
    with open(file_path, newline="") as csvfile:
        datareader = DictReader(csvfile, delimiter=",", quotechar="|")
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

        for row in datareader:
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

            # TODO: clean the domain for multiple domains in generated_for
            # separated by space, strip www, and others like stripping path
            if url:
                normalized_url = normalize(url)
                domain = urlparse(normalized_url).netloc
            else:
                domain = url

            if domain in aggregate_usage:
                aggregate_data = aggregate_usage[domain]

            aggregate_data["row_count"] = aggregate_data["row_count"] + 1
            for col in columns:
                d = 0
                try:
                    d = int(row[col])

                except ValueError as e:
                    print(e)
                    print(f"{col}: {row[col]}")
                aggregate_data[col] += d
            aggregate_usage[domain] = aggregate_data

    tmp_dir = Path(file_path).parent
    aggregate_file_path = tmp_dir.joinpath("aggregate.csv")
    with open(aggregate_file_path, "w", newline="") as csvfile:
        field_names = [
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
        writer = DictWriter(csvfile, fieldnames=field_names)

        writer.writeheader()
        for k, v in aggregate_usage.items():
            row = {"domain": k}
            row.update(v)
            writer.writerow(row)
    return aggregate_file_path


class Command(BaseCommand):
    help = (
        "Normalizes URLs in domain column and aggregates the values. "
        "Creates or updates aggregate.csv."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--path",
            type=str,
            required=True,
            help="Path to the CSV file to normalize and aggregate",
        )

    def handle(self, *args: Any, **options: Any) -> str:
        file_path: str = options.get("path", "")

        if file_path == "":
            raise CommandError(
                "Aggregate generated_for failed: File path must be entered"
            )

        aggregate_file_path = aggregate_by_generated_for(file_path)
        return f"Completed updates to {aggregate_file_path}"
