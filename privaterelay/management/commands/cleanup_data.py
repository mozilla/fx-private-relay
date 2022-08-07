from __future__ import annotations
from argparse import RawDescriptionHelpFormatter
from shutil import get_terminal_size
from typing import Any, Optional, TYPE_CHECKING

import textwrap
import logging

from django.core.management.base import BaseCommand, DjangoHelpFormatter

from codetiming import Timer

from emails.cleaners import (
    ServerStorageCleaner,
    MissingProfileCleaner,
    ManyProfileDetector,
)


if TYPE_CHECKING:  # pragma: no cover
    from argparse import ArgumentParser
    from privaterelay.cleaners import DataIssueTask


logger = logging.getLogger("eventsinfo.cleanup_data")


class RawDescriptionDjangoHelpFormatter(
    DjangoHelpFormatter, RawDescriptionHelpFormatter
):
    """DjangoHelpFormatter, but don't reflow the epilog."""


class Command(BaseCommand):
    help = "Detects and optionally clean data issues."
    task_list: list[type[DataIssueTask]] = [
        ServerStorageCleaner,
        MissingProfileCleaner,
        ManyProfileDetector,
    ]
    tasks: dict[str, DataIssueTask]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        tasks = {Task.slug: Task() for Task in self.task_list}
        self.tasks = {slug: tasks[slug] for slug in sorted(tasks.keys())}

    def create_parser(self, prog_name, subcommand, **kwargs):
        """Add DataIssueTask information to default parser."""

        epilog_lines = ["Data issue detectors / cleaners:"]
        for slug, task in self.tasks.items():
            raw = f"{slug} - {task.title}"
            epilog_lines.extend(
                textwrap.wrap(
                    raw,
                    width=get_terminal_size().columns,
                    initial_indent="  ",
                    subsequent_indent="      ",
                )
            )
        epilog = "\n".join(epilog_lines)

        parser = super().create_parser(prog_name, subcommand, epilog=epilog, **kwargs)
        assert parser.formatter_class == DjangoHelpFormatter
        parser.formatter_class = RawDescriptionDjangoHelpFormatter
        return parser

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--clean", action="store_true", help="Clean detected data issues."
        )
        for slug, task in self.tasks.items():
            parser.add_argument(
                f"--{slug}",
                action="store_true",
                help=f"Only run {slug} {'cleaner' if task.can_clean else 'detector'}",
            )

    def handle(self, *args, **kwargs) -> str:
        """Run the cleanup_data command."""

        # Parse command line options
        to_clean = kwargs["clean"]
        verbosity = kwargs["verbosity"]

        # Determine if we're running some tasks or the full set
        run_some: list[str] = []
        for name, val in kwargs.items():
            slug = name.replace("_", "-")
            if slug in self.tasks and val:
                run_some.append(slug)
        if run_some:
            tasks = {slug: self.tasks[slug] for slug in sorted(run_some)}
        else:
            tasks = self.tasks

        # Find data issues and clean them if requested
        issue_count, issue_timers = self.find_issues(tasks)
        if to_clean:
            clean_count, clean_timers = self.clean_issues(tasks)
            log_message = (
                f"cleanup_data complete, cleaned {clean_count} of"
                f" {issue_count} issue{'' if issue_count==1 else 's'}."
            )
        else:
            clean_timers = None
            log_message = (
                f"cleanup_data complete, found {issue_count}"
                f" issue{'' if issue_count==1 else 's'} (dry run)."
            )

        # Log results and create a report, based on requested verbosity
        full_data, log_data = self.prepare_data(
            to_clean, verbosity, tasks, issue_timers, clean_timers=clean_timers
        )
        logger.info(log_message, extra=log_data)
        report = self.get_report(log_message, full_data)
        return report

    def find_issues(
        self, tasks: dict[str, DataIssueTask]
    ) -> tuple[int, dict[str, float]]:
        """Run each task and accumulate the total detected issues."""
        total = 0
        timers: dict[str, float] = {}
        for slug, task in tasks.items():
            with Timer(logger=None) as issue_timer:
                total += task.issues()
            timers[slug] = round(issue_timer.last, 3)
        return total, timers

    def clean_issues(
        self, tasks: dict[str, DataIssueTask]
    ) -> tuple[int, dict[str, float]]:
        """Clean detected issues, if the task supports cleaning."""
        total = 0
        timers: dict[str, float] = {}
        for slug, task in tasks.items():
            with Timer(logger=None) as clean_timer:
                total += task.clean()
            timers[slug] = round(clean_timer.last, 3)
        return total, timers

    def prepare_data(
        self,
        to_clean: bool,
        verbosity: int,
        tasks: dict[str, DataIssueTask],
        issue_timers: dict[str, float],
        clean_timers: Optional[dict[str, float]],
    ) -> tuple[dict, dict]:
        """Gather full data and log data from tasks and timers."""

        timers = {"query_s": sum(issue_timers.values())}
        if clean_timers:
            timers["clean_s"] = sum(clean_timers.values())

        log_details = {}
        full_details = {}
        for slug, task in tasks.items():
            timers = {"query_s": issue_timers[slug]}
            if clean_timers:
                timers["clean_s"] = clean_timers[slug]

            full_details[slug] = {
                "title": task.title,
                "check_description": task.check_description,
                "can_clean": task.can_clean,
                "counts": task.counts,
                "markdown_report": task.markdown_report(),
                "timers": timers,
            }

            if verbosity > 1:
                log_details[slug] = {"counts": task.counts, "timers": timers}
            elif verbosity > 0:
                log_details[slug] = {"counts": {"summary": task.counts["summary"]}}

        full_data = {
            "verbosity": verbosity,
            "cleaned": to_clean,
            "timers": timers,
            "tasks": full_details,
        }

        log_data = {
            "cleaned": to_clean,
            "timers": timers,
        }
        if log_details:
            log_data["tasks"] = log_details

        return full_data, log_data

    def get_report(self, log_message: str, data: dict) -> str:
        """Generate a human-readable report."""

        verbosity: int = data["verbosity"]
        cleaned: bool = data["cleaned"]
        tasks: dict[str, dict[str, Any]] = data["tasks"]

        # Collect task details
        details: list[str] = []
        sum_all_rows: list[tuple[str, ...]] = []
        totals: list[float] = [0, 0, 0.0, 0.0]
        for slug, task in tasks.items():
            # Gather data and types
            summary: dict[str, int] = task["counts"]["summary"]
            needs_cleaning = summary["needs_cleaning"]
            num_cleaned = summary.get("cleaned", 0)

            task_timers: dict[str, float] = task["timers"]
            query_timer = task_timers["query_s"]
            clean_timer = task_timers.get("clean_s", 0.0)

            # Collect summary data
            sum_all_rows.append(
                (
                    slug,
                    str(needs_cleaning),
                    str(num_cleaned),
                    format(query_timer, "0.3f"),
                    format(clean_timer, "0.3f"),
                )
            )
            totals[0] += needs_cleaning
            totals[1] += num_cleaned
            totals[2] += query_timer
            totals[3] += clean_timer

            # Details are omitted on low verbosity
            if verbosity <= 1:
                continue

            # Collect detail section data
            detail = [f"## {slug}"]
            detail.extend(textwrap.wrap(task["check_description"], width=80))
            detail.append("")
            detail.append(f"Detected {needs_cleaning} issues in {query_timer} seconds.")
            if cleaned:
                if task["can_clean"]:
                    detail.append(
                        f"Cleaned {num_cleaned} issues in {clean_timer} seconds."
                    )
                elif needs_cleaning:
                    detail.append("Unable to automatically clean detected items.")
            detail.append("")
            detail.append(task["markdown_report"])
            details.append("\n".join(detail))

        report = ["", "# Summary"]
        if not cleaned:
            report.append("Detected issues only. Use --clean to fix issues.")
        report.append("")

        # Pick summary table columns
        if cleaned:
            columns = ["task", "issues", "fixed", "query (s)", "fix (s)"]
            sum_rows: list[tuple[str, ...]] = sum_all_rows[:]
            sum_rows.append(
                (
                    "_Total_",
                    str(totals[0]),
                    str(totals[1]),
                    format(totals[2], "0.3f"),
                    format(totals[3], "0.3f"),
                )
            )
        else:
            columns = ["task", "issues", "query (s)"]
            sum_rows = [(row[0], row[1], row[3]) for row in sum_all_rows]
            sum_rows.append(("_Total_", str(totals[0]), format(totals[2], "0.3f")))

        # Determine summary table widths
        widths = [len(col) for col in columns]
        for row in sum_rows:
            for column, value in enumerate(row):
                widths[column] = max(widths[column], len(value))

        # Output summary table with aligned columns
        header = (
            "|"
            + "|".join(f"{col:^{widths[colnum]}}" for colnum, col in enumerate(columns))
            + "|"
        )
        sep = (
            "|"
            + "|".join(
                f"{'-' * (widths[colnum] - 1)}:" for colnum, _ in enumerate(columns)
            )
            + "|"
        )
        report.extend([header, sep])
        for row in sum_rows:
            row_report = (
                "|"
                + "|".join(f"{col:>{widths[colnum]}}" for colnum, col in enumerate(row))
                + "|"
            )
            report.append(row_report)

        # Output details
        if verbosity > 1:
            report.extend(["", "# Details"])
            for detail_block in details:
                report.extend([detail_block, ""])

        return "\n".join(report)
