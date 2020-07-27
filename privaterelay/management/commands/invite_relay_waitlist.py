import logging

from django.core.management.base import BaseCommand

from emails.utils import email_invited_user
from ...models import Invitations


logger = logging.getLogger('events')


class Command(BaseCommand):
    help = 'Connects to Monitor waitlist and creates invitations.'

    def add_arguments(self, parser):
        parser.add_argument('limit', nargs=1, type=int)

    def handle(self, *args, **options):
        limit = options['limit'][0]

        relay_waitlist_invitees = (
            Invitations.objects.filter(active=False)
            .order_by('date_added')
            [:limit]
        )

        invites_sent = 0
        for invitation in relay_waitlist_invitees:
            invitation.active=True
            invitation.save()
            print("Sending invite email to %s" % invitation.email)
            response = email_invited_user(invitation)
            if not response.status_code == 200:
                continue
            invites_sent += 1

        print("Sent %s invitations." % invites_sent)
