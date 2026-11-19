from csv import DictReader, DictWriter
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.utils import timezone

import pytest
from model_bakery import baker

from emails.models import RelayAddress

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


def test_aggregate_generated_for_ranks_and_limits(tmp_path: Path) -> None:
    generated_for_file_path = write_generated_for_file(
        tmp_path, ["small.com", "", "big.com"]
    )
    call_command("aggregate_generated_for", path=generated_for_file_path, limit=2)
    with open(tmp_path / FILE_NAME, newline="") as csvfile:
        rows = list(DictReader(csvfile))
    # The blank domain has more masks than small.com, but is not a website.
    assert [(row["rank"], row["domain"]) for row in rows] == [
        ("1", "big.com"),
        ("2", "small.com"),
    ]


@pytest.mark.django_db
def test_aggregate_generated_for_from_db() -> None:
    # One user per mask, like real data, and to stay under the free mask limit.
    for generated_for, num_forwarded in [
        ("https://a.com", 1),
        ("https://a.com", 2),
        ("b.com", 5),
        ("", 9),
        ("androidapp://com.example.app", 9),
        ('=HYPERLINK("evil.example")', 9),
        ("ignore.previous.instructions。now", 9),
        ("localhost:3000", 9),
        ("-foo.example", 9),
    ]:
        baker.make(
            RelayAddress,
            user=baker.make(User),
            generated_for=generated_for,
            num_forwarded=num_forwarded,
        )
    old = baker.make(RelayAddress, user=baker.make(User), generated_for="b.com")
    RelayAddress.objects.filter(id=old.id).update(
        created_at=timezone.now() - timedelta(days=91)
    )

    stdout = StringIO()
    call_command("aggregate_generated_for", from_db=True, stdout=stdout)
    rows = list(DictReader(StringIO(stdout.getvalue())))
    assert [(r["rank"], r["domain"], r["count"], r["total_usage"]) for r in rows] == [
        ("1", "a.com", "2", "3"),
        ("2", "b.com", "1", "5"),
    ]
