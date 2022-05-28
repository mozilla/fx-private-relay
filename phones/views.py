from datetime import datetime, timedelta

from decouple import config
from phonenumbers import parse, format_number
from phonenumbers import PhoneNumberFormat
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

from django.core.exceptions import MultipleObjectsReturned
from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt

from .models import Session


account_sid = config("TWILIO_ACCOUNT_SID", None)
auth_token = config("TWILIO_AUTH_TOKEN", None)
client = Client(account_sid, auth_token)
service = client.proxy.services(config("TWILIO_SERVICE_ID"))


PROMPT_MESSAGE = "For how many minutes do you need a relay number?"


@csrf_exempt
def main_twilio_webhook(request):
    resp = MessagingResponse()
    from_num = request.POST["From"]
    body = request.POST["Body"].lower()

    _delete_expired_sessions()

    try:
        ttl_minutes = int(body)
    except ValueError:
        resp.message(PROMPT_MESSAGE)
        return HttpResponse(resp)

    _reset_numbers_sessions(from_num)

    # Check that there are relay numbers available so we don't accidentally
    # create an open session that will be crossed with some other session.
    available_numbers = _get_available_numbers()
    if len(available_numbers) == 0:
        resp.message("No relay numbers available. Try again later.")
        return HttpResponse(resp)

    session, participant = _get_session_and_participant_with_available_number(
        available_numbers, ttl_minutes, from_num
    )
    proxy_num = participant.proxy_identifier

    # store this half-way open session in our local DB,
    # so when the next number texts the proxy number,
    # we can add them as the 2nd participant and open the session
    expiration_datetime = session.date_created + timedelta(minutes=ttl_minutes)
    db_session = Session.objects.create(
        twilio_sid=session.sid,
        initiating_proxy_number=proxy_num,
        initiating_real_number=from_num,
        initiating_participant_sid=participant.sid,
        status="waiting-for-party",
        expiration=expiration_datetime,
    )

    # reply back with the number and minutes it will live
    pretty_from = format_number(parse(from_num), PhoneNumberFormat.NATIONAL)
    pretty_proxy = format_number(parse(proxy_num), PhoneNumberFormat.NATIONAL)
    resp.message(
        "%s will forward to this number for %s minutes" % (pretty_proxy, ttl_minutes)
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
    """

    resp = MessagingResponse()

    _delete_expired_sessions()
    try:
        db_session = Session.objects.get(
            initiating_proxy_number=request.POST["To"],
            status="waiting-for-party",
        )
    except Session.DoesNotExist as e:
        print(e)
        resp.message("The number you are trying to reach is unavailable.")
        return HttpResponse(resp)
    except MultipleObjectsReturned as e:
        print(e)
        resp.message("The number you are trying to reach is busy.")
        return HttpResponse(resp)

    twilio_session = service.sessions(db_session.twilio_sid).fetch()
    if twilio_session.status in ["closed", "failed", "unknown"]:
        error_message = "Twilio session %s status: %s" % (
            db_session.twilio_sid,
            twilio_session.status,
        )
        print(error_message)
        return HttpResponseNotFound(error_message)

    from_num = request.POST["From"]
    new_participant = service.sessions(twilio_session.sid).participants.create(
        identifier=from_num,
        proxy_identifier=db_session.initiating_proxy_number,
    )
    # Now that the twilio session is in-progress, we can delete our DB record
    db_session.delete()

    # Now that we've added the 2nd participant,
    # send their first message to the 1st participant
    message = (
        service.sessions(twilio_session.sid)
        .participants(db_session.initiating_participant_sid)
        .message_interactions.create(body=request.POST["Body"])
    )
    return HttpResponse(status=201, content="Created")


def _reset_numbers_sessions(number):
    # If this number already has any sessions, close them on Twilio
    # and delete them from the local DB
    from_num_sessions = Session.objects.filter(initiating_real_number=number)
    for session in from_num_sessions:
        service.sessions(session.twilio_sid).update(status="closed")
    from_num_sessions.delete()


def _delete_expired_sessions():
    expired_sessions = Session.objects.filter(
        status="waiting-for-party", expiration__lte=datetime.now()
    )
    expired_sessions.delete()


def _get_available_numbers():
    numbers = service.phone_numbers.list()
    available_numbers = [
        number.phone_number for number in numbers if number.in_use == 0
    ]
    return available_numbers


def _get_session_and_participant_with_available_number(
    available_numbers, ttl_minutes, from_num
):
    # Since Twilio doesn't automatically assign phone numbers that are not
    # already in use, we need to keep trying to create a session until we get
    # a session with one of the available numbers.
    while True:
        session = service.sessions.create(
            ttl=ttl_minutes * 60,
        )
        participant = service.sessions(session.sid).participants.create(
            identifier=from_num
        )
        if participant.proxy_identifier in available_numbers:
            return session, participant
        service.sessions(session.twilio_sid).update(status="closed")
