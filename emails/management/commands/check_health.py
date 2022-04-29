"""
Check that a healthcheck JSON file exists and is recent.

A healthcheck file with JSON is loaded. If the timestamp (a string, formated
like Python's datetime.isoformat) is too far in the past, it exits with a
non-zero exit code. This makes it suitable for Kubernetes liveness checks of
processes without a webservice.

See:
https://docs.python.org/3/library/datetime.html#datetime.datetime.isoformat
https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
"""

from argparse import FileType
from datetime import datetime, timezone
import json
import logging

from django.core.management.base import BaseCommand, CommandError

logger = logging.getLogger("eventsinfo.check_health")


class Command(BaseCommand):
    help = "Check that a healthcheck JSON file exists and is recent."

    DEFAULT_MAX_AGE_SECONDS = 120

    def add_arguments(self, parser):
        """Add command-line arguments (called by BaseCommand)"""
        parser.add_argument(
            "healthcheck_path",
            type=FileType("r", encoding="utf8"),
            help="Path to healthcheck JSON file",
        )
        parser.add_argument(
            "--max-age",
            type=int,
            default=self.DEFAULT_MAX_AGE_SECONDS,
            help=f"Timestamp age in seconds before failure, default {self.DEFAULT_MAX_AGE_SECONDS}",
        )

    def handle(self, healthcheck_path, max_age, verbosity, *args, **kwargs):
        """Handle call from command line (called by BaseCommand)"""
        context = self.check_healthcheck(healthcheck_path, max_age)
        if context["success"]:
            if verbosity > 1:
                logger.info("Healthcheck passed", extra=context)
        else:
            if verbosity > 0:
                logger.error("Healthcheck failed", extra=context)
            raise CommandError(f"Healthcheck failed: {context['error']}")

    def check_healthcheck(self, healthcheck_path, max_age):
        """
        Read and analyze the healthcheck.

        Returns data suitable for logging context:
        * success: True if healthcheck is valid and recent, False if not
        * healthcheck_path: The healthcheck path tested
        * error: If failed, the failure detail, else omitted
        * data: The healthcheck data, or omitted if non-JSON
        * age_s: The timestamp age in seconds, millisecond precision, if found

        Raises exceptions (which are also failures) if:
        * The healthcheck file doesn't exist
        * The healthcheck file doesn't contain JSON
        * The JSON doesn't have a "timestamp" field
        * The timestamp doesn't match the format of datetime.toisoformat()
        * The timestamp doesn't include timezone data
        """
        context = {"success": False, "healthcheck_path": healthcheck_path.name}
        data = json.load(healthcheck_path)

        context["data"] = data
        raw_timestamp = data["timestamp"]
        timestamp = datetime.fromisoformat(raw_timestamp)
        age = (datetime.now(tz=timezone.utc) - timestamp).total_seconds()

        context["age_s"] = round(age, 3)
        if age > max_age:
            context["error"] = "Timestamp is too old"
        else:
            context["success"] = True
        return context
