from csv import DictReader, DictWriter
from pathlib import Path

from django.core.management import CommandError, call_command

import pytest

COMMAND_NAME = "aggregate_generated_for"
SAME_DOMAINS = ["test.com"] * 3
ACCEPTED_DOMAIN_VARIATIONS = ["test.com", "//test.com", "https://test.com"]
WWW_DOMAIN_VARIATIONS = ["www.test.com", "//www.test.com", "https://www.test.com"]
FILE_NAME = "aggregate.csv"
RAW_FIELD_NAMES = [
    "generated_for",
    "count",
    "total_usage",
    "total_forwarded",
    "total_blocked",
    "total_level_one_trackers_blocked",
    "total_replied",
    "total_spam",
]
ADDITIONAL_FIELD_NAMES = [
    "domain",
    "rank",
    "row_count",
    "ratio_usage",
    "ratio_forwarded",
    "ratio_blocked",
    "ratio_level_one_trackers_blocked",
    "ratio_replied",
    "ratio_spam",
]


def write_generated_for_file(temp_path: Path, variable_domains: list[str]) -> Path:
    generated_for_file_path = temp_path / "generated_for.csv"
    with open(generated_for_file_path, "w", newline="") as csvfile:
        writer = DictWriter(csvfile, fieldnames=RAW_FIELD_NAMES)
        writer.writeheader()

        row_num = 1
        while row_num < 4:
            domain = variable_domains[row_num - 1]
            row: dict[str, str | int] = {
                "generated_for": domain,
                "count": row_num,
                "total_usage": row_num,
                "total_forwarded": row_num,
                "total_blocked": row_num,
                "total_level_one_trackers_blocked": row_num,
                "total_replied": row_num,
                "total_spam": row_num,
            }
            writer.writerow(row)
            row_num += 1
    return generated_for_file_path


def test_aggregate_generated_for_requires_path() -> None:
    """check health succeeds when the timestamp is recent."""
    with pytest.raises(CommandError) as excinfo:
        call_command("aggregate_generated_for", path="")
    assert str(excinfo.value) == (
        "Aggregate generated_for failed: File path must be entered"
    )


def test_aggregate_generated_for_aggregate_data(tmp_path: Path) -> None:
    generated_for_file_path = write_generated_for_file(tmp_path, SAME_DOMAINS)
    call_command("aggregate_generated_for", path=generated_for_file_path)
    with open(tmp_path / FILE_NAME, newline="") as csvfile:
        datareader = DictReader(csvfile, delimiter=",", quotechar="|")
        for row in datareader:
            for field in RAW_FIELD_NAMES:
                if field == "generated_for":
                    # this field is replaced for domain in aggregate CSV
                    continue
                assert row[field] == "6"
            for field in ADDITIONAL_FIELD_NAMES:
                if field == "domain":
                    assert row["domain"] == "test.com"
                    continue
                if field == "row_count":
                    assert row["row_count"] == "3"
                    continue
                assert row[field] == ""


def test_aggregate_generated_for_normalize_domains_and_aggregate_data(
    tmp_path: Path,
) -> None:
    generated_for_file_path = write_generated_for_file(
        tmp_path, ACCEPTED_DOMAIN_VARIATIONS
    )
    call_command("aggregate_generated_for", path=generated_for_file_path)
    with open(tmp_path / FILE_NAME, newline="") as csvfile:
        datareader = DictReader(csvfile, delimiter=",", quotechar="|")
        for row in datareader:
            for field in RAW_FIELD_NAMES:
                if field == "generated_for":
                    # this field is replaced for domain in aggregate CSV
                    continue
                assert row[field] == "6"
            for field in ADDITIONAL_FIELD_NAMES:
                if field == "domain":
                    assert row["domain"] == "test.com"
                    continue
                if field == "row_count":
                    assert row["row_count"] == "3"
                    continue
                assert row[field] == ""


def test_aggregate_generated_for_does_not_strip_www(tmp_path: Path) -> None:
    generated_for_file_path = write_generated_for_file(tmp_path, WWW_DOMAIN_VARIATIONS)
    call_command("aggregate_generated_for", path=generated_for_file_path)
    with open(tmp_path / FILE_NAME, newline="") as csvfile:
        datareader = DictReader(csvfile, delimiter=",", quotechar="|")
        for row in datareader:
            for field in RAW_FIELD_NAMES:
                if field == "generated_for":
                    # this field is replaced for domain in aggregate CSV
                    continue
                assert row[field] == "6"
            for field in ADDITIONAL_FIELD_NAMES:
                if field == "domain":
                    assert row["domain"] == "www.test.com"
                    continue
                if field == "row_count":
                    assert row["row_count"] == "3"
                    continue
                assert row[field] == ""
