from django.core.management.base import BaseCommand
from django.core.validators import validate_email

from ...models import get_invitation, Invitations


class Command(BaseCommand):
    help = 'Adds an email address to the invitations list/table.'

    def add_arguments(self, parser):
        parser.add_argument('email', nargs=1, type=str)

    def handle(self, *args, **options):
        email = options['email'][0]
        validate_email(email)

        try:
            existing_invitation = get_invitation(email=email, active=False)
            existing_invitation.active = True
            existing_invitation.save(update_fields=['active'])
        except Invitations.DoesNotExist:
            Invitations.objects.create(
                email=email, active=True, date_sent=None, date_redeemed=None
            )
