from decouple import config
from phonenumbers import parse, format_number
from phonenumbers import PhoneNumberFormat
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

from django.core.exceptions import MultipleObjectsReturned
from django.http import HttpResponse, HttpResponseNotFound
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .models import Session


account_sid = config('TWILIO_ACCOUNT_SID', None)
auth_token = config('TWILIO_AUTH_TOKEN', None)
client = Client(account_sid, auth_token)
service = client.proxy.services(config('TWILIO_SERVICE_ID'))


PROMPT_MESSAGE = "For how many minutes do you need a relay number?"


@csrf_exempt
def main_twilio_webhook(request):
    resp = MessagingResponse()
    from_num = request.POST['From']
    body = request.POST['Body'].lower()

    if body == 'reset':
        from_num_sessions = Session.objects.filter(
            initiating_real_number=from_num
        )
        for session in from_num_sessions:
            service.sessions(session.twilio_sid).update(status='closed')
        from_num_sessions.delete()
        resp.message(
            "Relay session reset. \n%s" % PROMPT_MESSAGE
        )
        return HttpResponse(resp)

    # TODO: remove this check; allow users to have multiple sessions at once?
    if body != 'reset':
        existing_sessions = Session.objects.filter(
            initiating_real_number=from_num
        )
        if existing_sessions:
            pretty_proxy = format_number(
                parse(existing_sessions[0].initiating_proxy_number),
                PhoneNumberFormat.NATIONAL
            )
            resp.message(
                "You already have a relay number: \n%s. \n"
                "Reply 'reset' to reset it." % pretty_proxy
            )
            return HttpResponse(resp)

    try:
        ttl_minutes = int(body)
    except ValueError:
        resp.message(PROMPT_MESSAGE)
        return HttpResponse(resp)

    session = service.sessions.create(ttl=ttl_minutes*60,)
    participant = service.sessions(session.sid).participants.create(
        identifier=from_num
    )
    proxy_num = participant.proxy_identifier

    # store this half-way open session in our local DB,
    # so when the next number texts the proxy number,
    # we can add them as the 2nd participant and open the session
    Session.objects.create(
        twilio_sid = session.sid,
        initiating_proxy_number=proxy_num,
        initiating_real_number=from_num,
        initiating_participant_sid=participant.sid,
        status='waiting-for-party',
    )

    # reply back with the number and minutes it will live
    pretty_from = format_number(parse(from_num), PhoneNumberFormat.NATIONAL)
    pretty_proxy = format_number(parse(proxy_num), PhoneNumberFormat.NATIONAL)
    resp.message(
        '%s will forward to this number for %s minutes' %
        (pretty_proxy, ttl_minutes)
    )
    return HttpResponse(resp)


@csrf_exempt
def twilio_proxy_out_of_session(request):
    """
    By design, Relay doesn't know who the 2nd participant is before they text
    the 1st participant.

    Twilio requires both participants be added to a session before either can
    communicate with the other. When the 2nd participant sends their first text
    to a 1st participant, it triggers an "out-of-session" hook.

    So, we use this to add the 2nd participant to the existing session, relay
    the 2nd participant's message, and the 2 parties can begin communicating
    thru the proxy number.

    TODO: detect real out-of-session messages - i.e., not first messages
    """
    resp = MessagingResponse()

    try:
        db_session = Session.objects.get(
            initiating_proxy_number=request.POST['To'],
            status='waiting-for-party',
        )
    except (Session.DoesNotExist, MultipleObjectsReturned) as e:
        print(e)
        resp.message('The person you are trying to reach is unavailable.')
        return HttpResponse(resp)

    twilio_session = service.sessions(db_session.twilio_sid).fetch()
    if (twilio_session.status in ['closed', 'failed', 'unknown']):
        error_message = ('Twilio session %s status: %s' %
                         (db_session.twilio_sid, twilio_session.status))
        print(error_message)
        return HttpResponseNotFound(error_message)

    from_num = request.POST['From']
    new_participant = service.sessions(twilio_session.sid).participants.create(
        identifier=from_num
    )
    db_session.status = 'connected-to-party'
    db_session.save()
    # Now that we've added the 2nd participant,
    # send their first message to the 1st participant
    message = (
        service.sessions(twilio_session.sid)
        .participants(db_session.initiating_participant_sid)
        .message_interactions.create(body=request.POST['Body'])
    )

    return HttpResponse(status=201, content="Created")
