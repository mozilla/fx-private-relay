"""Tests for the email worker's Postgres statement_timeout. See MPP-4723.

These live apart from mgmt_process_emails_from_sqs_tests.py because that module
mocks django.db.connection for every test. The behavior here needs a real
database connection, so a slow query is actually canceled.
"""

from unittest.mock import Mock

from django.db import OperationalError, connection

import pytest
from pytest_django.fixtures import SettingsWrapper

from emails.management.commands.process_emails_from_sqs import (
    set_worker_statement_timeout,
)


@pytest.mark.django_db(transaction=True)
def test_statement_timeout_cancels_slow_query(settings: SettingsWrapper) -> None:
    """A query that runs past statement_timeout is canceled by the database.

    Skipped on non-PostgreSQL backends, where the worker sets no timeout.
    """
    if connection.vendor != "postgresql":
        pytest.skip("statement_timeout is a PostgreSQL feature")

    settings.PROCESS_EMAIL_STATEMENT_TIMEOUT_SECONDS = 0.1
    set_worker_statement_timeout(connection)

    try:
        with pytest.raises(OperationalError, match="statement timeout"):
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_sleep(1)")
    finally:
        # Clear the session timeout so it does not affect test teardown.
        with connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = 0")


def test_statement_timeout_skips_non_postgresql() -> None:
    """On non-PostgreSQL backends (e.g. SQLite), no timeout is set."""
    conn = Mock(spec_set=["vendor", "cursor"])
    conn.vendor = "sqlite"

    set_worker_statement_timeout(conn)

    conn.cursor.assert_not_called()
