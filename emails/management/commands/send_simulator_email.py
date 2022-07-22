"""
Send an email from a Relay user to an AWS SES Simulator mailbox.

The AWS SES Simulator mailboxes have automated responses, documented at:
https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html
"""
from __future__ import annotations
import logging
from dataclasses import asdict
from typing import TYPE_CHECKING, Any, Optional, Union, cast

from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand, CommandError

from emails.ses import (
    SimulatorScenario,
    get_simulator_email_address,
    send_simulator_email,
)
from emails.views import _get_address

if TYPE_CHECKING:  # pragma: nocover
    from argparse import ArgumentParser
    from emails.models import RelayAddress, DomainAddress


logger = logging.getLogger("eventsinfo.send_simulator_email")


class Command(BaseCommand):
    help = (
        "Send an email from a Relay user to one or more AWS SES Simulator mailbox(es)."
        " See https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html"
        " for behaviour of the mailboxes."
    )

    def add_arguments(self, parser: ArgumentParser):
        parser.add_argument(
            "from_email",
            metavar="user@relay.example.com",
            help="A Relay standard or domain email address.",
        )
        parser.add_argument(
            "scenario",
            help="One or more short names of simulator mailbox(es).",
            nargs="+",
            choices=[scenario.value for scenario in SimulatorScenario],
        )
        parser.add_argument(
            "-l", "--label", help="A label to add to the simulator email address."
        )

    def handle(
        self,
        *args: list[Any],
        **options: dict[str, Any],
    ) -> None:
        verbosity = cast(int, options.get("verbosity"))
        scenario = cast(str, options.get("scenario"))
        from_email = cast(str, options.get("from_email"))
        label = cast(Optional[str], options.get("label"))

        from_address = self.get_from_address(from_email)
        if from_address is None:
            raise CommandError(f"No matching Relay address for {from_email}")

        for value in scenario:
            s_enum = SimulatorScenario(value)
            to_email = get_simulator_email_address(s_enum, label=label)
            if verbosity >= 1:
                logger.info(
                    f"Sending a {value} email",
                    extra={
                        "from_email": from_email,
                        "to_email": to_email,
                        "label": label,
                    },
                )
            response = send_simulator_email(s_enum, from_email, label)
            if verbosity >= 2:
                logger.info(
                    "SES send_raw_email responded",
                    extra={"response": asdict(response)},
                )

    def get_from_address(
        self, from_email: str
    ) -> Union[None, DomainAddress, RelayAddress]:
        local_portion, domain_portion = from_email.split("@")
        try:
            return _get_address(from_email, local_portion, domain_portion)
        except ObjectDoesNotExist:
            return None
