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
import io
import json
import logging

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from emails.management.command_from_django_settings import (
    CommandFromDjangoSettings,
    SettingToLocal,
)

logger = logging.getLogger("eventsinfo.check_health")


class Command(CommandFromDjangoSettings):
    help = "Check that a healthcheck JSON file exists and is recent."

    settings_to_locals = [
        SettingToLocal(
            "PROCESS_EMAIL_HEALTHCHECK_PATH",
            "healthcheck_path",
            "Path to file to write healthcheck data.",
            lambda healthcheck_path: healthcheck_path is not None,
        ),
        SettingToLocal(
            "PROCESS_EMAIL_HEALTHCHECK_MAX_AGE",
            "max_age",
            "Timestamp age in seconds before failure.",
            lambda max_age: max_age > 0.0,
        ),
        SettingToLocal(
            "PROCESS_EMAIL_VERBOSITY",
            "verbosity",
            "Default verbosity of the process logs",
            lambda verbosity: verbosity in range(5),
        ),
    ]

    def handle(self, verbosity, *args, **kwargs):
        """Handle call from command line (called by BaseCommand)"""
        self.init_from_settings(verbosity)
        with open(self.healthcheck_path, mode="r", encoding="utf8") as healthcheck_file:
            context = self.check_healthcheck(healthcheck_file, self.max_age)
        if context["success"]:
            if self.verbosity > 1:
                logger.info("Healthcheck passed", extra=context)
        else:
            if self.verbosity > 0:
                logger.error("Healthcheck failed", extra=context)
            raise CommandError(f"Healthcheck failed: {context['error']}")

    def check_healthcheck(self, healthcheck_file, max_age):
        """
        Read and analyze the healthcheck.

        Returns data suitable for logging context:
        * success: True if healthcheck is valid and recent, False if not
        * healthcheck_file: The open healthcheck file
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
        context = {"success": False, "healthcheck_path": healthcheck_file.name}
        try:
            data = json.load(healthcheck_file)
        except json.JSONDecodeError as e:
            context["error"] = repr(e)
            return context

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
