from datetime import datetime, timezone
from functools import lru_cache
from hashlib import sha256
from typing import Any, Iterable, Optional, TypedDict
import json
import logging
import os

from django.apps import apps
from django.conf import settings
from django.db import IntegrityError, connections, transaction
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, schema

from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.providers.fxa.views import FirefoxAccountsOAuth2Adapter
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from google_measurement_protocol import event, report
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error
import jwt
import sentry_sdk

# from silk.profiling.profiler import silk_profile

from emails.models import (
    CannotMakeSubdomainException,
    DomainAddress,
    RelayAddress,
    valid_available_subdomain,
)
from emails.utils import incr_if_enabled
from privaterelay.fxa_utils import _get_oauth2_session, NoSocialToken

from .apps import PrivateRelayConfig


FXA_PROFILE_CHANGE_EVENT = "https://schemas.accounts.firefox.com/event/profile-change"
FXA_SUBSCRIPTION_CHANGE_EVENT = (
    "https://schemas.accounts.firefox.com/event/subscription-state-change"
)
FXA_DELETE_EVENT = "https://schemas.accounts.firefox.com/event/delete-user"
PROFILE_EVENTS = [FXA_PROFILE_CHANGE_EVENT, FXA_SUBSCRIPTION_CHANGE_EVENT]

logger = logging.getLogger("events")
info_logger = logging.getLogger("eventsinfo")


@lru_cache(maxsize=None)
def _get_fxa(request):
    return request.user.socialaccount_set.filter(provider="fxa").first()


@api_view()
@schema(None)
@require_http_methods(["GET"])
def profile_refresh(request):
    if not request.user or request.user.is_anonymous:
        return redirect(reverse("fxa_login"))
    profile = request.user.profile

    fxa = _get_fxa(request)
    update_fxa(fxa)
    if "clicked-purchase" in request.COOKIES and profile.has_premium:
        event = "user_purchased_premium"
        incr_if_enabled(event, 1)

    return JsonResponse({})


@api_view(["POST", "GET"])
@schema(None)
@require_http_methods(["POST", "GET"])
def profile_subdomain(request):
    if not request.user or request.user.is_anonymous:
        return redirect(reverse("fxa_login"))
    profile = request.user.profile
    if not profile.has_premium:
        raise CannotMakeSubdomainException("error-premium-check-subdomain")
    try:
        if request.method == "GET":
            subdomain = request.GET.get("subdomain", None)
            available = valid_available_subdomain(subdomain)
            return JsonResponse({"available": available})
        else:
            subdomain = request.POST.get("subdomain", None)
            profile.add_subdomain(subdomain)
            return JsonResponse(
                {"status": "Accepted", "message": "success-subdomain-registered"},
                status=202,
            )
    except CannotMakeSubdomainException as e:
        return JsonResponse({"message": e.message, "subdomain": subdomain}, status=400)


def version(request):
    # If version.json is available (from Circle job), serve that
    VERSION_JSON_PATH = os.path.join(settings.BASE_DIR, "version.json")
    if os.path.isfile(VERSION_JSON_PATH):
        with open(VERSION_JSON_PATH) as version_file:
            return JsonResponse(json.load(version_file))

    # Generate version.json contents
    git_dir = os.path.join(settings.BASE_DIR, ".git")
    with open(os.path.join(git_dir, "HEAD")) as head_file:
        ref = head_file.readline().split(" ")[-1].strip()

    with open(os.path.join(git_dir, ref)) as git_hash_file:
        git_hash = git_hash_file.readline().strip()

    version_data = {
        "source": "https://github.com/groovecoder/private-relay",
        "version": git_hash,
        "commit": git_hash,
        "build": "uri to CI build job",
    }
    return JsonResponse(version_data)


def heartbeat(request):
    db_conn = connections["default"]
    assert db_conn.cursor()
    return HttpResponse("200 OK", status=200)


def lbheartbeat(request):
    return HttpResponse("200 OK", status=200)


@csrf_exempt
@require_http_methods(["POST"])
def metrics_event(request):
    try:
        request_data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"msg": "Could not decode JSON"}, status=415)
    if "ga_uuid" not in request_data:
        return JsonResponse({"msg": "No GA uuid found"}, status=404)
    # "dimension5" is a Google Analytics-specific variable to track a custom dimension,
    # used to determine which browser vendor the add-on is using: Firefox or Chrome
    # "dimension7" is a Google Analytics-specific variable to track a custom dimension,
    # used to determine where the ping is coming from: website (default), add-on or app
    event_data = event(
        request_data.get("category", None),
        request_data.get("action", None),
        request_data.get("label", None),
        request_data.get("value", None),
        dimension5=request_data.get("dimension5", None),
        dimension7=request_data.get("dimension7", "website"),
    )
    try:
        report(settings.GOOGLE_ANALYTICS_ID, request_data.get("ga_uuid"), event_data)
    except Exception as e:
        logger.error("metrics_event", extra={"error": e})
        return JsonResponse({"msg": "Unable to report metrics event."}, status=500)
    return JsonResponse({"msg": "OK"}, status=200)


@csrf_exempt
def fxa_rp_events(request: HttpRequest) -> HttpResponse:
    req_jwt = _parse_jwt_from_request(request)
    authentic_jwt = _authenticate_fxa_jwt(req_jwt)
    event_keys = _get_event_keys_from_jwt(authentic_jwt)
    try:
        social_account = _get_account_from_jwt(authentic_jwt)
    except SocialAccount.DoesNotExist as e:
        # capture an exception in sentry, but don't error, or FXA will retry
        sentry_sdk.capture_exception(e)
        return HttpResponse("202 Accepted", status=202)

    for event_key in event_keys:
        if event_key in PROFILE_EVENTS:
            if settings.DEBUG:
                info_logger.info(
                    "fxa_profile_update",
                    extra={
                        "jwt": authentic_jwt,
                        "event_key": event_key,
                    },
                )
            update_fxa(social_account, authentic_jwt, event_key)
        if event_key == FXA_DELETE_EVENT:
            _handle_fxa_delete(authentic_jwt, social_account, event_key)
    return HttpResponse("200 OK", status=200)


def _parse_jwt_from_request(request: HttpRequest) -> str:
    request_auth = request.headers["Authorization"]
    return request_auth.split("Bearer ")[1]


def fxa_verifying_keys(reload: bool = False) -> list[dict[str, Any]]:
    """Get list of FxA verifying (public) keys."""
    private_relay_config = apps.get_app_config("privaterelay")
    assert isinstance(private_relay_config, PrivateRelayConfig)
    if reload:
        private_relay_config.ready()
    return private_relay_config.fxa_verifying_keys


class FxAEvent(TypedDict):
    """
    FxA Security Event Token (SET) payload, sent to relying parties.

    See:
    https://github.com/mozilla/fxa/tree/main/packages/fxa-event-broker
    https://www.rfc-editor.org/rfc/rfc8417 (Security Event Token)
    """

    iss: str  # Issuer, https://accounts.firefox.com/
    sub: str  # Subject, FxA user ID
    aud: str  # Audience, Relay's client ID
    iat: int  # Creation time, timestamp
    jti: str  # JWT ID, unique for this SET
    events: dict[str, dict[str, Any]]  # Event data


def _authenticate_fxa_jwt(req_jwt: str) -> FxAEvent:
    authentic_jwt = _verify_jwt_with_fxa_key(req_jwt, fxa_verifying_keys())

    if not authentic_jwt:
        # FXA key may be old? re-fetch FXA keys and try again
        authentic_jwt = _verify_jwt_with_fxa_key(
            req_jwt, fxa_verifying_keys(reload=True)
        )
        if not authentic_jwt:
            raise Exception("Could not authenticate JWT with FXA key.")

    return authentic_jwt


def _verify_jwt_with_fxa_key(
    req_jwt: str, verifying_keys: list[dict[str, Any]]
) -> Optional[FxAEvent]:
    if not verifying_keys:
        raise Exception("FXA verifying keys are not available.")
    social_app = SocialApp.objects.get(provider="fxa")
    for verifying_key in verifying_keys:
        if verifying_key["alg"] == "RS256":
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(verifying_key))
            assert isinstance(public_key, RSAPublicKey)
            try:
                security_event = jwt.decode(
                    req_jwt,
                    public_key,
                    audience=social_app.client_id,
                    algorithms=["RS256"],
                    leeway=5,  # allow iat to be slightly in future, for clock skew
                )
            except jwt.ImmatureSignatureError:
                # Issue 2738: Log age of iat, if present
                claims = jwt.decode(
                    req_jwt,
                    public_key,
                    algorithms=["RS256"],
                    options={"verify_signature": False},
                )
                iat = claims.get("iat")
                iat_age = None
                if iat:
                    iat_age = round(datetime.now(tz=timezone.utc).timestamp() - iat, 3)
                info_logger.warning(
                    "fxa_rp_event.future_iat", extra={"iat": iat, "iat_age_s": iat_age}
                )
                raise
            return FxAEvent(
                iss=security_event["iss"],
                sub=security_event["sub"],
                aud=security_event["aud"],
                iat=security_event["iat"],
                jti=security_event["jti"],
                events=security_event["events"],
            )
    return None


def _get_account_from_jwt(authentic_jwt: FxAEvent) -> SocialAccount:
    social_account_uid = authentic_jwt["sub"]
    return SocialAccount.objects.get(uid=social_account_uid, provider="fxa")


def _get_event_keys_from_jwt(authentic_jwt: FxAEvent) -> Iterable[str]:
    return authentic_jwt["events"].keys()


def update_fxa(
    social_account: SocialAccount,
    authentic_jwt: Optional[FxAEvent] = None,
    event_key: Optional[str] = None,
) -> HttpResponse:
    try:
        client = _get_oauth2_session(social_account)
    except NoSocialToken as e:
        sentry_sdk.capture_exception(e)
        return HttpResponse("202 Accepted", status=202)

    # TODO: more graceful handling of profile fetch failures
    try:
        resp = client.get(FirefoxAccountsOAuth2Adapter.profile_url)
    except CustomOAuth2Error as e:
        sentry_sdk.capture_exception(e)
        return HttpResponse("202 Accepted", status=202)

    extra_data = resp.json()

    try:
        new_email = extra_data["email"]
    except KeyError as e:
        sentry_sdk.capture_exception(e)
        return HttpResponse("202 Accepted", status=202)

    if authentic_jwt and event_key:
        info_logger.info(
            "fxa_rp_event",
            extra={
                "fxa_uid": authentic_jwt["sub"],
                "event_key": event_key,
                "real_address": sha256(new_email.encode("utf-8")).hexdigest(),
            },
        )

    return _update_all_data(social_account, extra_data, new_email)


def _update_all_data(
    social_account: SocialAccount, extra_data: dict[str, Any], new_email: str
) -> HttpResponse:
    try:
        profile = social_account.user.profile
        had_premium = profile.has_premium
        had_phone = profile.has_phone
        with transaction.atomic():
            social_account.extra_data = extra_data
            social_account.save()
            profile = social_account.user.profile
            now_has_premium = profile.has_premium
            newly_premium = not had_premium and now_has_premium
            no_longer_premium = had_premium and not now_has_premium
            if newly_premium:
                incr_if_enabled("user_purchased_premium", 1)
                profile.date_subscribed = datetime.now(timezone.utc)
                profile.save()
            if no_longer_premium:
                incr_if_enabled("user_has_downgraded", 1)
            now_has_phone = profile.has_phone
            newly_phone = not had_phone and now_has_phone
            no_longer_phone = had_phone and not now_has_phone
            if newly_phone:
                incr_if_enabled("user_purchased_phone", 1)
                profile.date_subscribed_phone = datetime.now(timezone.utc)
                profile.date_phone_subscription_reset = datetime.now(timezone.utc)
                profile.save()
            if no_longer_phone:
                incr_if_enabled("user_has_dropped_phone", 1)
            social_account.user.email = new_email
            social_account.user.save()
            email_address_record = social_account.user.emailaddress_set.first()
            if email_address_record:
                email_address_record.email = new_email
                email_address_record.save()
            else:
                social_account.user.emailaddress_set.create(email=new_email)
            return HttpResponse("202 Accepted", status=202)
    except IntegrityError as e:
        sentry_sdk.capture_exception(e)
        return HttpResponse("Conflict", status=409)


def _handle_fxa_delete(
    authentic_jwt: FxAEvent, social_account: SocialAccount, event_key: str
) -> None:
    # Using for loops here because QuerySet.delete() does a bulk delete which does
    # not call the model delete() methods that create DeletedAddress records
    for relay_address in RelayAddress.objects.filter(user=social_account.user):
        relay_address.delete()
    for domain_address in DomainAddress.objects.filter(user=social_account.user):
        domain_address.delete()

    social_account.user.delete()
    info_logger.info(
        "fxa_rp_event",
        extra={
            "fxa_uid": authentic_jwt["sub"],
            "event_key": event_key,
        },
    )
