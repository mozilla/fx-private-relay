from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from emails.utils import set_user_group


class Command(BaseCommand):
    help = "Update existing user group who are Mozillians"

    def add_arguments(self, parser):
        parser.add_argument("email_domain", nargs=1)

    def handle(self, *args, **options):
        email_domain = options["email_domain"][0]
        user_qs = User.objects.filter(email__endswith=email_domain)
        update_count = 0
        for user in user_qs:
            set_user_group(user)
            update_count += 1
        self.stdout.write(f"Updated {update_count} users' group.")
