from datetime import datetime, timedelta
import phonenumbers

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.forms import model_to_dict

from django_filters import rest_framework as filters
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from waffle import get_waffle_flag_model
from waffle.models import Switch, Sample
from rest_framework.views import APIView
from rest_framework import (
    decorators, permissions, response, throttling, viewsets, exceptions
)

from emails.models import (
    CannotMakeAddressException,
    DomainAddress,
    Profile,
    RelayAddress,
)
from phones.models import (
    MAX_MINUTES_TO_VERIFY_REAL_PHONE,
    RealPhone, RelayNumber,
    suggested_numbers, location_numbers, area_code_numbers
)

from privaterelay.settings import (
    BASKET_ORIGIN,
    FXA_BASE_ORIGIN,
    GOOGLE_ANALYTICS_ID,
    PREMIUM_PROD_ID,
    PHONE_PROD_ID,
)
from privaterelay.utils import get_premium_countries_info_from_request

from .permissions import IsOwner, HasPhoneService
from .renderers import vCardRenderer
from .serializers import (
    DomainAddressSerializer,
    ProfileSerializer,
    RealPhoneSerializer,
    RelayAddressSerializer,
    RelayNumberSerializer,
    UserSerializer,
)
from .exceptions import ConflictError


schema_view = get_schema_view(
    openapi.Info(
        title="Relay API",
        default_version="v1",
        description="API endpints for Relay back-end",
        contact=openapi.Contact(email="lcrouch+relayapi@mozilla.com"),
    ),
    public=settings.DEBUG,
    permission_classes=[permissions.AllowAny],
)


class SaveToRequestUser:
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RelayAddressFilter(filters.FilterSet):
    used_on = filters.CharFilter(field_name="used_on", lookup_expr="icontains")

    class Meta:
        model = RelayAddress
        fields = [
            "enabled",
            "description",
            "generated_for",
            "block_list_emails",
            "used_on",
            # read-only
            "id",
            "address",
            "domain",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_spam",
        ]


class RelayAddressViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    serializer_class = RelayAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filterset_class = RelayAddressFilter

    def get_queryset(self):
        return RelayAddress.objects.filter(user=self.request.user)


class DomainAddressFilter(filters.FilterSet):
    used_on = filters.CharFilter(field_name="used_on", lookup_expr="icontains")

    class Meta:
        model = DomainAddress
        fields = [
            "enabled",
            "description",
            "block_list_emails",
            "used_on",
            # read-only
            "id",
            "address",
            "domain",
            "created_at",
            "last_modified_at",
            "last_used_at",
            "num_forwarded",
            "num_blocked",
            "num_spam",
        ]


class DomainAddressViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    serializer_class = DomainAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filterset_class = DomainAddressFilter

    def get_queryset(self):
        return DomainAddress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        try:
            serializer.save(user=self.request.user)
        except CannotMakeAddressException as e:
            raise exceptions.PermissionDenied(e.message)
        except IntegrityError as e:
            domain_address = DomainAddress.objects.filter(
                user=self.request.user, address=serializer.validated_data.get("address")
            ).first()
            raise ConflictError(
                {"id": domain_address.id, "full_address": domain_address.full_address}
            )


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    http_method_names = ["get", "post", "head", "put", "patch"]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    http_method_names = ["get", "head"]

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


class RealPhoneRateThrottle(throttling.UserRateThrottle):
    rate = '10/minute'


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
        valid_number, error = _validate_number(request)
        if valid_number == None:
            return response.Response(
                status=error["status"], data=error["data"]
            )
        serializer.validated_data["number"] = valid_number.phone_number

        # To make the POST API more flexible, if the request includes a
        # verification_code value, look for any un-expired record that
        # matches both the phone number and verification code and mark it
        # verified.
        verification_code = serializer.validated_data.get("verification_code")
        if verification_code:
            valid_record = RealPhone.objects.filter(
                user=request.user,
                number=serializer.validated_data["number"],
                verification_code=verification_code,
                verification_sent_date__gt=(
                    datetime.now() -
                    timedelta(0, 60*MAX_MINUTES_TO_VERIFY_REAL_PHONE)
                )
            ).first()
            if not valid_record:
                raise exceptions.ValidationError("Could not find that verification_code for user and number. It may have expired.")

            headers = self.get_success_headers(serializer.validated_data)
            verified_valid_record = valid_record.mark_verified()
            response_data = model_to_dict(verified_valid_record, fields=[
                "id", "number", "verification_sent_date", "verified",
                "verified_date"
            ])
            return response.Response(
                response_data, status=201, headers=headers
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.validated_data)
        response_data = serializer.data
        response_data["message"] = ("Sent verification code to "
            f"{valid_number.phone_number} "
            f"(country: {valid_number.country_code} "
            f"carrier: {valid_number.carrier})")
        return response.Response(
            response_data, status=201, headers=headers
        )

    # check verification_code during partial_update to compare
    # the value sent in the request against the value already on the instance
    # TODO: this logic might be able to move "up" into the model, but it will
    # need some more serious refactoring of the RealPhone.save() method
    def partial_update(self, request, *args, **kwargs):
        """
        Update the authenticated user's real phone number.

        The authenticated user must have a subscription that grants one of the
        `SUBSCRIPTIONS_WITH_PHONE` capabilities.

        The `{id}` should match a previously-`POST`ed resource.

        The `number` field should be in [E.164][e164] format which includes a country
        code.

        The `verification_code` should be the code that was texted to the
        number during the `POST`. If it matches, this endpoint will set
        `verified` to `True` for this number.

        [e164]: https://en.wikipedia.org/wiki/E.164
        """
        instance = self.get_object()
        if ("verification_code" not in request.data or
            not request.data["verification_code"] == instance.verification_code):
            raise exceptions.ValidationError("Invalid verification_code for ID. It may have expired.")

        instance.mark_verified()
        return super().partial_update(request, *args, **kwargs)


class RelayNumberViewSet(SaveToRequestUser, viewsets.ModelViewSet):
    http_method_names = ["get", "post"]
    permission_classes = [permissions.IsAuthenticated, HasPhoneService]
    serializer_class = RelayNumberSerializer
    # TODO: this doesn't seem to be working?
    throttle_classes = [RealPhoneRateThrottle]

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
        return super().create(request, *args, **kwargs)

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


def _validate_number(request):
    parsed_number = _parse_number(request.data["number"], request)
    if not parsed_number:
        country = None
        if hasattr(request, "country"):
            country = request.country
        error_message = f"number must be in E.164 format, or in local national format of the country detected: {country}"
        error = {
            "status": 400,
            "data": {
                "message": error_message
            }
        }
        return None, error

    e164_number = f"+{parsed_number.country_code}{parsed_number.national_number}"
    number_details = _get_number_details(e164_number)
    if not number_details:
        error = {
            "status": 400,
            "data": {
                "message": f"Could not get number details for {e164_number}"
            }
        }
        return None, error

    if number_details.country_code != "US":
        error = {
            "status": 400,
            "data": {
                "message": f"Relay Phone is currently only available in the US. Your phone number country code is: {number_details.country_code}"
            }
        }
        return None, error

    return number_details, None


def _parse_number(number, request):
    try:
        # First try to parse assuming number is E.164 with country prefix
        return phonenumbers.parse(number)
    except phonenumbers.phonenumberutil.NumberParseException as e:
        if (e.error_type == e.INVALID_COUNTRY_CODE and
            hasattr(request, "country")):
            try:
                # Try to parse, assuming number is local national format
                # in the detected request country
                return phonenumbers.parse(number, request.country)
            except Exception:
                return None
    return None


def _get_number_details(e164_number):
    try:
        phones_config = apps.get_app_config("phones")
        return (phones_config.twilio_client
                .lookups.v1.phone_numbers(e164_number)
                .fetch(type=["carrier"]))
    except Exception:
        return None


@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
@decorators.renderer_classes([vCardRenderer])
def vCard(request, number=None):
    """
    Get a Relay vCard. `number` should be passed in url path.

    We use this to return a vCard for a number. To prevent account
    enumeration attacks, we simply return a vCard for the phone number that
    is passed.
    """
    if number is None:
        return response.Response(status=404)

    resp = response.Response({"number": number})
    resp["Content-Disposition"] = f"attachment; filename={number}"
    return resp


# Deprecated; prefer runtime_data instead.
# (This method isn't deleted yet, because the add-on still calls it.)
@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
def premium_countries(request):
    return response.Response(get_premium_countries_info_from_request(request))


@decorators.api_view()
@decorators.permission_classes([permissions.AllowAny])
def runtime_data(request):
    flags = get_waffle_flag_model().get_all()
    flag_values = [(f.name, f.is_active(request)) for f in flags]
    switches = Switch.get_all()
    switch_values = [(s.name, s.is_active()) for s in switches]
    samples = Sample.get_all()
    sample_values = [(s.name, s.is_active()) for s in samples]
    return response.Response(
        {
            "FXA_ORIGIN": FXA_BASE_ORIGIN,
            "GOOGLE_ANALYTICS_ID": GOOGLE_ANALYTICS_ID,
            "PREMIUM_PRODUCT_ID": PREMIUM_PROD_ID,
            "PHONE_PRODUCT_ID": PHONE_PROD_ID,
            "PREMIUM_PLANS": get_premium_countries_info_from_request(request),
            "BASKET_ORIGIN": BASKET_ORIGIN,
            "WAFFLE_FLAGS": flag_values,
            "WAFFLE_SWITCHES": switch_values,
            "WAFFLE_SAMPLES": sample_values,
        }
    )

@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])
def inbound_sms(request):
    # TODO: valid request coming from Twilio:
    # https://www.twilio.com/docs/usage/security#validating-requests
    inbound_body = request.data.get("Body", None)
    inbound_from = request.data.get("From", None)
    inbound_to = request.data.get("To", None)
    if inbound_body is None or inbound_from is None or inbound_to is None:
        return response.Response(
            status=400,
            data={"message": "Message missing from, to, or body."}
        )

    relay_number = RelayNumber.objects.get(number=inbound_to)
    # FIXME: this somehow got multiple objects returned?
    real_phone = RealPhone.objects.get(user=relay_number.user)
    phones_config = apps.get_app_config("phones")
    phones_config.twilio_client.messages.create(
        from_=relay_number.number,
        body=f"[Relay 📲 {inbound_from}] {inbound_body}",
        to=real_phone.number
    )
    return response.Response(
        status=201,
        data={"message": "Relayed message to user."}
    )
