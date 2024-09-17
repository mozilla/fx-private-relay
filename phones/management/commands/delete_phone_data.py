from argparse import ArgumentParser
from dataclasses import dataclass
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from allauth.socialaccount.models import SocialAccount

from phones.models import InboundContact, RealPhone, RelayNumber


class Command(BaseCommand):
    help = "Deletes phone data, so a user can re-enroll."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("fxa_id", help="The user's FxA ID")
        parser.add_argument(
            "-f",
            "--force",
            action="store_true",
            help="Skip confirmation and delete any found data",
        )

    def handle(self, *args: Any, **kwargs: Any) -> None | str:
        fxa_id: str = kwargs["fxa_id"]
        skip_confirmation: bool = kwargs["force"]

        try:
            data = _PhoneData.from_fxa(fxa_id)
        except SocialAccount.DoesNotExist:
            raise CommandError(f"No user with FxA ID '{fxa_id}'.")

        report = f"Found a matching user:\n\n{data.bullet_report()}\n"
        self.stdout.write(report)

        if not data.has_data:
            return "User has NO PHONE DATA to delete."

        confirmed = skip_confirmation or self.confirm()
        if confirmed:
            data.reset()
            return "Deleted user's phone data."
        return "User still has their phone data... FOR NOW!"

    def confirm(self) -> bool:
        answer = ""
        first_time = True
        while answer not in ("Y", "N"):
            if first_time:
                first_time = False
            else:
                self.stdout.write("Please answer 'Y' or 'N'")
            raw_answer = input("Delete this user's phone data? (Y/N) ")
            answer = raw_answer.strip().upper()
        return answer == "Y"


@dataclass
class _PhoneData:
    """Helper class to hold phone data for a user."""

    fxa: SocialAccount
    real_phones: list[RealPhone] | None = None
    relay_phone: RelayNumber | None = None
    inbound_contact_count: int = 0

    @classmethod
    def from_fxa(cls, fxa_id: str) -> "_PhoneData":
        """Initialize from an FxA ID."""
        fxa = SocialAccount.objects.get(provider="fxa", uid=fxa_id)

        real_phones = RealPhone.objects.filter(user=fxa.user)
        if not real_phones.exists():
            return cls(fxa=fxa)

        try:
            relay_phone = RelayNumber.objects.get(user=fxa.user)
            inbound_contact_count = InboundContact.objects.filter(
                relay_number=relay_phone
            ).count()
        except RelayNumber.DoesNotExist:
            return cls(fxa=fxa, real_phones=list(real_phones))

        return cls(
            fxa=fxa,
            real_phones=list(real_phones),
            relay_phone=relay_phone,
            inbound_contact_count=inbound_contact_count,
        )

    @property
    def has_data(self) -> bool:
        """Return True if the user has phone data to reset."""
        return self.real_phones is not None and len(self.real_phones) > 0

    @property
    def real_numbers(self) -> list[str] | None:
        """Get user's real phone number, if it exists."""
        if self.real_phones:
            return [real_phone.number for real_phone in self.real_phones]
        return None

    @property
    def relay_number(self) -> str | None:
        """Get user's Relay phone mask number, if it exists."""
        if self.relay_phone:
            return self.relay_phone.number
        return None

    def bullet_report(self) -> str:
        """Return a bulleted list of the user's data."""
        return (
            f"* FxA ID: {self.fxa.uid}\n"
            f"* User ID: {self.fxa.user_id}\n"
            f"* Email: {self.fxa.user.email}\n"
            f"* Real Phone: "
            + (
                "\n* Real Phone: ".join(number for number in self.real_numbers)
                if self.real_numbers
                else "<NO REAL PHONE>"
            )
            + f"\n* Relay Phone: {self.relay_number or '<NO RELAY PHONE>'}\n"
            f"* Inbound Contacts: {self.inbound_contact_count}\n"
        )

    def reset(self) -> None:
        """Reset the user's phone data, so they can re-enroll with new numbers."""
        if self.relay_phone:
            if self.inbound_contact_count:
                InboundContact.objects.filter(relay_number=self.relay_phone).delete()
            self.relay_phone.delete()
        for real_phone in self.real_phones or []:
            real_phone.delete()
