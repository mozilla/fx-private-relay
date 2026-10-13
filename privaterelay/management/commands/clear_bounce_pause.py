import logging
from argparse import ArgumentParser
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from django.conf import settings
from django.core.management import CommandError
from django.core.management.base import BaseCommand

from allauth.socialaccount.models import SocialAccount

from privaterelay.models import Profile

logger = logging.getLogger("eventsinfo.clear_bounce_pause")


class Command(BaseCommand):
    help = (
        "Clears a user's bounce pause, so Relay resumes forwarding their email. "
        "Clears both the hard and soft pause unless --soft or --hard is given."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("fxa_id", help="The user's FxA ID")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the current bounce state without writing.",
        )
        parser.add_argument(
            "--soft", action="store_true", help="Clear the soft bounce pause"
        )
        parser.add_argument(
            "--hard", action="store_true", help="Clear the hard bounce pause"
        )

    def handle(
        self,
        fxa_id: str,
        dry_run: bool,
        soft: bool,
        hard: bool,
        *args: Any,
        **options: Any,
    ) -> str:
        clear_hard = hard or not soft
        clear_soft = soft or not hard

        try:
            bounce_pause = _BouncePause.from_fxa(fxa_id)
        except SocialAccount.DoesNotExist:
            raise CommandError(f"No user with FxA ID '{fxa_id}'.")
        except Profile.DoesNotExist:
            raise CommandError(f"User with FxA ID '{fxa_id}' has no profile.")

        self.stdout.write(f"Found a matching user:\n\n{bounce_pause.bullet_report()}\n")

        if dry_run:
            return "No changes were written (dry run)."

        log_data = bounce_pause.log_data()
        cleared = bounce_pause.clear_pauses(hard=clear_hard, soft=clear_soft)

        if not cleared:
            if hard and soft:
                kind = ""
            else:
                kind = "hard " if hard else "soft " if soft else ""
            raise CommandError(f"User has no {kind}bounce pause to clear.")

        message = f"Cleared {' and '.join(cleared)} bounce pause for FxA ID '{fxa_id}'."
        logger.info(message, extra={"cleared": cleared, **log_data})

        return message


@dataclass
class _BouncePause:
    """Helper class to hold a user's bounce pause state."""

    fxa: SocialAccount
    profile: Profile

    @classmethod
    def from_fxa(cls, fxa_id: str) -> "_BouncePause":
        """Initialize from an FxA ID."""
        fxa = SocialAccount.objects.get(provider="fxa", uid=fxa_id)
        return cls(fxa=fxa, profile=fxa.user.profile)

    def bullet_report(self) -> str:
        hard = self._describe(
            self.profile.last_hard_bounce, settings.HARD_BOUNCE_ALLOWED_DAYS
        )
        soft = self._describe(
            self.profile.last_soft_bounce, settings.SOFT_BOUNCE_ALLOWED_DAYS
        )
        return (
            f"* FxA ID: {self.fxa.uid}\n"
            f"* User ID: {self.fxa.user_id}\n"
            f"* Email: {self.fxa.user.email}\n"
            f"* Hard Bounce: {hard}\n"
            f"* Soft Bounce: {soft}\n"
        )

    def log_data(self) -> dict[str, Any]:
        return {
            "fxa_id": self.fxa.uid,
            "user_id": self.fxa.user_id,
            "last_hard_bounce": _isoformat(self.profile.last_hard_bounce),
            "last_soft_bounce": _isoformat(self.profile.last_soft_bounce),
        }

    def clear_pauses(self, *, hard: bool, soft: bool) -> list[str]:
        cleared = []

        if hard and self.profile.last_hard_bounce is not None:
            self.profile.last_hard_bounce = None
            cleared.append("hard")

        if soft and self.profile.last_soft_bounce is not None:
            self.profile.last_soft_bounce = None
            cleared.append("soft")
        if cleared:
            self.profile.save(update_fields=[f"last_{kind}_bounce" for kind in cleared])

        return cleared

    @staticmethod
    def _describe(bounced_at: datetime | None, allowed_days: int) -> str:
        if bounced_at is None:
            return "<NO BOUNCE>"

        ends_at = bounced_at + timedelta(days=allowed_days)
        remaining_time = ends_at - datetime.now(UTC)
        if remaining_time.total_seconds() <= 0:
            return f"{_isoformat(bounced_at)} (pause already expired)"

        return (
            f"{_isoformat(bounced_at)} (pause ends {_isoformat(ends_at)},"
            f" in {remaining_time.days}d {remaining_time.seconds // 3600}h)"
        )


def _isoformat(when: datetime | None) -> str | None:
    return when.isoformat() if when else None
