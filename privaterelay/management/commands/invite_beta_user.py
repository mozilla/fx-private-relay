from django.core.management.base import BaseCommand
from django.core.validators import validate_email

from ...models import Invitations


class Command(BaseCommand):
    help = 'Adds an email address to the invitations list/table.'

    def add_arguments(self, parser):
        parser.add_argument('email', nargs=1, type=str)

    def handle(self, *args, **options):
        email = options['email'][0]
        validate_email(email)
        Invitations.objects.create(
            email=email, active=True, date_sent=None, date_redeemed=None
        )
