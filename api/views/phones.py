from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional
import logging
import re
import string
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema

from waffle import get_waffle_flag_model
import django_ftl
import phonenumbers

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.forms import model_to_dict

from rest_framework import (
    decorators,
    permissions,
    response,
    throttling,
    viewsets,
    exceptions,
)
from rest_framework.generics import get_object_or_404

from twilio.base.exceptions import TwilioRestException

from api.views import SaveToRequestUser
from emails.utils import incr_if_enabled

from phones.models import (
    InboundContact,
    RealPhone,
    RelayNumber,
    get_last_text_sender,
    get_pending_unverified_realphone_records,
    get_valid_realphone_verification_record,
    get_verified_realphone_record,
    get_verified_realphone_records,
    send_welcome_message,
    suggested_numbers,
    location_numbers,
    area_code_numbers,
    twilio_client,
)
from privaterelay.ftl_bundles import main as ftl_bundle

from ..exceptions import ConflictError, ErrorContextType
from ..permissions import HasPhoneService
from ..renderers import (
    TemplateTwiMLRenderer,
    vCardRenderer,
)
from ..serializers.phones import (
    InboundContactSerializer,
    RealPhoneSerializer,
    RelayNumberSerializer,
)


logger = logging.getLogger("events")
info_logger = logging.getLogger("eventsinfo")


def twilio_validator():
    phones_config = apps.get_app_config("phones")
    validator = phones_config.twilio_validator
    return validator


def twiml_app():
    phones_config = apps.get_app_config("phones")
    return phones_config.twiml_app


class RealPhoneRateThrottle(throttling.UserRateThrottle):
    rate = settings.PHONE_RATE_LIMIT


class RealPhoneViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    """
    Get real phone number records for the authenticated user.

    The authenticated user must have a subscription that grants one of the
    `SUBSCRIPTIONS_WITH_PHONE` capabilities.

    Client must be authenticated, and these endpoints only return data that is
    "owned" by the authenticated user.

    All endpoints are rate-limited to settings.PHONE_RATE_LIMIT
    """

    http_method_names = ["get", "post", "patch", "delete"]
    permission_classes = [permissions.IsAuthenticated, HasPhoneService]
    serializer_class = RealPhoneSerializer
    # TODO: this doesn't seem to e working?
    throttle_classes = [RealPhoneRateThrottle]

    def get_queryset(self):
        return RealPhone.objects.filter(user=self.request.user)

    def create(self, request):
        """
        Add real phone number to the authenticated user.

        The "flow" to verify a real phone number is:
        1. POST a number (Will text a verification code to the number)
        2a. PATCH the verification code to the realphone/{id} endpoint
        2b. POST the number and verification code together

        The authenticated user must have a subscription that grants one of the
        `SUBSCRIPTIONS_WITH_PHONE` capabilities.

        The `number` field should be in [E.164][e164] format which includes a country
        code. If the number is not in E.164 format, this endpoint will try to
        create an E.164 number by prepending the country code of the client
        making the request (i.e., from the `X-Client-Region` HTTP header).

        If the `POST` does NOT include a `verification_code` and the number is
        a valid (currently, US-based) number, this endpoint will text a
        verification code to the number.

        If the `POST` DOES include a `verification_code`, and the code matches
        a code already sent to the number, this endpoint will set `verified` to
        `True` for this number.

        [e164]: https://en.wikipedia.org/wiki/E.164
        """
        incr_if_enabled("phones_RealPhoneViewSet.create")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Check if the request includes a valid verification_code
        # value, look for any un-expired record that matches both the phone
        # number and verification code and mark it verified.
        verification_code = serializer.validated_data.get("verification_code")
        if verification_code:
            valid_record = get_valid_realphone_verification_record(
                request.user, serializer.validated_data["number"], verification_code
            )
            if not valid_record:
                incr_if_enabled("phones_RealPhoneViewSet.create.invalid_verification")
                raise exceptions.ValidationError(
                    "Could not find that verification_code for user and number."
                    " It may have expired."
                )

            headers = self.get_success_headers(serializer.validated_data)
            verified_valid_record = valid_record.mark_verified()
            incr_if_enabled("phones_RealPhoneViewSet.create.mark_verified")
            response_data = model_to_dict(
                verified_valid_record,
                fields=[
                    "id",
                    "number",
                    "verification_sent_date",
                    "verified",
                    "verified_date",
                ],
            )
            return response.Response(response_data, status=201, headers=headers)

        # to prevent sending verification codes to verified numbers,
        # check if the number is already a verified number.
        is_verified = get_verified_realphone_record(serializer.validated_data["number"])
        if is_verified:
            raise ConflictError("A verified record already exists for this number.")

        # to prevent abusive sending of verification messages,
        # check if there is an un-expired verification code for the user
        pending_unverified_records = get_pending_unverified_realphone_records(
            serializer.validated_data["number"]
        )
        if pending_unverified_records:
            raise ConflictError(
                "An unverified record already exists for this number.",
            )

        # We call an additional _validate_number function with the request
        # to try to parse the number as a local national number in the
        # request.country attribute
        valid_number = _validate_number(request)
        serializer.validated_data["number"] = valid_number.phone_number
        serializer.validated_data["country_code"] = valid_number.country_code.upper()

        self.perform_create(serializer)
        incr_if_enabled("phones_RealPhoneViewSet.perform_create")
        headers = self.get_success_headers(serializer.validated_data)
        response_data = serializer.data
        response_data["message"] = (
            "Sent verification code to "
            f"{valid_number.phone_number} "
            f"(country: {valid_number.country_code} "
            f"carrier: {valid_number.carrier})"
        )
        return response.Response(response_data, status=201, headers=headers)

    # check verification_code during partial_update to compare
    # the value sent in the request against the value already on the instance
    # TODO: this logic might be able to move "up" into the model, but it will
    # need some more serious refactoring of the RealPhone.save() method
    def partial_update(self, request, *args, **kwargs):
        """
        Update the authenticated user's real phone number.

        The authenticated user must have a subscription that grants one of the
        `SUBSCRIPTIONS_WITH_PHONE` capabilities.

        The `{id}` should match a previously-`POST`ed resource that belongs to the user.

        The `number` field should be in [E.164][e164] format which includes a country
        code.

        The `verification_code` should be the code that was texted to the
        number during the `POST`. If it matches, this endpoint will set
        `verified` to `True` for this number.

        [e164]: https://en.wikipedia.org/wiki/E.164
        """
        incr_if_enabled("phones_RealPhoneViewSet.partial_update")
        instance = self.get_object()
        if request.data["number"] != instance.number:
            raise exceptions.ValidationError("Invalid number for ID.")
        # TODO: check verification_sent_date is not "expired"?
        # Note: the RealPhone.save() logic should prevent expired verifications
        if (
            "verification_code" not in request.data
            or not request.data["verification_code"] == instance.verification_code
        ):
            raise exceptions.ValidationError(
                "Invalid verification_code for ID. It may have expired."
            )

        instance.mark_verified()
        incr_if_enabled("phones_RealPhoneViewSet.partial_update.mark_verified")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Delete a real phone resource.

        Only **un-verified** real phone resources can be deleted.
        """
        incr_if_enabled("phones_RealPhoneViewSet.destroy")
        instance = self.get_object()
        if instance.verified:
            raise exceptions.ValidationError(
                "Only un-verified real phone resources can be deleted."
            )

        return super().destroy(request, *args, **kwargs)


class RelayNumberViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch"]
    permission_classes = [permissions.IsAuthenticated, HasPhoneService]
    serializer_class = RelayNumberSerializer

    def get_queryset(self):
        return RelayNumber.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """
        Provision a phone number with Twilio and assign to the authenticated user.

        ⚠️ **THIS WILL BUY A PHONE NUMBER** ⚠️
        If you have real account credentials in your `TWILIO_*` env vars, this
        will really provision a Twilio number to your account. You can use
        [Test Credentials][test-creds] to call this endpoint without making a
        real phone number purchase. If you do, you need to pass one of the
        [test phone numbers][test-numbers].

        The `number` should be in [E.164][e164] format.

        Every call or text to the relay number will be sent as a webhook to the
        URL configured for your `TWILIO_SMS_APPLICATION_SID`.

        [test-creds]: https://www.twilio.com/docs/iam/test-credentials
        [test-numbers]: https://www.twilio.com/docs/iam/test-credentials#test-incoming-phone-numbers-parameters-PhoneNumber
        [e164]: https://en.wikipedia.org/wiki/E.164
        """  # noqa: E501  # ignore long line for URL
        incr_if_enabled("phones_RelayNumberViewSet.create")
        existing_number = RelayNumber.objects.filter(user=request.user)
        if existing_number:
            raise exceptions.ValidationError("User already has a RelayNumber.")
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """
        Update the authenticated user's relay number.

        The authenticated user must have a subscription that grants one of the
        `SUBSCRIPTIONS_WITH_PHONE` capabilities.

        The `{id}` should match a previously-`POST`ed resource that belongs to
        the authenticated user.

        This is primarily used to toggle the `enabled` field.
        """
        incr_if_enabled("phones_RelayNumberViewSet.partial_update")
        return super().partial_update(request, *args, **kwargs)

    @decorators.action(detail=False)
    def suggestions(self, request):
        """
        Returns suggested relay numbers for the authenticated user.

        Based on the user's real number, returns available relay numbers:
          * `same_prefix_options`: Numbers that match as much of the user's
            real number as possible.
          * `other_areas_options`: Numbers that exactly match the user's real
            number, in a different area code.
          * `same_area_options`: Other numbers in the same area code as the user.
          * `random_options`: Available numbers in the user's country
        """
        incr_if_enabled("phones_RelayNumberViewSet.suggestions")
        numbers = suggested_numbers(request.user)
        return response.Response(numbers)

    @decorators.action(detail=False)
    def search(self, request):
        """
        Search for available numbers.

        This endpoints uses the underlying [AvailablePhoneNumbers][apn] API.

        Accepted query params:
          * ?location=
            * Will be passed to `AvailablePhoneNumbers` `in_locality` param
          * ?area_code=
            * Will be passed to `AvailablePhoneNumbers` `area_code` param

        [apn]: https://www.twilio.com/docs/phone-numbers/api/availablephonenumberlocal-resource#read-multiple-availablephonenumberlocal-resources
        """  # noqa: E501  # ignore long line for URL
        incr_if_enabled("phones_RelayNumberViewSet.search")
        real_phone = get_verified_realphone_records(request.user).first()
        if real_phone:
            country_code = real_phone.country_code
        else:
            country_code = "US"
        location = request.query_params.get("location")
        if location is not None:
            numbers = location_numbers(location, country_code)
            return response.Response(numbers)

        area_code = request.query_params.get("area_code")
        if area_code is not None:
            numbers = area_code_numbers(area_code, country_code)
            return response.Response(numbers)

        return response.Response({}, 404)


class InboundContactViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "patch"]
    permission_classes = [permissions.IsAuthenticated, HasPhoneService]
    serializer_class = InboundContactSerializer

    def get_queryset(self):
        request_user_relay_num = get_object_or_404(RelayNumber, user=self.request.user)
        return InboundContact.objects.filter(relay_number=request_user_relay_num)


def _validate_number(request):
    parsed_number = _parse_number(
        request.data["number"], getattr(request, "country", None)
    )
    if not parsed_number:
        country = None
        if hasattr(request, "country"):
            country = request.country
        error_message = (
            "number must be in E.164 format, or in local national format of the"
            f" country detected: {country}"
        )
        raise exceptions.ValidationError(error_message)

    e164_number = f"+{parsed_number.country_code}{parsed_number.national_number}"
    number_details = _get_number_details(e164_number)
    if not number_details:
        raise exceptions.ValidationError(
            f"Could not get number details for {e164_number}"
        )

    if number_details.country_code.upper() not in settings.TWILIO_ALLOWED_COUNTRY_CODES:
        incr_if_enabled("phones_validate_number_unsupported_country")
        raise exceptions.ValidationError(
            "Relay Phone is currently only available for these country codes: "
            f"{sorted(settings.TWILIO_ALLOWED_COUNTRY_CODES)!r}. "
            "Your phone number country code is: "
            f"'{number_details.country_code.upper()}'."
        )

    return number_details


def _parse_number(number, country=None):
    try:
        # First try to parse assuming number is E.164 with country prefix
        return phonenumbers.parse(number)
    except phonenumbers.phonenumberutil.NumberParseException as e:
        if e.error_type == e.INVALID_COUNTRY_CODE and country is not None:
            try:
                # Try to parse, assuming number is local national format
                # in the detected request country
                return phonenumbers.parse(number, country)
            except Exception:
                return None
    return None


def _get_number_details(e164_number):
    incr_if_enabled("phones_get_number_details")
    try:
        client = twilio_client()
        return client.lookups.v1.phone_numbers(e164_number).fetch(type=["carrier"])
    except Exception:
        logger.exception(f"Could not get number details for {e164_number}")
        return None


@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([vCardRenderer])
def vCard(request, lookup_key):
    """
    Get a Relay vCard. `lookup_key` should be passed in url path.

    We use this to return a vCard for a number. When we create a RelayNumber,
    we create a secret lookup_key and text it to the user.
    """
    incr_if_enabled("phones_vcard")
    if lookup_key is None:
        return response.Response(status=404)

    try:
        relay_number = RelayNumber.objects.get(vcard_lookup_key=lookup_key)
    except RelayNumber.DoesNotExist:
        raise exceptions.NotFound()
    number = relay_number.number

    resp = response.Response({"number": number})
    resp["Content-Disposition"] = f"attachment; filename={number}.vcf"
    return resp


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
def resend_welcome_sms(request):
    """
    Resend the "Welcome" SMS, including vCard.

    Requires the user to be signed in and to have phone service.
    """
    incr_if_enabled("phones_resend_welcome_sms")
    try:
        relay_number = RelayNumber.objects.get(user=request.user)
    except RelayNumber.DoesNotExist:
        raise exceptions.NotFound()
    send_welcome_message(request.user, relay_number)

    resp = response.Response(status=201, data={"msg": "sent"})
    return resp


def _try_delete_from_twilio(message):
    try:
        message.delete()
    except TwilioRestException as e:
        # Raise the exception unless it's a 404 indicating the message is already gone
        if e.status != 404:
            raise e


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([TemplateTwiMLRenderer])
def inbound_sms(request):
    incr_if_enabled("phones_inbound_sms")
    _validate_twilio_request(request)

    """
    TODO: delete the message from Twilio; how to do this AFTER this request? queue?
    E.g., with a django-celery task in phones.tasks:

    inbound_msg_sid = request.data.get("MessageSid", None)
    if inbound_msg_sid is None:
        raise exceptions.ValidationError("Request missing MessageSid")
    tasks._try_delete_from_twilio.delay(args=message, countdown=10)
    """

    inbound_body = request.data.get("Body", None)
    inbound_from = request.data.get("From", None)
    inbound_to = request.data.get("To", None)
    if inbound_body is None or inbound_from is None or inbound_to is None:
        raise exceptions.ValidationError("Request missing From, To, Or Body.")

    relay_number, real_phone = _get_phone_objects(inbound_to)
    _check_remaining(relay_number, "texts")

    if inbound_from == real_phone.number:
        try:
            _handle_sms_reply(relay_number, real_phone, inbound_body)
        except RelaySMSException as sms_exception:
            # Send a translated message to the user
            ftl_code = sms_exception.get_codes().replace("_", "-")
            ftl_id = f"sms-error-{ftl_code}"
            with django_ftl.override(real_phone.user.profile.language):
                user_message = ftl_bundle.format(ftl_id, sms_exception.error_context())
            twilio_client().messages.create(
                from_=relay_number.number, body=user_message, to=real_phone.number
            )

            # Return 400 on critical exceptions
            if sms_exception.critical:
                raise exceptions.ValidationError(
                    sms_exception.detail
                ) from sms_exception
        return response.Response(
            status=200,
            template_name="twiml_empty_response.xml",
        )

    number_disabled = _check_disabled(relay_number, "texts")
    if number_disabled:
        return response.Response(
            status=200,
            template_name="twiml_empty_response.xml",
        )
    inbound_contact = _get_inbound_contact(relay_number, inbound_from)
    if inbound_contact:
        _check_and_update_contact(inbound_contact, "texts", relay_number)

    client = twilio_client()
    app = twiml_app()
    incr_if_enabled("phones_outbound_sms")
    client.messages.create(
        from_=relay_number.number,
        body=f"[Relay 📲 {inbound_from}] {inbound_body}",
        status_callback=app.sms_status_callback,
        to=real_phone.number,
    )
    relay_number.remaining_texts -= 1
    relay_number.texts_forwarded += 1
    relay_number.save()
    return response.Response(
        status=201,
        template_name="twiml_empty_response.xml",
    )


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([TemplateTwiMLRenderer])
def inbound_call(request):
    incr_if_enabled("phones_inbound_call")
    _validate_twilio_request(request)
    inbound_from = request.data.get("Caller", None)
    inbound_to = request.data.get("Called", None)
    if inbound_from is None or inbound_to is None:
        raise exceptions.ValidationError("Call data missing Caller or Called.")

    relay_number, real_phone = _get_phone_objects(inbound_to)

    number_disabled = _check_disabled(relay_number, "calls")
    if number_disabled:
        say = "Sorry, that number is not available."
        return response.Response(
            {"say": say}, status=200, template_name="twiml_blocked.xml"
        )

    _check_remaining(relay_number, "seconds")

    inbound_contact = _get_inbound_contact(relay_number, inbound_from)
    if inbound_contact:
        _check_and_update_contact(inbound_contact, "calls", relay_number)

    relay_number.calls_forwarded += 1
    relay_number.save()

    # Note: TemplateTwiMLRenderer will render this as TwiML
    incr_if_enabled("phones_outbound_call")
    return response.Response(
        {"inbound_from": inbound_from, "real_number": real_phone.number},
        status=201,
        template_name="twiml_dial.xml",
    )


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
def voice_status(request):
    incr_if_enabled("phones_voice_status")
    _validate_twilio_request(request)
    call_sid = request.data.get("CallSid", None)
    called = request.data.get("Called", None)
    call_status = request.data.get("CallStatus", None)
    if call_sid is None or called is None or call_status is None:
        raise exceptions.ValidationError("Call data missing Called, CallStatus")
    if call_status != "completed":
        return response.Response(status=200)
    call_duration = request.data.get("CallDuration", None)
    if call_duration is None:
        raise exceptions.ValidationError("completed call data missing CallDuration")
    relay_number, _ = _get_phone_objects(called)
    relay_number.remaining_seconds = relay_number.remaining_seconds - int(call_duration)
    relay_number.save()
    if relay_number.remaining_seconds < 0:
        info_logger.info(
            "phone_limit_exceeded",
            extra={
                "fxa_uid": relay_number.user.profile.fxa.uid,
                "call_duration_in_seconds": int(call_duration),
                "relay_number_enabled": relay_number.enabled,
                "remaining_seconds": relay_number.remaining_seconds,
                "remaining_minutes": relay_number.remaining_minutes,
            },
        )
    client = twilio_client()
    client.calls(call_sid).delete()
    return response.Response(status=200)


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
def sms_status(request):
    _validate_twilio_request(request)
    sms_status = request.data.get("SmsStatus", None)
    message_sid = request.data.get("MessageSid", None)
    if sms_status is None or message_sid is None:
        raise exceptions.ValidationError(
            "Text status data missing SmsStatus or MessageSid"
        )
    if sms_status != "delivered":
        return response.Response(status=200)
    client = twilio_client()
    message = client.messages(message_sid)
    _try_delete_from_twilio(message)
    return response.Response(status=200)


call_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=["to"],
    properties={"to": openapi.Schema(type=openapi.TYPE_STRING)},
)


@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
@swagger_auto_schema(method="post", request_body=call_body)
@decorators.api_view(["POST"])
def call(request):
    """
    Make a call from the authenticated user's relay number.

    """
    to = request.data.get("to", None)
    if to is None:
        raise exceptions.ValidationError("Missing 'to' parameter.")
    real_phone = RealPhone.objects.get(user=request.user)
    relay_number = RelayNumber.objects.get(user=request.user)
    client = twilio_client()
    client.calls.create(
        twiml=f"<Response><Say>Dialing {to} ...</Say><Dial>{to}</Dial></Response>",
        to=real_phone.number,
        from_=relay_number.number,
    )
    return response.Response(status=200)


message_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "body": openapi.Schema(type=openapi.TYPE_STRING),
        "destination": openapi.Schema(type=openapi.TYPE_STRING),
    },
)


@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
@swagger_auto_schema(method="post", request_body=message_body)
@decorators.api_view(["POST"])
def post_message(request):
    """
    Send a message from the user's realy number.

    POST params:
        body: the body of the message
        destination: E.164-formatted phone number

    """
    relay_number = RelayNumber.objects.get(user=request.user)
    body = request.data.get("body")
    destination_number = request.data.get("destination")
    client = twilio_client()
    client.messages.create(from_=relay_number.number, body=body, to=destination_number)
    return response.Response(
        status=200,
    )


messages_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={"with": openapi.Schema(type=openapi.TYPE_STRING)},
)


@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
@decorators.api_view(["GET"])
def messages(request):
    """
    Get the user's messages.

    Pass ?with=<E.164> parameter to filter the messages to only the ones sent between
    the relay number and the <E.164> number.

    Pass ?direction=inbound|outbound to filter the messages to only the inbound or
    outbound messages.

    """
    _with = request.data.get("with", None)
    _direction = request.data.get("direction", None)
    relay_number = RelayNumber.objects.get(user=request.user)

    contact = None
    if _with is not None:
        contact = InboundContact.objects.get(
            relay_number=relay_number, inbound_number=_with
        )

    client = twilio_client()
    if contact:
        inbound_messages = client.messages.list(
            from_=contact.inbound_number, to=relay_number.number
        )
        outbound_messages = client.messages.list(
            from_=relay_number.number, to=contact.inbound_number
        )
        if not _direction:
            return response.Response(
                {
                    "inbound_messages": inbound_messages,
                    "outbound_messages": outbound_messages,
                },
                status=200,
            )
        if _direction == "inbound":
            return response.Response(
                {
                    "inbound_messages": inbound_messages,
                },
                status=200,
            )
        if _direction == "outbound":
            return response.Response(
                {
                    "outbound_messages": outbound_messages,
                },
                status=200,
            )
    inbound_messages = convert_twilio_messages_to_dict(
        client.messages.list(to=relay_number.number)
    )
    outbound_messages = convert_twilio_messages_to_dict(
        client.messages.list(from_=relay_number.number)
    )
    if not _direction:
        return response.Response(
            {
                "inbound_messages": inbound_messages,
                "outbound_messages": outbound_messages,
            },
            status=200,
        )
    if _direction == "inbound":
        return response.Response(
            {
                "inbound_messages": inbound_messages,
            },
            status=200,
        )
    if _direction == "outbound":
        return response.Response(
            {
                "outbound_messages": outbound_messages,
            },
            status=200,
        )
    return response.Response(
        {
            "inbound_messages": inbound_messages,
            "outbound_messages": outbound_messages,
        },
        status=200,
    )


def _get_phone_objects(inbound_to):
    # Get RelayNumber and RealPhone
    try:
        relay_number = RelayNumber.objects.get(number=inbound_to)
        real_phone = RealPhone.objects.get(user=relay_number.user, verified=True)
    except ObjectDoesNotExist:
        raise exceptions.ValidationError("Could not find relay number.")

    return relay_number, real_phone


class RelaySMSException(Exception):
    """
    Base class for exceptions when handling SMS messages.

    Modeled after restframework.APIExcpetion, but without a status_code.
    """

    critical: bool
    default_code: str
    default_detail: Optional[str] = None
    default_detail_template: Optional[str] = None

    def __init__(self, critical=False, *args, **kwargs):
        self.critical = critical
        assert (
            self.default_detail is not None and self.default_detail_template is None
        ) or (self.default_detail is None and self.default_detail_template is not None)
        super().__init__(*args, **kwargs)

    @property
    def detail(self):
        if self.default_detail:
            return self.default_detail
        else:
            return self.default_detail_template.format(**self.error_context())

    def get_codes(self):
        return self.default_code

    def error_context(self) -> ErrorContextType:
        """Return context variables for client-side translation."""
        return {}


class NoPhoneLog(RelaySMSException):
    default_code = "no_phone_log"
    default_detail_template = (
        "To reply, you must allow Firefox Relay to keep a log of your callers"
        " and text senders. You can update this under “Caller and texts log” here:"
        "{account_settings_url}."
    )

    def error_context(self) -> ErrorContextType:
        return {
            "account_settings_url": f"{settings.SITE_ORIGIN or ''}/accounts/settings/"
        }


class NoPreviousSender(RelaySMSException):
    default_code = "no_previous_sender"
    default_detail = (
        "Message failed to send. You can only reply to phone numbers that have sent"
        " you a text message."
    )


class ShortPrefixException(RelaySMSException):
    """Base exception for short prefix exceptions"""

    def __init__(self, short_prefix: str, *args, **kwargs):
        self.short_prefix = short_prefix
        super().__init__(*args, **kwargs)

    def error_context(self) -> ErrorContextType:
        return {"short_prefix": self.short_prefix}


class FullNumberException(RelaySMSException):
    """Base exception for full number exceptions"""

    def __init__(self, full_number: str, *args, **kwargs):
        self.full_number = full_number
        super().__init__(*args, **kwargs)

    def error_context(self) -> ErrorContextType:
        return {"full_number": self.full_number}


class ShortPrefixMatchesNoSenders(ShortPrefixException):
    default_code = "short_prefix_matches_no_senders"
    default_detail_template = (
        "Message failed to send. There is no phone number in this thread ending"
        " in {short_prefix}. Please check the number and try again."
    )


class FullNumberMatchesNoSenders(FullNumberException):
    default_code = "full_number_matches_no_senders"
    default_detail_template = (
        "Message failed to send. There is no previous sender with the phone"
        " number {full_number}. Please check the number and try again."
    )


class MultipleNumberMatches(ShortPrefixException):
    default_code = "multiple_number_matches"
    default_detail_template = (
        "Message failed to send. There is more than one phone number in this"
        " thread ending in {short_prefix}. To retry, start your message with"
        " the complete number."
    )


class NoBodyAfterShortPrefix(ShortPrefixException):
    default_code = "no_body_after_short_prefix"
    default_detail_template = (
        "Message failed to send. Please include a message after the sender identifier"
        " {short_prefix}."
    )


class NoBodyAfterFullNumber(FullNumberException):
    default_code = "no_body_after_full_number"
    default_detail_template = (
        "Message failed to send. Please include a message after the phone number"
        " {full_number}."
    )


def _handle_sms_reply(
    relay_number: RelayNumber, real_phone: RealPhone, inbound_body: str
) -> None:
    incr_if_enabled("phones_handle_sms_reply")
    if not relay_number.storing_phone_log:
        # We do not store user's contacts in our database
        raise NoPhoneLog(critical=True)

    match = _match_senders_by_prefix(relay_number, inbound_body)

    # Fail if prefix match is ambiguous
    if match and not match.contacts and match.match_type == "short":
        raise ShortPrefixMatchesNoSenders(short_prefix=match.detected)
    if match and not match.contacts and match.match_type == "full":
        raise FullNumberMatchesNoSenders(full_number=match.detected)
    if match and len(match.contacts) > 1:
        assert match.match_type == "short"
        raise MultipleNumberMatches(short_prefix=match.detected)

    # Determine the destination number
    destination_number: Optional[str] = None
    if match:
        # Use the sender matched by the prefix
        assert len(match.contacts) == 1
        destination_number = match.contacts[0].inbound_number
    else:
        # No prefix, default to last sender if any
        last_sender = get_last_text_sender(relay_number)
        destination_number = getattr(last_sender, "inbound_number", None)

    # Fail if no last sender
    if destination_number is None:
        raise NoPreviousSender(critical=True)

    # Determine the message body
    if match:
        body = inbound_body.removeprefix(match.prefix)
    else:
        body = inbound_body

    # Fail if the prefix matches a sender, but there is no body to send
    if match and not body and match.match_type == "short":
        raise NoBodyAfterShortPrefix(short_prefix=match.detected)
    if match and not body and match.match_type == "full":
        raise NoBodyAfterFullNumber(full_number=match.detected)

    # Success, send the relayed reply
    client = twilio_client()
    incr_if_enabled("phones_send_sms_reply")
    client.messages.create(from_=relay_number.number, body=body, to=destination_number)
    relay_number.remaining_texts -= 1
    relay_number.texts_forwarded += 1
    relay_number.save()


@dataclass
class MatchByPrefix:
    """Details of parsing a text message for a prefix."""

    # Was it matched by short code or full number?
    match_type: Literal["short", "full"]
    # The prefix portion of the text message
    prefix: str
    # The detected short code or full number
    detected: str
    # The matching numbers, as e.164 strings, empty if None
    numbers: list[str] = field(default_factory=list)


@dataclass
class MatchData(MatchByPrefix):
    """Details of expanding a MatchByPrefix with InboundContacts."""

    # The matching InboundContacts
    contacts: list[InboundContact] = field(default_factory=list)


def _match_senders_by_prefix(
    relay_number: RelayNumber, text: str
) -> Optional[MatchData]:
    """
    Match a prefix to previous InboundContact(s).

    If no prefix was found, returns None
    If a prefix was found, a MatchData object has details and matching InboundContacts
    """
    multi_replies_flag, _ = get_waffle_flag_model().objects.get_or_create(
        name="multi_replies",
        defaults={
            "note": (
                "MPP-2252: Use prefix on SMS text to specify the recipient,"
                " rather than default of last contact."
            )
        },
    )

    if (
        multi_replies_flag.is_active_for_user(relay_number.user)
        or multi_replies_flag.everyone
    ):
        # Load all the previous contacts, collect possible countries
        contacts = InboundContact.objects.filter(relay_number=relay_number).all()
        contacts_by_number: dict[str, InboundContact] = {}
        for contact in contacts:
            pn = phonenumbers.parse(contact.inbound_number)
            e164 = phonenumbers.format_number(pn, phonenumbers.PhoneNumberFormat.E164)
            if e164 not in contacts_by_number:
                contacts_by_number[e164] = contact

        match = _match_by_prefix(text, set(contacts_by_number.keys()))
        if match:
            return MatchData(
                contacts=[contacts_by_number[num] for num in match.numbers],
                **asdict(match),
            )
    return None


_SMS_SHORT_PREFIX_RE = re.compile(
    r"""
^               # Start of string
\s*             # One or more spaces
\d{4}           # 4 digits
\s*             # Optional whitespace
[:]?     # At most one separator, sync with SMS_SEPARATORS below
\s*             # Trailing whitespace
""",
    re.VERBOSE | re.ASCII,
)
_SMS_SEPARATORS = set(":")  # Sync with SMS_SHORT_PREFIX_RE above


def _match_by_prefix(text: str, candidate_numbers: set[str]) -> Optional[MatchByPrefix]:
    """
    Look for a prefix in a text message matching a set of candidate numbers.

    Arguments:
    * A SMS text message
    * A set of phone numbers in E.164 format

    Return None if no prefix was found, or MatchByPrefix with likely match(es)
    """
    # Gather potential region codes, needed by PhoneNumberMatcher
    region_codes = set()
    for candidate_number in candidate_numbers:
        pn = phonenumbers.parse(candidate_number)
        if pn.country_code:
            region_codes |= set(
                phonenumbers.region_codes_for_country_code(pn.country_code)
            )

    # Determine where the message may start
    #  PhoneNumberMatcher doesn't work well with a number directly followed by text,
    #  so just feed it the start of the message that _may_ be a number.
    msg_start = 0
    phone_characters = set(string.digits + string.punctuation + string.whitespace)
    while msg_start < len(text) and text[msg_start] in phone_characters:
        msg_start += 1

    # Does PhoneNumberMatcher detect a full number at start of message?
    text_to_match = text[:msg_start]
    for region_code in region_codes:
        for match in phonenumbers.PhoneNumberMatcher(text_to_match, region_code):
            e164 = phonenumbers.format_number(
                match.number, phonenumbers.PhoneNumberFormat.E164
            )

            # Look for end of prefix
            end = match.start + len(match.raw_string)
            found_one_sep = False
            while True:
                if end >= len(text):
                    break
                elif text[end].isspace():
                    end += 1
                elif text[end] in _SMS_SEPARATORS and not found_one_sep:
                    found_one_sep = True
                    end += 1
                else:
                    break

            prefix = text[:end]
            if e164 in candidate_numbers:
                numbers = [e164]
            else:
                numbers = []
            return MatchByPrefix(
                match_type="full", prefix=prefix, detected=e164, numbers=numbers
            )

    # Is there a short prefix? Return all contacts whose last 4 digits match.
    text_prefix_match = _SMS_SHORT_PREFIX_RE.match(text)
    if text_prefix_match:
        text_prefix = text_prefix_match.group(0)
        digits = set(string.digits)
        digit_suffix = "".join(digit for digit in text_prefix if digit in digits)
        numbers = [e164 for e164 in candidate_numbers if e164[-4:] == digit_suffix]
        return MatchByPrefix(
            match_type="short",
            prefix=text_prefix,
            detected=digit_suffix,
            numbers=sorted(numbers),
        )

    # No prefix detected
    return None


def _check_disabled(relay_number, contact_type):
    # Check if RelayNumber is disabled
    if not relay_number.enabled:
        attr = f"{contact_type}_blocked"
        incr_if_enabled(f"phones_{contact_type}_global_blocked")
        setattr(relay_number, attr, getattr(relay_number, attr) + 1)
        relay_number.save()
        return True


def _check_remaining(relay_number, resource_type):
    model_attr = f"remaining_{resource_type}"
    if getattr(relay_number, model_attr) <= 0:
        incr_if_enabled(f"phones_out_of_{resource_type}")
        raise exceptions.ValidationError(f"Number is out of {resource_type}.")
    return True


def _get_inbound_contact(relay_number, inbound_from):
    # Check if RelayNumber is storing phone log
    if not relay_number.storing_phone_log:
        return None

    # Check if RelayNumber is blocking this inbound_from
    inbound_contact, _ = InboundContact.objects.get_or_create(
        relay_number=relay_number, inbound_number=inbound_from
    )
    return inbound_contact


def _check_and_update_contact(inbound_contact, contact_type, relay_number):
    if inbound_contact.blocked:
        incr_if_enabled(f"phones_{contact_type}_specific_blocked")
        contact_attr = f"num_{contact_type}_blocked"
        setattr(
            inbound_contact, contact_attr, getattr(inbound_contact, contact_attr) + 1
        )
        inbound_contact.save()
        relay_attr = f"{contact_type}_blocked"
        setattr(relay_number, relay_attr, getattr(relay_number, relay_attr) + 1)
        relay_number.save()
        raise exceptions.ValidationError(f"Number is not accepting {contact_type}.")

    inbound_contact.last_inbound_date = datetime.now(timezone.utc)
    singular_contact_type = contact_type[:-1]  # strip trailing "s"
    inbound_contact.last_inbound_type = singular_contact_type
    attr = f"num_{contact_type}"
    setattr(inbound_contact, attr, getattr(inbound_contact, attr) + 1)
    last_date_attr = f"last_{singular_contact_type}_date"
    setattr(inbound_contact, last_date_attr, inbound_contact.last_inbound_date)
    inbound_contact.save()


def _validate_twilio_request(request):
    if "X-Twilio-Signature" not in request._request.headers:
        raise exceptions.ValidationError(
            "Invalid request: missing X-Twilio-Signature header."
        )

    url = request._request.build_absolute_uri()
    sorted_params = {}
    for param_key in sorted(request.data):
        sorted_params[param_key] = request.data.get(param_key)
    request_signature = request._request.headers["X-Twilio-Signature"]
    validator = twilio_validator()
    if not validator.validate(url, sorted_params, request_signature):
        incr_if_enabled("phones_invalid_twilio_signature")
        raise exceptions.ValidationError("Invalid request: invalid signature")


def convert_twilio_messages_to_dict(twilio_messages):
    """
    To serialize twilio messages to JSON for the API,
    we need to convert them into dictionaries.
    """
    messages_as_dicts = []
    for twilio_message in twilio_messages:
        message = {}
        message["from"] = twilio_message.from_
        message["to"] = twilio_message.to
        message["date_sent"] = twilio_message.date_sent
        message["body"] = twilio_message.body
        messages_as_dicts.append(message)
    return messages_as_dicts
