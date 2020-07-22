from datetime import datetime, timezone
from email.utils import parseaddr
import logging

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from emails.utils import ses_send_email
from ...models import Invitations


logger = logging.getLogger('events')


def email_invited_user(invitation):
    context = {
        'email': invitation.email,
        'current_domain': settings.SITE_ORIGIN,
    }

    subject = ("Firefox Relay beta: Protect your real email address from "
               "hackers and trackers")
    message_body = {}

    message_body['Html'] = {'Charset': 'UTF-8', 'Data': render_to_string(
        'emails/beta_invite_html_email.html',
        context,
    )}
    message_body['Text'] = {'Charset': 'UTF-8', 'Data': render_to_string(
        'emails/beta_invite_text_email.txt',
        context,
    )}

    relay_display_name, relay_from_address = parseaddr(
        settings.RELAY_FROM_ADDRESS
    )
    from_address = '%s <%s>' % (relay_display_name, relay_from_address)

    response = ses_send_email(
        from_address, invitation.email, subject, message_body
    )

    if not response.status_code == 200:
        logger.error('ses_error', extra=response)
        return response

    invitation.date_sent = datetime.now(timezone.utc)
    invitation.save(update_fields=['date_sent'])

    return response


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
