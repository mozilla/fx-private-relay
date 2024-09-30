from typing import Any

from django.core.management.base import CommandParser

from allauth.socialaccount.models import SocialAccount
from waffle.management.commands.waffle_flag import Command as FlagCommand


class Command(FlagCommand):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--fxa",
            action="append",
            default=list(),
            help="Turn on the flag for listed FXA uids.",
        )
        return super().add_arguments(parser)

    def handle(self, *args: Any, **options: Any) -> None:
        if "fxa" in options:
            uids: list[str] = options.get("fxa", [])
            for uid in uids:
                social_account = SocialAccount.objects.get(uid=uid, provider="fxa")
                options["user"].append(social_account.user.email)
        return super().handle(*args, **options)
