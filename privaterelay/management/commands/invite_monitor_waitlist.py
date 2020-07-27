from datetime import datetime
import logging

from django.core.management.base import BaseCommand

from emails.utils import email_invited_user
from ...models import Invitations, MonitorSubscriber


logger = logging.getLogger('events')


class Command(BaseCommand):
    help = 'Connects to Monitor waitlist and creates invitations.'

    def add_arguments(self, parser):
        parser.add_argument('limit', nargs=1, type=int)

    def handle(self, *args, **options):
        limit = options['limit'][0]

        monitor_waitlist = (MonitorSubscriber.objects.using('monitor')
            .filter(waitlists_joined__email_relay__notified=False)
            .order_by('-breaches_last_shown')
            [:limit]
        )

        invites_sent = 0
        for invitee in monitor_waitlist:
            try:
                invitation = Invitations.objects.get(
                    email=invitee.primary_email,
                    active=True,
                )
                if invitation.date_redeemed:
                    print(
                        "%s already redeemed their invitation. "
                        "No need to email. "
                        "Setting notified to True." %
                        invitee.primary_email
                    )
                    invitee.waitlists_joined['email_relay']['notified'] = True
                    invitee.save(update_fields=['waitlists_joined'])
                    continue
            except Invitations.DoesNotExist:  # no invitation
                print("Creating invitation for %s" % invitee.primary_email)
                invitation = Invitations.objects.create(
                    email=invitee.primary_email,
                    fxa_uid=invitee.fxa_uid,
                    active=True,
                    date_added=datetime.now(),
                    date_redeemed=None
                )

            print("Sending invite email to %s" % invitee.primary_email)
            response = email_invited_user(invitation, invitee)
            if not response.status_code == 200:
                continue
            invites_sent += 1

        print("Sent %s invitations." % invites_sent)
