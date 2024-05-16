import logging
from typing import Any

from django.core.management.base import BaseCommand

from phones.apps import twilio_client
from phones.models import RelayNumber

logger = logging.getLogger("events")


class Command(BaseCommand):
    help = "Checks for twilio numbers that are not assigned to a subscriber."

    def handle(self, *args: Any, **kwargs: Any) -> None | str:
        try:
            client = twilio_client()
            twilio_numbers = client.incoming_phone_numbers.stream()
            total_twilio_numbers = 0
            numbers_not_in_db = 0
            for number in twilio_numbers:
                total_twilio_numbers += 1
                try:
                    RelayNumber.objects.get(number=number.phone_number)
                except RelayNumber.DoesNotExist:
                    numbers_not_in_db += 1
                    self.stdout.write(
                        f"{number.phone_number} is in Twilio but not in Relay."
                    )
                self.stdout.write(f"total_twilio_numbers: {total_twilio_numbers}")
                self.stdout.write(f"numbers_not_in_db: {numbers_not_in_db}")
        except Exception:
            logger.exception("Could not get list of twilio numbers")

        confirmed = self.confirm()
        if confirmed:
            for number in twilio_numbers:
                client.incoming_phone_numbers(number).delete()
                return f"Deleted {number} from twilio."
        return "User still has their phone data... FOR NOW!"

    def confirm(self) -> bool:
        answer = ""
        first_time = True
        while answer not in ("Y", "N"):
            if first_time:
                first_time = False
            else:
                self.stdout.write("Please answer 'Y' or 'N'")
            raw_answer = input("Delete phone number from twilio? (Y/N) ")
            answer = raw_answer.strip().upper()
        return answer == "Y"
