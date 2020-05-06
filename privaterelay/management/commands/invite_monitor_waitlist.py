from datetime import datetime

from django.core.management.base import BaseCommand

from ...models import Invitations, MonitorSubscriber


class Command(BaseCommand):
    help = 'Connects to Monitor waitlist and creates invitations.'

    def handle(self, *args, **options):
        monitor_waitlist = MonitorSubscriber.objects.using('monitor').filter(
            waitlists_joined__email_relay__notified=False
        )
        print("adding %s invitations ..." % monitor_waitlist.count())
        for invitee in monitor_waitlist:
            try:
                Invitations.objects.get(
                    email=invitee.primary_email,
                    active=True,
                )
                print("%s already has an active invitation" % invitee.primary_email)
            except Invitations.DoesNotExist:
                print("adding %s to invitations" % invitee.primary_email)
                Invitations.objects.create(
                    email=invitee.primary_email,
                    active=True,
                    date_added=datetime.now(),
                    date_redeemed=None
                )
