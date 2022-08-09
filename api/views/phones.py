from datetime import datetime
import logging

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

from api.views import SaveToRequestUser
from emails.models import Profile

from phones.models import (
    InboundContact,
    RealPhone,
    RelayNumber,
    get_pending_unverified_realphone_records,
    get_valid_realphone_verification_record,
    suggested_numbers,
    location_numbers,
    area_code_numbers,
    twilio_client,
)

from ..exceptions import ConflictError
from ..permissions import HasPhoneService
from ..renderers import (
    TwilioInboundCallXMLRenderer,
    TwilioInboundSMSXMLRenderer,
    vCardRenderer,
)
from ..serializers.phones import (
    InboundContactSerializer,
    RealPhoneSerializer,
    RelayNumberSerializer,
)


logger = logging.getLogger("events")


def twilio_validator():
    phones_config = apps.get_app_config("phones")
    validator = phones_config.twilio_validator
    return validator


class RealPhoneRateThrottle(throttling.UserRateThrottle):
    rate = settings.PHONE_RATE_LIMIT


class RealPhoneViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    """
    Get real phone number records for the authenticated user.

    The authenticated user must have a subscription that grants one of the
    `SUBSCRIPTIONS_WITH_PHONE` capabilities.

    Client must be authenticated, and these endpoints only return data that is
    "owned" by the authenticated user.

    """

    http_method_names = ["get", "post", "patch"]
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
                raise exceptions.ValidationError(
                    "Could not find that verification_code for user and number. It may have expired."
                )

            headers = self.get_success_headers(serializer.validated_data)
            verified_valid_record = valid_record.mark_verified()
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

        self.perform_create(serializer)
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
        return super().partial_update(request, *args, **kwargs)


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
        """
        existing_number = RelayNumber.objects.filter(user=request.user)
        if existing_number:
            raise exceptions.ValidationError("User already has a RelayNumber.")
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """
        Update the authenticated user's relay number.

        The authenticated user must have a subscription that grants one of the
        `SUBSCRIPTIONS_WITH_PHONE` capabilities.

        The `{id}` should match a previously-`POST`ed resource that belongs to the authenticated user.

        This is primarily used to toggle the `enabled` field.
        """
        return super().partial_update(request, *args, **kwargs)

    @decorators.action(detail=False)
    def suggestions(self, request):
        """
        Returns suggested relay numbers for the authenticated user.

        Based on the user's real number, returns available relay numbers:
          * `same_prefix_options`: Numbers that match as much of the user's real number as possible.
          * `other_areas_options`: Numbers that exactly match the user's real number, in a different area code.
          * `same_area_options`: Other numbers in the same area code as the user.
        """
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
        """
        location = request.query_params.get("location")
        if location is not None:
            numbers = location_numbers(location)
            return response.Response(numbers)

        area_code = request.query_params.get("area_code")
        if area_code is not None:
            numbers = area_code_numbers(area_code)
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
        error_message = f"number must be in E.164 format, or in local national format of the country detected: {country}"
        raise exceptions.ValidationError(error_message)

    e164_number = f"+{parsed_number.country_code}{parsed_number.national_number}"
    number_details = _get_number_details(e164_number)
    if not number_details:
        raise exceptions.ValidationError(
            f"Could not get number details for {e164_number}"
        )

    if number_details.country_code != "US":
        raise exceptions.ValidationError(
            "Relay Phone is currently only available in the US. "
            "Your phone number country code is: "
            f"{number_details.country_code}"
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
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([TwilioInboundSMSXMLRenderer])
def inbound_sms(request):
    _validate_twilio_request(request)
    inbound_body = request.data.get("Body", None)
    inbound_from = request.data.get("From", None)
    inbound_to = request.data.get("To", None)
    if inbound_body is None or inbound_from is None or inbound_to is None:
        raise exceptions.ValidationError("Message missing From, To, Or Body.")

    relay_number, real_phone, inbound_contact = _get_phone_objects(
        inbound_to, inbound_from, "texts"
    )
    if inbound_contact:
        _check_and_update_contact(inbound_contact, "texts")

    client = twilio_client()
    client.messages.create(
        from_=relay_number.number,
        body=f"[Relay 📲 {inbound_from}] {inbound_body}",
        to=real_phone.number,
    )
    return response.Response(status=201, data={"message": "Relayed message to user."})


@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([TwilioInboundCallXMLRenderer])
def inbound_call(request):
    _validate_twilio_request(request)
    inbound_from = request.data.get("Caller", None)
    inbound_to = request.data.get("Called", None)
    if inbound_from is None or inbound_to is None:
        raise exceptions.ValidationError("Call data missing Caller or Called.")

    _, real_phone, inbound_contact = _get_phone_objects(
        inbound_to, inbound_from, "calls"
    )
    if inbound_contact:
        _check_and_update_contact(inbound_contact, "calls")

    # Note: TwilioInboundCallXMLRenderer will render this as TwiML
    return response.Response(
        status=201,
        data={"inbound_from": inbound_from, "real_number": real_phone.number},
    )


def _get_phone_objects(inbound_to, inbound_from, contact_type):
    # Get RelayNumber and RealPhone
    try:
        relay_number = RelayNumber.objects.get(number=inbound_to)
        real_phone = RealPhone.objects.get(user=relay_number.user, verified=True)
    except ObjectDoesNotExist:
        raise exceptions.ValidationError("Could not find relay number.")

    # Check if RelayNumber is disabled
    if not relay_number.enabled:
        raise exceptions.ValidationError(f"Number is not accepting {contact_type}.")

    # Check if RelayNumber is storing phone log
    profile = Profile.objects.get(user=relay_number.user)
    if not profile.store_phone_log:
        return relay_number, real_phone, None

    # Check if RelayNumber is blocking this inbound_from
    inbound_contact, _ = InboundContact.objects.get_or_create(
        relay_number=relay_number, inbound_number=inbound_from
    )
    return relay_number, real_phone, inbound_contact


def _check_and_update_contact(inbound_contact, contact_type):
    if inbound_contact.blocked:
        attr = f"num_{contact_type}_blocked"
        setattr(inbound_contact, attr, getattr(inbound_contact, attr) + 1)
        inbound_contact.save()
        raise exceptions.ValidationError(f"Number is not accepting {contact_type}.")

    inbound_contact.last_inbound_date = datetime.now()
    attr = f"num_{contact_type}"
    setattr(inbound_contact, attr, getattr(inbound_contact, attr) + 1)
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
        raise exceptions.ValidationError("Invalid request: invalid signature")
