"""Relay interface to EventsServerEventLogger generated by glean_parser."""

from __future__ import annotations
from datetime import datetime
from logging import getLogger
from typing import Any, Literal, NamedTuple

from django.conf import settings
from django.contrib.auth.models import User
from django.http import HttpRequest

from ipware import get_client_ip

from emails.models import DomainAddress, RelayAddress
from .glean.server_events import EventsServerEventLogger, GLEAN_EVENT_MOZLOG_TYPE
from .types import RELAY_CHANNEL_NAME


def _opt_dt_to_glean(value: datetime | None) -> int:
    return -1 if value is None else int(value.timestamp())


def _opt_str_to_glean(value: str | None) -> str:
    return "" if value is None else value


class RequestData(NamedTuple):
    user_agent: str | None = None
    ip_address: str | None = None

    @classmethod
    def from_request(cls, request: HttpRequest) -> RequestData:
        user_agent = request.headers.get("user-agent", None)
        client_ip, is_routable = get_client_ip(request)
        ip_address = client_ip if (client_ip and is_routable) else None
        return cls(user_agent=user_agent, ip_address=ip_address)


class UserData(NamedTuple):
    fxa_id: str | None
    n_random_masks: int
    n_domain_masks: int
    n_deleted_random_masks: int
    n_deleted_domain_masks: int
    date_joined_relay: datetime | None
    date_joined_premium: datetime | None
    premium_status: str
    has_extension: bool
    date_got_extension: datetime | None

    @classmethod
    def from_user(cls, user: User) -> UserData:
        fxa_id = user.profile.fxa.uid if user.profile.fxa else None
        n_random_masks = user.relayaddress_set.count()
        n_domain_masks = user.domainaddress_set.count()
        n_deleted_random_masks = user.profile.num_deleted_relay_addresses
        n_deleted_domain_masks = user.profile.num_deleted_domain_addresses
        date_joined_relay = user.date_joined
        if user.profile.has_premium:
            if user.profile.has_phone:
                date_joined_premium = user.profile.date_subscribed_phone
            else:
                date_joined_premium = user.profile.date_subscribed
        else:
            date_joined_premium = None
        premium_status = user.profile.metrics_premium_status
        try:
            earliest_mask = user.relayaddress_set.exclude(
                generated_for__exact=""
            ).earliest("created_at")
        except RelayAddress.DoesNotExist:
            has_extension = False
            date_got_extension = None
        else:
            has_extension = True
            date_got_extension = earliest_mask.created_at

        return cls(
            fxa_id=fxa_id,
            n_random_masks=n_random_masks,
            n_domain_masks=n_domain_masks,
            n_deleted_random_masks=n_deleted_random_masks,
            n_deleted_domain_masks=n_deleted_domain_masks,
            date_joined_relay=date_joined_relay,
            date_joined_premium=date_joined_premium,
            premium_status=premium_status,
            has_extension=has_extension,
            date_got_extension=date_got_extension,
        )


class MaskData(NamedTuple):
    mask_id: str
    is_random_mask: bool
    has_website: bool

    @classmethod
    def from_mask(cls, mask: RelayAddress | DomainAddress) -> MaskData:
        mask_id = mask.metrics_id
        if isinstance(mask, RelayAddress):
            is_random_mask = True
            has_website = bool(mask.generated_for)
        else:
            is_random_mask = False
            has_website = False
        return MaskData(
            mask_id=mask_id, is_random_mask=is_random_mask, has_website=has_website
        )


EmailBlockedReason = Literal[
    "auto_block_spam",  # Email identified as spam, user has the auto_block_spam flag
    "dmarc_reject_failed",  # Email failed DMARC check with a reject policy
    "hard_bounce_pause",  # The user recently had a hard bounce
    "soft_bounce_pause",  # The user recently has a soft bounce
    # "abuse_flag",  # The user exceeded an abuse limit, like mails forwarded
    # "block_all",  # The mask is set to block all mail
    # "block_promotional",  # The mask is set to block promotional / list mail
    # "reply_requires_premium",  # The email is a reply from a free user
    # "no_reply_header",  # The email is a reply without the required header
    # "no_reply_record",  # The email is a reply without a database match
    # "send_fail",  # AWS rejected the email
]


class RelayGleanLogger(EventsServerEventLogger):
    def __init__(
        self,
        application_id: str,
        app_display_version: str,
        channel: RELAY_CHANNEL_NAME,
    ):
        assert settings.GLEAN_EVENT_MOZLOG_TYPE == GLEAN_EVENT_MOZLOG_TYPE
        self._logger = getLogger(GLEAN_EVENT_MOZLOG_TYPE)
        super().__init__(
            application_id=application_id,
            app_display_version=app_display_version,
            channel=channel,
        )

    def log_email_mask_created(
        self,
        *,
        request: HttpRequest | None = None,
        mask: RelayAddress | DomainAddress,
        created_by_api: bool,
    ) -> None:
        request_data = RequestData.from_request(request) if request else RequestData()
        user_data = UserData.from_user(mask.user)
        mask_data = MaskData.from_mask(mask)
        self.record_email_mask_created(
            user_agent=_opt_str_to_glean(request_data.user_agent),
            ip_address=_opt_str_to_glean(request_data.ip_address),
            client_id="",
            fxa_id=_opt_str_to_glean(user_data.fxa_id),
            platform="",
            n_random_masks=user_data.n_random_masks,
            n_domain_masks=user_data.n_domain_masks,
            n_deleted_random_masks=user_data.n_deleted_random_masks,
            n_deleted_domain_masks=user_data.n_deleted_domain_masks,
            date_joined_relay=_opt_dt_to_glean(user_data.date_joined_relay),
            premium_status=user_data.premium_status,
            date_joined_premium=_opt_dt_to_glean(user_data.date_joined_premium),
            has_extension=user_data.has_extension,
            date_got_extension=_opt_dt_to_glean(user_data.date_got_extension),
            mask_id=mask_data.mask_id,
            is_random_mask=mask_data.is_random_mask,
            created_by_api=created_by_api,
            has_website=mask_data.has_website,
        )

    def log_email_mask_label_updated(
        self,
        *,
        request: HttpRequest,
        mask: RelayAddress | DomainAddress,
    ) -> None:
        request_data = RequestData.from_request(request)
        user_data = UserData.from_user(mask.user)
        mask_data = MaskData.from_mask(mask)
        self.record_email_mask_label_updated(
            user_agent=_opt_str_to_glean(request_data.user_agent),
            ip_address=_opt_str_to_glean(request_data.ip_address),
            client_id="",
            fxa_id=_opt_str_to_glean(user_data.fxa_id),
            platform="",
            n_random_masks=user_data.n_random_masks,
            n_domain_masks=user_data.n_domain_masks,
            n_deleted_random_masks=user_data.n_deleted_random_masks,
            n_deleted_domain_masks=user_data.n_deleted_domain_masks,
            date_joined_relay=_opt_dt_to_glean(user_data.date_joined_relay),
            premium_status=user_data.premium_status,
            date_joined_premium=_opt_dt_to_glean(user_data.date_joined_premium),
            has_extension=user_data.has_extension,
            date_got_extension=_opt_dt_to_glean(user_data.date_got_extension),
            mask_id=mask_data.mask_id,
            is_random_mask=mask_data.is_random_mask,
        )

    def log_email_mask_deleted(
        self,
        *,
        request: HttpRequest,
        user: User,
        mask_id: str,
        is_random_mask: bool,
    ) -> None:
        request_data = RequestData.from_request(request)
        user_data = UserData.from_user(user)
        self.record_email_mask_deleted(
            user_agent=_opt_str_to_glean(request_data.user_agent),
            ip_address=_opt_str_to_glean(request_data.ip_address),
            client_id="",
            fxa_id=_opt_str_to_glean(user_data.fxa_id),
            platform="",
            n_random_masks=user_data.n_random_masks,
            n_domain_masks=user_data.n_domain_masks,
            n_deleted_random_masks=user_data.n_deleted_random_masks,
            n_deleted_domain_masks=user_data.n_deleted_domain_masks,
            date_joined_relay=_opt_dt_to_glean(user_data.date_joined_relay),
            premium_status=user_data.premium_status,
            date_joined_premium=_opt_dt_to_glean(user_data.date_joined_premium),
            has_extension=user_data.has_extension,
            date_got_extension=_opt_dt_to_glean(user_data.date_got_extension),
            mask_id=mask_id,
            is_random_mask=is_random_mask,
        )

    def log_email_blocked(
        self,
        *,
        mask: RelayAddress | DomainAddress,
        is_reply: bool,
        reason: EmailBlockedReason,
    ) -> None:
        request_data = RequestData()
        user_data = UserData.from_user(mask.user)
        mask_data = MaskData.from_mask(mask)
        self.record_email_blocked(
            user_agent=_opt_str_to_glean(request_data.user_agent),
            ip_address=_opt_str_to_glean(request_data.ip_address),
            client_id="",
            fxa_id=_opt_str_to_glean(user_data.fxa_id),
            platform="",
            n_random_masks=user_data.n_random_masks,
            n_domain_masks=user_data.n_domain_masks,
            n_deleted_random_masks=user_data.n_deleted_random_masks,
            n_deleted_domain_masks=user_data.n_deleted_domain_masks,
            date_joined_relay=_opt_dt_to_glean(user_data.date_joined_relay),
            premium_status=user_data.premium_status,
            date_joined_premium=_opt_dt_to_glean(user_data.date_joined_premium),
            has_extension=user_data.has_extension,
            date_got_extension=_opt_dt_to_glean(user_data.date_got_extension),
            mask_id=mask_data.mask_id,
            is_random_mask=mask_data.is_random_mask,
            is_reply=is_reply,
            reason=reason,
        )

    def emit_record(self, now: datetime, ping: dict[str, Any]) -> None:
        """Emit record as a log instead of a print()"""
        self._logger.info(GLEAN_EVENT_MOZLOG_TYPE, extra=ping)
