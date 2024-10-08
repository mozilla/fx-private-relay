"""Exceptions raised by emails app"""

from django.conf import settings

from api.exceptions import ErrorContextType, RelayAPIException


class CannotMakeAddressException(RelayAPIException):
    """Base exception for RelayAddress or DomainAddress creation failure."""


class AccountIsPausedException(CannotMakeAddressException):
    default_code = "account_is_paused"
    default_detail = "Your account is on pause."
    ftl_id = "api-error-account-is-paused"
    status_code = 403


class AccountIsInactiveException(CannotMakeAddressException):
    default_code = "account_is_inactive"
    default_detail = "Your account is not active."
    ftl_id = "api-error-account-is-inactive"
    status_code = 403


class RelayAddrFreeTierLimitException(CannotMakeAddressException):
    default_code = "free_tier_limit"
    default_detail_template = (
        "You’ve used all {free_tier_limit} email masks included with your free account."
        " You can reuse an existing mask, but using a unique mask for each account is"
        " the most secure option."
    )
    ftl_id = "api-error-free-tier-limit"
    status_code = 403

    def __init__(self, free_tier_limit: int | None = None):
        self.free_tier_limit = free_tier_limit or settings.MAX_NUM_FREE_ALIASES
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"free_tier_limit": self.free_tier_limit}


class DomainAddrFreeTierException(CannotMakeAddressException):
    default_code = "free_tier_no_subdomain_masks"
    default_detail = (
        "Your free account does not include custom subdomains for masks."
        " To create custom masks, upgrade to Relay Premium."
    )
    ftl_id = "api-error-free-tier-no-subdomain-masks"
    status_code = 403


class DomainAddrNeedSubdomainException(CannotMakeAddressException):
    default_code = "need_subdomain"
    default_detail = "Please select a subdomain before creating a custom email address."
    ftl_id = "api-error-need-subdomain"
    status_code = 400


class DomainAddrUpdateException(CannotMakeAddressException):
    """Exception raised when attempting to edit an existing domain address field."""

    default_code = "address_not_editable"
    default_detail = "You cannot edit an existing domain address field."
    ftl_id = "api-error-address-not-editable"
    status_code = 400


class DomainAddrUnavailableException(CannotMakeAddressException):
    default_code = "address_unavailable"
    default_detail_template = (
        "“{unavailable_address}” could not be created."
        " Please try again with a different mask name."
    )
    ftl_id = "api-error-address-unavailable"
    status_code = 400

    def __init__(self, unavailable_address: str):
        self.unavailable_address = unavailable_address
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"unavailable_address": self.unavailable_address}


class DomainAddrDuplicateException(CannotMakeAddressException):
    default_code = "duplicate_address"
    default_detail_template = (
        "“{duplicate_address}” already exists."
        " Please try again with a different mask name."
    )
    ftl_id = "api-error-duplicate-address"
    status_code = 409

    def __init__(self, duplicate_address: str):
        self.duplicate_address = duplicate_address
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"duplicate_address": self.duplicate_address}
