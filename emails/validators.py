"""Field validators for emails models."""

import re

from django.contrib.auth.models import User

from privaterelay.utils import flag_is_active_in_task

from .apps import BadWords, emails_config
from .exceptions import (
    AccountIsInactiveException,
    AccountIsPausedException,
    DomainAddrFreeTierException,
    DomainAddrNeedSubdomainException,
    RelayAddrFreeTierLimitException,
)

# A valid local / username part of an email address:
#   can't start or end with a hyphen
#   must be 1-63 lowercase alphanumeric characters and/or hyphens
_re_valid_address = re.compile("^(?![-.])[a-z0-9-.]{1,63}(?<![-.])$")


def badwords() -> BadWords:
    """Allow mocking of badwords in tests."""
    return emails_config().badwords


def has_bad_words(value: str) -> bool:
    """Return True if the value is a short bad word or contains a long bad word."""
    if len(value) <= 4:
        return value in badwords().short
    return any(badword in value for badword in badwords().long)


def blocklist() -> set[str]:
    """Allow mocking of blocklist in tests."""
    return emails_config().blocklist


def is_blocklisted(value: str) -> bool:
    """Return True if the value is a blocked word."""
    return value in blocklist()


def check_user_can_make_another_address(user: User) -> None:
    """Raise an exception if the user can not make a RelayAddress."""
    if not user.is_active:
        raise AccountIsInactiveException()

    if user.profile.is_flagged:
        raise AccountIsPausedException()
    # MPP-3021: return early for premium users to avoid at_max_free_aliases DB query
    if user.profile.has_premium:
        return
    if user.profile.at_max_free_aliases:
        raise RelayAddrFreeTierLimitException()


def check_user_can_make_domain_address(user: User) -> None:
    """Raise an exception if the user can not make a DomainAddress."""
    if not user.profile.has_premium:
        raise DomainAddrFreeTierException()

    if not user.profile.subdomain:
        raise DomainAddrNeedSubdomainException()

    if not user.is_active:
        raise AccountIsInactiveException()

    if user.profile.is_flagged:
        raise AccountIsPausedException()


def valid_address(address: str, domain: str, subdomain: str | None = None) -> bool:
    """Return if the given address parts make a valid Relay email."""
    from .models import DeletedAddress, address_hash

    address_pattern_valid = valid_address_pattern(address)
    address_contains_badword = has_bad_words(address)
    address_already_deleted = 0
    if not subdomain or flag_is_active_in_task(
        "custom_domain_management_redesign", None
    ):
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=address_hash(address, domain=domain, subdomain=subdomain)
        ).count()
    if (
        address_already_deleted > 0
        or address_contains_badword
        or not address_pattern_valid
    ):
        return False
    return True


def valid_address_pattern(address: str) -> bool:
    """Return if the local/user part of an address is valid."""
    return _re_valid_address.match(address) is not None
