from datetime import datetime, timezone
from email.utils import parseaddr
import logging

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from emails.utils import ses_send_email
from ...models import Invitations, MonitorSubscriber


logger = logging.getLogger('events')


def email_invited_user(invitee, invitation):
    context = {
        'email': invitee.primary_email,
        'current_domain': settings.SITE_ORIGIN,
    }

    subject = ("Firefox Relay beta: Protect your real email address from "
               "hackers and trackers")

    message_body = {}

    message_body['Html'] = {
        'Charset': 'UTF-8',
        'Data': render_to_string(
            'emails/beta_invite_html_email.html',
            context
        )
    }
    message_body['Text'] = {
        'Charset': 'UTF-8',
        'Data': render_to_string(
            'emails/beta_invite_text_email.txt',
            context
        )
    }

    relay_display_name, relay_from_address = parseaddr(
        settings.RELAY_FROM_ADDRESS
    )
    from_address = '%s <%s>' % (relay_display_name, relay_from_address)

    response = ses_send_email(
        from_address, invitee.primary_email, subject, message_body
    )

    if not response.status_code == 200:
        logger.error('ses_error', extra=response)
        return response

    invitation.date_sent = datetime.now(timezone.utc)
    invitation.save(update_fields=['date_sent'])

    invitee.waitlists_joined['email_relay']['notified'] = True
    invitee.save(update_fields=['waitlists_joined'])

    return response


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
            response = email_invited_user(invitee, invitation)
            if not response.status_code == 200:
                continue
            invites_sent += 1

        print("Sent %s invitations." % invites_sent)
