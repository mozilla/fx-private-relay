"""Framework for tasks that identify data issues and (if possible) clean them up"""

from __future__ import annotations

from typing import Any, Optional

Counts = dict[str, dict[str, int]]
CleanupData = dict[str, Any]


class DataIssueTask:
    """Base class for data issue / cleaner tasks."""

    slug: str  # Short name, appropriate for command-line option
    title: str  # Short title for reports
    check_description: str  # A sentence describing what this cleaner is checking.
    can_clean: bool  # True if the issue can be automatically cleaned

    _counts: Optional[Counts]
    _cleanup_data: Optional[CleanupData]
    _cleaned: bool

    def __init__(self):
        self._counts = None
        self._cleanup_data = None
        self._cleaned = False

    @property
    def counts(self) -> Counts:
        """Get relevant counts for data issues and prepare to clean if possible."""
        if self._counts is None:
            assert self._cleanup_data is None
            self._counts, self._cleanup_data = self._get_counts_and_data()
        return self._counts

    @property
    def cleanup_data(self) -> CleanupData:
        """Get data needed to clean data issues."""
        assert self.counts  # Populate self._cleanup_data if not populated
        assert self._cleanup_data
        return self._cleanup_data

    def issues(self) -> int:
        """Return the number of detected data issues."""
        return self.counts["summary"]["needs_cleaning"]

    def _get_counts_and_data(self) -> tuple[Counts, CleanupData]:
        """Return a dictionary of counts and cleanup data."""
        raise NotImplementedError("_get_counts_and_data() not implemented")

    def _clean(self) -> int:
        """
        Clean the detected items.

        Returns the number of cleaned items. Implementors can add detailed
        counts to self._counts as needed.
        """
        raise NotImplementedError("_clean() not implemented")

    def clean(self) -> int:
        """Clean the detected items, and update counts["summary"]"""
        summary = self.counts["summary"]
        if not self._cleaned:
            summary["cleaned"] = self._clean()
            self._cleaned = True
        return summary["cleaned"]

    def markdown_report(self) -> str:
        """Return Markdown-formatted report of issues found and (maybe) fixed."""
        raise NotImplementedError("markdown_report() not implemented")

    @staticmethod
    def _as_percent(part: int, whole: int) -> str:
        """Return value followed by percent of whole, like '5 ( 30.0%)'"""
        assert whole > 0
        len_whole = len(str(whole))
        return f"{part:{len_whole}d} ({part / whole:6.1%})"


class CleanerTask(DataIssueTask):
    """Base class for tasks that can clean up detected issues."""

    can_clean = True


class DetectorTask(DataIssueTask):
    """Base class for tasks that cannot clean up detected issues."""

    can_clean = False

    def _clean(self) -> int:
        """DetectorTask can't clean any detected issues."""
        return 0
