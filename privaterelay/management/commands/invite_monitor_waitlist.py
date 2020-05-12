from datetime import datetime
from email.utils import parseaddr
import logging

from socketlabs.injectionapi.message.basicmessage import BasicMessage
from socketlabs.injectionapi.message.emailaddress import EmailAddress

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from emails.utils import get_socketlabs_client, socketlabs_send
from ...models import Invitations, MonitorSubscriber


logger = logging.getLogger('events')


class Command(BaseCommand):
    help = 'Connects to Monitor waitlist and creates invitations.'

    def add_arguments(self, parser):
        parser.add_argument('limit', nargs=1, type=int)

    def handle(self, *args, **options):
        limit = options['limit'][0]

        monitor_waitlist = MonitorSubscriber.objects.using('monitor').filter(
            waitlists_joined__email_relay__notified=False
        )[:limit]

        print("adding %s invitations ..." % monitor_waitlist.count())

        for invitee in monitor_waitlist:
            try:
                Invitations.objects.get(
                    email=invitee.primary_email,
                    active=True,
                )
                print(
                    "%s already has an active invitation" %
                    invitee.primary_email
                )
            except Invitations.DoesNotExist:
                print("adding %s to invitations" % invitee.primary_email)
                invitation = Invitations.objects.create(
                    email=invitee.primary_email,
                    active=True,
                    date_added=datetime.now(),
                    date_redeemed=None
                )

                # Send email invite
                sl_message = BasicMessage()
                sl_message.subject = (
                    "You're Invited to the Private Relay Beta!"
                )

                sl_message.html_body = render_to_string(
                    'emails/beta_invite_html_email.html',
                    {'email': invitee.primary_email}
                )
                sl_message.plain_text_body = render_to_string(
                    'emails/beta_invite_text_email.txt',
                    {'email': invitee.primary_email}
                )

                relay_display_name, relay_from_address = parseaddr(
                    settings.RELAY_FROM_ADDRESS
                )
                sl_message.from_email_address = EmailAddress(
                    relay_from_address
                )
                sl_message.to_email_address.append(
                    EmailAddress(invitee.primary_email)
                )

                sl_client = get_socketlabs_client()
                response = socketlabs_send(sl_client, sl_message)

                if not response.result.name == 'Success':
                    logger.error('socketlabs_error', extra=response.to_json())

                invitation.date_sent = datetime.now()
                invitation.save(update_fields=['date_sent'])

                invitee.waitlists_joined['email_relay']['notified'] = True
                invitee.save(update_fields=['waitlists_joined'])
