"""
CommandFromDjangoSettings is a base class for commands that get parameters from Django settings.
"""

from argparse import RawDescriptionHelpFormatter
from collections import namedtuple
from shutil import get_terminal_size
import textwrap

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, DjangoHelpFormatter


class RawDescriptionDjangoHelpFormatter(
    DjangoHelpFormatter, RawDescriptionHelpFormatter
):
    """DjangoHelpFormatter, but don't reflow the epilog."""

    pass


SettingToLocal = namedtuple(
    "SettingToLocal", ["setting_key", "local_name", "help_str", "validator"]
)


class CommandFromDjangoSettings(BaseCommand):
    """A Command that gets settings from Django settings."""

    def create_parser(self, prog_name, subcommand, **kwargs):
        """
        Customize the default parser.

        * Add the Django settings and their values to the command help
        * Override the verbosity from an environment variable
        """
        assert self.settings_to_locals
        epilog_lines = [
            "Parameters are read from Django settings and the related environment variable:",
            "",
        ]
        verbosity_override = None

        for setting_key, local_name, help_str, _ in self.settings_to_locals:
            raw = f"settings.{setting_key}={getattr(settings, setting_key)!r} : {help_str}"
            epilog_lines.extend(
                textwrap.wrap(
                    raw,
                    width=get_terminal_size().columns,
                    initial_indent="  ",
                    subsequent_indent="      ",
                )
            )
            if local_name == "verbosity":
                verbosity_override = getattr(settings, setting_key)
        epilog = "\n".join(epilog_lines)

        parser = super().create_parser(prog_name, subcommand, epilog=epilog, **kwargs)
        assert parser.formatter_class == DjangoHelpFormatter
        parser.formatter_class = RawDescriptionDjangoHelpFormatter
        assert verbosity_override is not None
        parser.set_defaults(verbosity=verbosity_override)
        return parser

    def init_from_settings(self, verbosity):
        """Initialize local variables from settings"""
        assert self.settings_to_locals
        for setting_key, local_name, help_str, validator in self.settings_to_locals:
            value = getattr(settings, setting_key)
            if not validator(value):
                raise CommandError(
                    f"settings.{setting_key} has invalid value {value!r}."
                )
            if local_name == "verbosity":
                # The setting overrides the default, but use the command-line value
                self.verbosity = verbosity
            else:
                setattr(self, local_name, getattr(settings, setting_key))
