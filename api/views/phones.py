from __future__ import annotations

import hashlib
import logging
import re
import string
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db.models.query import QuerySet
from django.forms import model_to_dict

import django_ftl
import phonenumbers
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiRequest,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import (
    decorators,
    exceptions,
    permissions,
    response,
    throttling,
    viewsets,
)
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from twilio.base.exceptions import TwilioRestException
from waffle import flag_is_active, get_waffle_flag_model

from api.views import SaveToRequestUser
from emails.utils import incr_if_enabled
from phones.apps import phones_config, twilio_client
from phones.exceptions import (
    FullNumberMatchesNoSenders,
    MultipleNumberMatches,
    NoBodyAfterFullNumber,
    NoBodyAfterShortPrefix,
    NoPhoneLog,
    NoPreviousSender,
    RelaySMSException,
    ShortPrefixMatchesNoSenders,
)
from phones.iq_utils import send_iq_sms
from phones.models import (
    DEFAULT_REGION,
    InboundContact,
    RealPhone,
    RelayNumber,
    area_code_numbers,
    get_last_text_sender,
    location_numbers,
    send_welcome_message,
    suggested_numbers,
)
from privaterelay.ftl_bundles import main as ftl_bundle
from privaterelay.utils import glean_logger

from ..exceptions import ConflictError
from ..permissions import HasPhoneService
from ..renderers import TemplateTwiMLRenderer, vCardRenderer
from ..serializers.phones import (
    InboundContactSerializer,
    IqInboundSmsSerializer,
    OutboundCallSerializer,
    OutboundSmsSerializer,
    RealPhoneSerializer,
    RelayNumberSerializer,
    TwilioInboundCallSerializer,
    TwilioInboundSmsSerializer,
    TwilioMessagesSerializer,
    TwilioNumberSuggestion,
    TwilioNumberSuggestionGroups,
    TwilioSmsStatusSerializer,
    TwilioVoiceStatusSerializer,
)

logger = logging.getLogger("events")
info_logger = logging.getLogger("eventsinfo")


def twilio_validator():
    return phones_config().twilio_validator


def twiml_app():
    return phones_config().twiml_app


class RealPhoneRateThrottle(throttling.UserRateThrottle):
    rate = settings.PHONE_RATE_LIMIT


@extend_schema(tags=["phones"])
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

    def get_queryset(self) -> QuerySet[RealPhone]:
        if isinstance(self.request.user, User):
            return RealPhone.objects.filter(user=self.request.user)
        return RealPhone.objects.none()

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
            try:
                valid_record = (
                    RealPhone.recent_objects.get_for_user_number_and_verification_code(
                        request.user,
                        serializer.validated_data["number"],
                        verification_code,
                    )
                )
            except RealPhone.DoesNotExist:
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
        if RealPhone.verified_objects.exists_for_number(
            serializer.validated_data["number"]
        ):
            raise ConflictError("A verified record already exists for this number.")

        # to prevent abusive sending of verification messages,
        # check if there is an un-expired verification code for number
        if RealPhone.pending_objects.exists_for_number(
            serializer.validated_data["number"]
        ):
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


@extend_schema(tags=["phones"])
class RelayNumberViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch"]
    permission_classes = [permissions.IsAuthenticated, HasPhoneService]
    serializer_class = RelayNumberSerializer

    def get_queryset(self) -> QuerySet[RelayNumber]:
        if isinstance(self.request.user, User):
            return RelayNumber.objects.filter(user=self.request.user)
        return RelayNumber.objects.none()

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

    @extend_schema(
        responses={
            "200": OpenApiResponse(
                TwilioNumberSuggestionGroups(),
                description="Suggested numbers based on the user's real number",
                examples=[
                    OpenApiExample(
                        "suggestions",
                        {
                            "real_num": "4045556789",
                            "same_prefix_options": [],
                            "other_areas_options": [],
                            "same_area_options": [],
                            "random_options": [
                                {
                                    "friendly_name": "(256) 555-3456",
                                    "iso_country": "US",
                                    "locality": "Gadsden",
                                    "phone_number": "+12565553456",
                                    "postal_code": "35903",
                                    "region": "AL",
                                }
                            ],
                        },
                    )
                ],
            ),
            "400": OpenApiResponse(
                description=(
                    "User has not verified their real number,"
                    " or already has a Relay number."
                )
            ),
        },
    )
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

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "location",
                required=False,
                location="query",
                examples=[OpenApiExample("Miami FL USA", "Miami")],
            ),
            OpenApiParameter(
                "area_code",
                required=False,
                location="query",
                examples=[OpenApiExample("Tulsa OK USA", "918")],
            ),
        ],
        responses={
            "200": OpenApiResponse(
                TwilioNumberSuggestion(many=True),
                description="List of available numbers",
                examples=[
                    OpenApiExample(
                        "Tulsa, OK",
                        {
                            "friendly_name": "(918) 555-6789",
                            "iso_country": "US",
                            "locality": "Tulsa",
                            "phone_number": "+19185556789",
                            "postal_code": "74120",
                            "region": "OK",
                        },
                    )
                ],
            ),
            "404": OpenApiResponse(
                description="Neither location or area_code was specified"
            ),
        },
    )
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
        try:
            country_code = RealPhone.verified_objects.country_code_for_user(
                request.user
            )
        except RealPhone.DoesNotExist:
            country_code = DEFAULT_REGION
        location = request.query_params.get("location")
        if location is not None:
            numbers = location_numbers(location, country_code)
            return response.Response(numbers)

        area_code = request.query_params.get("area_code")
        if area_code is not None:
            numbers = area_code_numbers(area_code, country_code)
            return response.Response(numbers)

        return response.Response({}, 404)


@extend_schema(tags=["phones"])
class InboundContactViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "patch"]
    permission_classes = [permissions.IsAuthenticated, HasPhoneService]
    serializer_class = InboundContactSerializer

    def get_queryset(self) -> QuerySet[InboundContact]:
        if isinstance(self.request.user, User):
            relay_number = get_object_or_404(RelayNumber, user=self.request.user)
            return InboundContact.objects.filter(relay_number=relay_number)
        return InboundContact.objects.none()


def _validate_number(request, number_field="number"):
    if number_field not in request.data:
        raise exceptions.ValidationError({number_field: "A number is required."})

    parsed_number = _parse_number(
        request.data[number_field], getattr(request, "country", None)
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


@extend_schema(
    tags=["phones"],
    responses={
        "200": OpenApiResponse(
            bytes,
            description="A Virtual Contact File (VCF) for the user's Relay number.",
            examples=[
                OpenApiExample(
                    name="partial VCF",
                    media_type="text/x-vcard",
                    value=(
                        "BEGIN:VCARD\nVERSION:3.0\nFN:Firefox Relay\n"
                        "TEL:+14045555555\nEND:VCARD\n"
                    ),
                )
            ],
        ),
        "404": OpenApiResponse(description="No or unknown lookup key"),
    },
)
@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([vCardRenderer])
def vCard(request: Request, lookup_key: str) -> response.Response:
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


@extend_schema(
    tags=["phones"],
    request=OpenApiRequest(),
    responses={
        "200": OpenApiResponse(
            {"type": "object"},
            description="Welcome message sent.",
            examples=[OpenApiExample("success", {"msg": "sent"})],
        ),
        "401": OpenApiResponse(description="Not allowed"),
        "404": OpenApiResponse(description="User does not have a Relay number."),
    },
)
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


def message_body(from_num, body):
    return f"[Relay 📲 {from_num}] {body}"


def _log_sms_exception(
    phone_provider: Literal["twilio", "iq"],
    real_phone: RealPhone,
    sms_exception: RelaySMSException,
) -> None:
    """Log SMS exceptions for incoming requests from the provider."""
    context = sms_exception.error_context()
    context["phone_provider"] = phone_provider
    context["fxa_id"] = real_phone.user.profile.metrics_fxa_id
    info_logger.info(sms_exception.default_code, context)


def _get_user_error_message(
    real_phone: RealPhone, sms_exception: RelaySMSException
) -> Any:
    """Generate a translated message for the user."""
    with django_ftl.override(real_phone.user.profile.language):
        user_message = ftl_bundle.format(
            sms_exception.ftl_id, sms_exception.error_context()
        )
    return user_message


@extend_schema(
    tags=["phones: Twilio"],
    parameters=[
        OpenApiParameter(name="X-Twilio-Signature", required=True, location="header"),
    ],
    request=OpenApiRequest(
        TwilioInboundSmsSerializer,
        examples=[
            OpenApiExample(
                "request",
                {"to": "+13035556789", "from": "+14045556789", "text": "Hello!"},
            )
        ],
    ),
    responses={
        "200": OpenApiResponse(
            {"type": "string", "xml": {"name": "Response"}},
            description="The number is disabled.",
            examples=[OpenApiExample("disabled", None)],
        ),
        "201": OpenApiResponse(
            {"type": "string", "xml": {"name": "Response"}},
            description="Forward the message to the user.",
            examples=[OpenApiExample("success", None)],
        ),
        "400": OpenApiResponse(
            {"type": "object", "xml": {"name": "Error"}},
            description="Unable to complete request.",
            examples=[
                OpenApiExample(
                    "invalid signature",
                    {
                        "status_code": 400,
                        "code": "invalid",
                        "title": "Invalid Request: Invalid Signature",
                    },
                )
            ],
        ),
    },
)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([TemplateTwiMLRenderer])
def inbound_sms(request):
    """
    Handle an inbound SMS message sent by Twilio.

    The return value is TwilML Response XML that reports the error or an empty success
    message.
    """
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
    if not real_phone.user.is_active:
        return response.Response(
            status=200,
            template_name="twiml_empty_response.xml",
        )

    glean_logger().log_text_received(user=real_phone.user)
    _check_remaining(relay_number, "texts")

    if inbound_from == real_phone.number:
        prepared = False
        try:
            relay_number, destination_number, body = _prepare_sms_reply(
                relay_number, inbound_body
            )
            prepared = True
        except RelaySMSException as sms_exception:
            _log_sms_exception("twilio", real_phone, sms_exception)
            user_error_message = _get_user_error_message(real_phone, sms_exception)
            twilio_client().messages.create(
                from_=relay_number.number, body=user_error_message, to=real_phone.number
            )
            if sms_exception.status_code >= 400:
                raise

        if prepared:
            client = twilio_client()
            incr_if_enabled("phones_send_sms_reply")
            success = False
            try:
                client.messages.create(
                    from_=relay_number.number, body=body, to=destination_number
                )
                success = True
            except TwilioRestException as e:
                logger.error(
                    "Twilio failed to send reply",
                    {"code": e.code, "http_status_code": e.status, "msg": e.msg},
                )
            if success:
                relay_number.remaining_texts -= 1
                relay_number.texts_forwarded += 1
                relay_number.save()

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
    body = message_body(inbound_from, inbound_body)
    result = "SUCCESS"
    try:
        client.messages.create(
            from_=relay_number.number,
            body=body,
            status_callback=app.sms_status_callback,
            to=real_phone.number,
        )
    except TwilioRestException as e:
        if e.code == 21610:
            # User has opted out with "STOP"
            # TODO: Mark RealPhone as unsubscribed?
            context = {"code": e.code, "http_status_code": e.status, "msg": e.msg}
            context["fxa_id"] = real_phone.user.profile.metrics_fxa_id
            info_logger.info("User has blocked their Relay number", context)
            result = "BLOCKED"
        else:
            result = "FAILED"
            logger.error(
                "Twilio failed to forward message",
                {"code": e.code, "http_status_code": e.status, "msg": e.msg},
            )
    if result == "SUCCESS":
        relay_number.remaining_texts -= 1
        relay_number.texts_forwarded += 1
        relay_number.save()
    elif result == "BLOCKED":
        relay_number.texts_blocked += 1
        relay_number.save()

    return response.Response(
        status=201,
        template_name="twiml_empty_response.xml",
    )


@extend_schema(
    tags=["phones: Inteliquent"],
    request=OpenApiRequest(
        IqInboundSmsSerializer,
        examples=[
            OpenApiExample(
                "request",
                {"to": "+13035556789", "from": "+14045556789", "text": "Hello!"},
            )
        ],
    ),
    parameters=[
        OpenApiParameter(name="VerificationToken", required=True, location="header"),
        OpenApiParameter(name="MessageId", required=True, location="header"),
    ],
    responses={
        "200": OpenApiResponse(
            description=(
                "The message was forwarded, or the user is out of text messages."
            )
        ),
        "401": OpenApiResponse(description="Invalid signature"),
        "400": OpenApiResponse(description="Invalid request"),
    },
)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
def inbound_sms_iq(request: Request) -> response.Response:
    """Handle an inbound SMS message sent by Inteliquent."""
    incr_if_enabled("phones_inbound_sms_iq")
    _validate_iq_request(request)

    inbound_body = request.data.get("text", None)
    inbound_from = request.data.get("from", None)
    inbound_to = request.data.get("to", None)
    if inbound_body is None or inbound_from is None or inbound_to is None:
        raise exceptions.ValidationError("Request missing from, to, or text.")

    from_num = phonenumbers.format_number(
        phonenumbers.parse(inbound_from, DEFAULT_REGION),
        phonenumbers.PhoneNumberFormat.E164,
    )
    single_num = inbound_to[0]
    relay_num = phonenumbers.format_number(
        phonenumbers.parse(single_num, DEFAULT_REGION),
        phonenumbers.PhoneNumberFormat.E164,
    )

    relay_number, real_phone = _get_phone_objects(relay_num)
    _check_remaining(relay_number, "texts")

    if from_num == real_phone.number:
        try:
            relay_number, destination_number, body = _prepare_sms_reply(
                relay_number, inbound_body
            )
            send_iq_sms(destination_number, relay_number.number, body)
            relay_number.remaining_texts -= 1
            relay_number.texts_forwarded += 1
            relay_number.save()
            incr_if_enabled("phones_send_sms_reply_iq")
        except RelaySMSException as sms_exception:
            _log_sms_exception("iq", real_phone, sms_exception)
            user_error_message = _get_user_error_message(real_phone, sms_exception)
            send_iq_sms(real_phone.number, relay_number.number, user_error_message)
            if sms_exception.status_code >= 400:
                raise

        return response.Response(
            status=200,
            template_name="twiml_empty_response.xml",
        )

    number_disabled = _check_disabled(relay_number, "texts")
    if number_disabled:
        return response.Response(status=200)

    inbound_contact = _get_inbound_contact(relay_number, from_num)
    if inbound_contact:
        _check_and_update_contact(inbound_contact, "texts", relay_number)

    text = message_body(inbound_from, inbound_body)
    send_iq_sms(real_phone.number, relay_number.number, text)

    relay_number.remaining_texts -= 1
    relay_number.texts_forwarded += 1
    relay_number.save()
    return response.Response(status=200)


@extend_schema(
    tags=["phones: Twilio"],
    parameters=[
        OpenApiParameter(name="X-Twilio-Signature", required=True, location="header"),
    ],
    request=OpenApiRequest(
        TwilioInboundCallSerializer,
        examples=[
            OpenApiExample(
                "request",
                {"Caller": "+13035556789", "Called": "+14045556789"},
            )
        ],
    ),
    responses={
        "200": OpenApiResponse(
            {
                "type": "object",
                "xml": {"name": "Response"},
                "properties": {"say": {"type": "string"}},
            },
            description="The number is disabled.",
            examples=[
                OpenApiExample(
                    "disabled", {"say": "Sorry, that number is not available."}
                )
            ],
        ),
        "201": OpenApiResponse(
            {
                "type": "object",
                "xml": {"name": "Response"},
                "properties": {
                    "Dial": {
                        "type": "object",
                        "properties": {
                            "callerId": {
                                "type": "string",
                                "xml": {"attribute": "true"},
                            },
                            "Number": {"type": "string"},
                        },
                    }
                },
            },
            description="Connect the caller to the Relay user.",
            examples=[
                OpenApiExample(
                    "success",
                    {"Dial": {"callerId": "+13035556789", "Number": "+15025558642"}},
                )
            ],
        ),
        "400": OpenApiResponse(
            {"type": "object", "xml": {"name": "Error"}},
            description="Unable to complete request.",
            examples=[
                OpenApiExample(
                    "invalid signature",
                    {
                        "status_code": 400,
                        "code": "invalid",
                        "title": "Invalid Request: Invalid Signature",
                    },
                ),
                OpenApiExample(
                    "out of call time for month",
                    {
                        "status_code": 400,
                        "code": "invalid",
                        "title": "Number Is Out Of Seconds.",
                    },
                ),
            ],
        ),
    },
)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([TemplateTwiMLRenderer])
def inbound_call(request):
    """
    Handle an inbound call request sent by Twilio.

    The return value is TwilML Response XML that reports the error or instructs
    Twilio to connect the callers.
    """
    incr_if_enabled("phones_inbound_call")
    _validate_twilio_request(request)
    inbound_from = request.data.get("Caller", None)
    inbound_to = request.data.get("Called", None)
    if inbound_from is None or inbound_to is None:
        raise exceptions.ValidationError("Call data missing Caller or Called.")

    relay_number, real_phone = _get_phone_objects(inbound_to)
    if not real_phone.user.is_active:
        return response.Response(
            status=200,
            template_name="twiml_empty_response.xml",
        )

    glean_logger().log_call_received(user=real_phone.user)
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


@extend_schema(
    tags=["phones: Twilio"],
    request=OpenApiRequest(
        TwilioVoiceStatusSerializer,
        examples=[
            OpenApiExample(
                "Call is complete",
                {
                    "CallSid": "CA" + "x" * 32,
                    "Called": "+14045556789",
                    "CallStatus": "completed",
                    "CallDuration": 127,
                },
            )
        ],
    ),
    parameters=[
        OpenApiParameter(name="X-Twilio-Signature", required=True, location="header"),
    ],
    responses={
        "200": OpenApiResponse(description="Call status was processed."),
        "400": OpenApiResponse(
            description="Required parameters are incorrect or missing."
        ),
    },
)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
def voice_status(request):
    """
    Twilio callback for voice call status.

    When the call is complete, the user's remaining monthly time is updated, and
    the call is deleted from Twilio logs.
    """
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
                "fxa_uid": relay_number.user.profile.metrics_fxa_id,
                "call_duration_in_seconds": int(call_duration),
                "relay_number_enabled": relay_number.enabled,
                "remaining_seconds": relay_number.remaining_seconds,
                "remaining_minutes": relay_number.remaining_minutes,
            },
        )
    client = twilio_client()
    client.calls(call_sid).delete()
    return response.Response(status=200)


@extend_schema(
    tags=["phones: Twilio"],
    request=OpenApiRequest(
        TwilioSmsStatusSerializer,
        examples=[
            OpenApiExample(
                "SMS is delivered",
                {"SmsStatus": "delivered", "MessageSid": "SM" + "x" * 32},
            )
        ],
    ),
    parameters=[
        OpenApiParameter(name="X-Twilio-Signature", required=True, location="header"),
    ],
    responses={
        "200": OpenApiResponse(description="SMS status was processed."),
        "400": OpenApiResponse(
            description="Required parameters are incorrect or missing."
        ),
    },
)
@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
def sms_status(request):
    """
    Twilio callback for SMS status.

    When the message is delivered, this calls Twilio to delete the message from logs.
    """
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


@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
@extend_schema(
    tags=["phones: Outbound"],
    request=OpenApiRequest(
        OutboundCallSerializer,
        examples=[OpenApiExample("request", {"to": "+13035556789"})],
    ),
    responses={
        200: OpenApiResponse(description="Call initiated."),
        400: OpenApiResponse(
            description="Input error, or user does not have a Relay phone."
        ),
        401: OpenApiResponse(description="Authentication required."),
        403: OpenApiResponse(
            description="User does not have 'outbound_phone' waffle flag."
        ),
    },
)
@decorators.api_view(["POST"])
def outbound_call(request):
    """Make a call from the authenticated user's relay number."""
    # TODO: Create or update an OutboundContact (new model) on send, or limit
    # to InboundContacts.
    if not flag_is_active(request, "outbound_phone"):
        # Return Permission Denied error
        return response.Response(
            {"detail": "Requires outbound_phone waffle flag."}, status=403
        )
    try:
        real_phone = RealPhone.verified_objects.get_for_user(user=request.user)
    except RealPhone.DoesNotExist:
        return response.Response(
            {"detail": "Requires a verified real phone and phone mask."}, status=400
        )
    try:
        relay_number = RelayNumber.objects.get(user=request.user)
    except RelayNumber.DoesNotExist:
        return response.Response({"detail": "Requires a phone mask."}, status=400)

    client = twilio_client()

    to = _validate_number(request, "to")  # Raises ValidationError on invalid number
    client.calls.create(
        twiml=(
            f"<Response><Say>Dialing {to.national_format} ...</Say>"
            f"<Dial>{to.phone_number}</Dial></Response>"
        ),
        to=real_phone.number,
        from_=relay_number.number,
    )
    return response.Response(status=200)


@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
@extend_schema(
    tags=["phones: Outbound"],
    request=OpenApiRequest(
        OutboundSmsSerializer,
        examples=[
            OpenApiExample("request", {"body": "Hello!", "destination": "+13045554567"})
        ],
    ),
    responses={
        200: OpenApiResponse(description="Message sent."),
        400: OpenApiResponse(
            description="Input error, or user does not have a Relay phone."
        ),
        401: OpenApiResponse(description="Authentication required."),
        403: OpenApiResponse(
            description="User does not have 'outbound_phone' waffle flag."
        ),
    },
)
@decorators.api_view(["POST"])
def outbound_sms(request):
    """
    Send a message from the user's relay number.

    POST params:
        body: the body of the message
        destination: E.164-formatted phone number

    """
    # TODO: Create or update an OutboundContact (new model) on send, or limit
    # to InboundContacts.
    # TODO: Reduce user's SMS messages for the month by one
    if not flag_is_active(request, "outbound_phone"):
        return response.Response(
            {"detail": "Requires outbound_phone waffle flag."}, status=403
        )
    try:
        relay_number = RelayNumber.objects.get(user=request.user)
    except RelayNumber.DoesNotExist:
        return response.Response({"detail": "Requires a phone mask."}, status=400)

    errors = {}
    body = request.data.get("body")
    if not body:
        errors["body"] = "A message body is required."
    destination_number = request.data.get("destination")
    if not destination_number:
        errors["destination"] = "A destination number is required."
    if errors:
        return response.Response(errors, status=400)

    # Raises ValidationError on invalid number
    to = _validate_number(request, "destination")

    client = twilio_client()
    client.messages.create(from_=relay_number.number, body=body, to=to.phone_number)
    return response.Response(status=200)


@decorators.permission_classes([permissions.IsAuthenticated, HasPhoneService])
@extend_schema(
    tags=["phones: Outbound"],
    parameters=[
        OpenApiParameter(
            name="with",
            description="filter to messages with the given E.164 number",
        ),
        OpenApiParameter(
            name="direction",
            enum=["inbound", "outbound"],
            description="filter to inbound or outbound messages",
        ),
    ],
    responses={
        "200": OpenApiResponse(
            TwilioMessagesSerializer(many=True),
            description="A list of the user's SMS messages.",
            examples=[
                OpenApiExample(
                    "success",
                    {
                        "to": "+13035556789",
                        "date_sent": datetime.now(UTC).isoformat(),
                        "body": "Hello!",
                        "from": "+14045556789",
                    },
                )
            ],
        ),
        "400": OpenApiResponse(description="Unable to complete request."),
        "403": OpenApiResponse(
            description="Caller does not have 'outbound_phone' waffle flag."
        ),
    },
)
@decorators.api_view(["GET"])
def list_messages(request):
    """
    Get the user's SMS messages sent to or from the phone mask

    Pass ?with=<E.164> parameter to filter the messages to only the ones sent between
    the phone mask and the <E.164> number.

    Pass ?direction=inbound|outbound to filter the messages to only the inbound or
    outbound messages. If omitted, return both.
    """
    # TODO: Support filtering to messages for outbound-only phones.
    # TODO: Show data from our own (encrypted) store, rather than from Twilio's

    if not flag_is_active(request, "outbound_phone"):
        return response.Response(
            {"detail": "Requires outbound_phone waffle flag."}, status=403
        )
    try:
        relay_number = RelayNumber.objects.get(user=request.user)
    except RelayNumber.DoesNotExist:
        return response.Response({"detail": "Requires a phone mask."}, status=400)

    _with = request.query_params.get("with", None)
    _direction = request.query_params.get("direction", None)
    if _direction and _direction not in ("inbound", "outbound"):
        return response.Response(
            {"direction": "Invalid value, valid values are 'inbound' or 'outbound'"},
            status=400,
        )

    contact = None
    if _with:
        try:
            contact = InboundContact.objects.get(
                relay_number=relay_number, inbound_number=_with
            )
        except InboundContact.DoesNotExist:
            return response.Response(
                {"with": "No inbound contacts matching the number"}, status=400
            )

    data = {}
    client = twilio_client()
    if not _direction or _direction == "inbound":
        # Query Twilio for SMS messages to the user's phone mask
        params = {"to": relay_number.number}
        if contact:
            # Filter query to SMS from this contact to the phone mask
            params["from_"] = contact.inbound_number
        data["inbound_messages"] = convert_twilio_messages_to_dict(
            client.messages.list(**params)
        )
    if not _direction or _direction == "outbound":
        # Query Twilio for SMS messages from the user's phone mask
        params = {"from_": relay_number.number}
        if contact:
            # Filter query to SMS from the phone mask to this contact
            params["to"] = contact.inbound_number
        data["outbound_messages"] = convert_twilio_messages_to_dict(
            client.messages.list(**params)
        )
    return response.Response(data, status=200)


def _get_phone_objects(inbound_to):
    # Get RelayNumber and RealPhone
    try:
        relay_number = RelayNumber.objects.get(number=inbound_to)
        real_phone = RealPhone.verified_objects.get_for_user(relay_number.user)
    except ObjectDoesNotExist:
        raise exceptions.ValidationError("Could not find relay number.")

    return relay_number, real_phone


def _prepare_sms_reply(
    relay_number: RelayNumber, inbound_body: str
) -> tuple[RelayNumber, str, str]:
    incr_if_enabled("phones_handle_sms_reply")
    if not relay_number.storing_phone_log:
        # We do not store user's contacts in our database
        raise NoPhoneLog()

    match = _match_senders_by_prefix(relay_number, inbound_body)

    # Fail if prefix match is ambiguous
    if match and not match.contacts and match.match_type == "short":
        raise ShortPrefixMatchesNoSenders(short_prefix=match.detected)
    if match and not match.contacts and match.match_type == "full":
        raise FullNumberMatchesNoSenders(full_number=match.detected)
    if match and len(match.contacts) > 1:
        if not match.match_type == "short":
            raise ValueError("match.match_type must be 'short'.")
        raise MultipleNumberMatches(short_prefix=match.detected)

    # Determine the destination number
    destination_number: str | None = None
    if match:
        # Use the sender matched by the prefix
        if not len(match.contacts) == 1:
            raise ValueError("len(match.contacts) must be 1.")
        destination_number = match.contacts[0].inbound_number
    else:
        # No prefix, default to last sender if any
        last_sender = get_last_text_sender(relay_number)
        destination_number = getattr(last_sender, "inbound_number", None)

    # Fail if no last sender
    if destination_number is None:
        raise NoPreviousSender()

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

    return (relay_number, destination_number, body)


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


def _match_senders_by_prefix(relay_number: RelayNumber, text: str) -> MatchData | None:
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
            # TODO: don't default to US when we support other regions
            try:
                pn = phonenumbers.parse(contact.inbound_number, DEFAULT_REGION)
            except phonenumbers.phonenumberutil.NumberParseException:
                # Invalid number like '1', skip it
                continue
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


def _match_by_prefix(text: str, candidate_numbers: set[str]) -> MatchByPrefix | None:
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
    # Check the owner of the relay number (still) has phone service
    if not relay_number.user.profile.has_phone:
        raise exceptions.ValidationError("Number owner does not have phone service")
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

    inbound_contact.last_inbound_date = datetime.now(UTC)
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


def compute_iq_mac(message_id: str) -> str:
    iq_api_key = settings.IQ_INBOUND_API_KEY
    # FIXME: switch to proper hmac when iQ is ready
    # mac = hmac.new(
    #     iq_api_key.encode(), msg=message_id.encode(), digestmod=hashlib.sha256
    # )
    combined = iq_api_key + message_id
    return hashlib.sha256(combined.encode()).hexdigest()


def _validate_iq_request(request: Request) -> None:
    if "Verificationtoken" not in request._request.headers:
        raise exceptions.AuthenticationFailed("missing Verificationtoken header.")

    if "MessageId" not in request._request.headers:
        raise exceptions.AuthenticationFailed("missing MessageId header.")

    message_id = request._request.headers["Messageid"]
    mac = compute_iq_mac(message_id)

    token = request._request.headers["verificationToken"]

    if mac != token:
        raise exceptions.AuthenticationFailed("verificationToken != computed sha256")


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
