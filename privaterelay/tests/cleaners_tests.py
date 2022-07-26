"""Tests for privaterelay/cleaners.py (shared functionality)"""
import pytest

from privaterelay.cleaners import DataIssueTask


def test_data_issue_task_not_implemented():
    """Functions in the base tasks are not implemented."""
    task = DataIssueTask()

    with pytest.raises(NotImplementedError):
        task.issues()

    with pytest.raises(NotImplementedError):
        # To test _clean, call directly, since .clean() calls .counts first
        task._clean()

    with pytest.raises(NotImplementedError):
        task.markdown_report()
