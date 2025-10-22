from __future__ import annotations

import logging
import textwrap
from argparse import RawDescriptionHelpFormatter
from shutil import get_terminal_size
from typing import TYPE_CHECKING, Any

from django.core.management.base import BaseCommand, DjangoHelpFormatter
from django.db import transaction

from codetiming import Timer

from emails.cleaners import MissingProfileCleaner, ServerStorageCleaner
from privaterelay.cleaners import MissingEmailCleaner

if TYPE_CHECKING:  # pragma: no cover
    from argparse import ArgumentParser

    from privaterelay.cleaner_task import DataIssueTask


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
        MissingEmailCleaner,
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
        if not parser.formatter_class == DjangoHelpFormatter:
            raise TypeError("parser.formatter_class must be type DjangoHelpFormatter")
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

    def handle(self, clean: bool, verbosity: int, *args: Any, **kwargs: Any) -> str:
        """Run the cleanup_data command."""

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
        issue_count = 0
        clean_count = 0
        issue_timers: dict[str, float] = {}
        clean_timers: dict[str, float] = {}
        for slug, task in tasks.items():
            with transaction.atomic():
                task_issues, task_time = self.find_issues_in_task(task)
                issue_count += task_issues
                issue_timers[slug] = task_time

                if clean:
                    task_cleaned, clean_time = self.clean_issues_in_task(task)
                    if task_cleaned is not None and clean_time is not None:
                        clean_count += task_cleaned
                        clean_timers[slug] = clean_time

        # Log results and create a report, based on requested verbosity
        if clean:
            log_message = (
                f"cleanup_data complete, cleaned {clean_count} of"
                f" {issue_count} issue{'' if issue_count==1 else 's'}."
            )
        else:
            log_message = (
                f"cleanup_data complete, found {issue_count}"
                f" issue{'' if issue_count==1 else 's'} (dry run)."
            )

        full_data, log_data = self.prepare_data(
            clean, verbosity, tasks, issue_timers, clean_timers=clean_timers
        )
        logger.info(log_message, extra=log_data)
        report = self.get_report(log_message, full_data)
        return report

    def find_issues_in_task(self, task: DataIssueTask) -> tuple[int, float]:
        """Run a task, returning the number of issues and execution time."""
        with Timer(logger=None) as issue_timer:
            total = task.issues()
        return total, round(issue_timer.last, 3)

    def clean_issues_in_task(
        self, task: DataIssueTask
    ) -> tuple[int, float] | tuple[None, None]:
        """Run the task cleaner, returning issues cleaned and execution time."""
        if not hasattr(task, "clean"):
            return (None, None)
        with Timer(logger=None) as clean_timer:
            cleaned = task.clean()
        return cleaned, round(clean_timer.last, 3)

    def prepare_data(
        self,
        cleaned: bool,
        verbosity: int,
        tasks: dict[str, DataIssueTask],
        issue_timers: dict[str, float],
        clean_timers: dict[str, float],
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
            "cleaned": cleaned,
            "timers": timers,
            "tasks": full_details,
        }

        log_data = {
            "cleaned": cleaned,
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
            detail.append(
                f"Detected {needs_cleaning} issue{'' if needs_cleaning == 1 else 's'}"
                f" in {query_timer} seconds."
            )
            if cleaned:
                if task["can_clean"]:
                    detail.append(
                        f"Cleaned {num_cleaned} issue{'' if num_cleaned == 1 else 's'}"
                        f" in {clean_timer} seconds."
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
