from argparse import ArgumentParser
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from allauth.socialaccount.models import SocialAccount

from emails.models import Profile


class Command(BaseCommand):
    help = "Deactivates a user to effectively block all usage of Relay."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--key", type=str, help="User API key")
        parser.add_argument("--email", type=str, help="User email address")
        parser.add_argument("--uid", type=str, help="User FXA UID")

    def handle(self, *args: Any, **options: Any) -> str:
        api_key: str | None = options.get("key")
        email: str | None = options.get("email")
        uid: str | None = options.get("uid")

        user: User

        if api_key:
            try:
                profile = Profile.objects.get(api_token=api_key)
                user = profile.user
                user.is_active = False
                user.save()
                msg = f"SUCCESS: deactivated user with api_token: {api_key}"
            except Profile.DoesNotExist:
                msg = "ERROR: Could not find user with that API key."
                self.stderr.write(msg)
                return msg

        if email:
            try:
                user = User.objects.get(email=email)
                user.is_active = False
                user.save()
                msg = f"SUCCESS: deactivated user with email: {email}"
            except User.DoesNotExist:
                msg = "ERROR: Could not find user with that email address."
                self.stderr.write(msg)
                return msg

        if uid:
            try:
                user = SocialAccount.objects.get(uid=uid).user
                user.is_active = False
                user.save()
                msg = f"SUCCESS: deactivated user with FXA UID: {uid}"
            except SocialAccount.DoesNotExist:
                msg = "ERROR: Could not find user with that FXA UID."
                self.stderr.write(msg)
                return msg
        return msg
