"""Field validators for emails models."""

import re
from typing import Any

from privaterelay.utils import flag_is_active_in_task

from .apps import emails_config
from .exceptions import CannotMakeSubdomainException

# A valid local / username part of an email address:
#   can't start or end with a hyphen
#   must be 1-63 lowercase alphanumeric characters and/or hyphens
_re_valid_address = re.compile("^(?![-.])[a-z0-9-.]{1,63}(?<![-.])$")

# A valid subdomain:
#   can't start or end with a hyphen
#   must be 1-63 alphanumeric characters and/or hyphens
_re_valid_subdomain = re.compile("^(?!-)[a-z0-9-]{1,63}(?<!-)$")


def badwords() -> list[str]:
    """Allow mocking of badwords in tests."""
    return emails_config().badwords


def has_bad_words(value: str) -> bool:
    """Return True if the value is a short bad word or contains a long bad word."""
    for badword in badwords():
        badword = badword.strip()
        if len(badword) <= 4 and badword == value:
            return True
        if len(badword) > 4 and badword in value:
            return True
    return False


def blocklist() -> list[str]:
    """Allow mocking of blocklist in tests."""
    return emails_config().blocklist


def is_blocklisted(value: str) -> bool:
    """Return True if the value is a blocked word."""
    return any(blockedword == value for blockedword in blocklist())


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


def valid_available_subdomain(subdomain: Any) -> None:
    """Raise CannotMakeSubdomainException if the subdomain fails a validation test."""
    from .models import RegisteredSubdomain, hash_subdomain

    if not subdomain:
        raise CannotMakeSubdomainException("error-subdomain-cannot-be-empty-or-null")
    subdomain = str(subdomain).lower()

    # valid subdomains:
    #   have to meet the rules for length and characters
    valid = _re_valid_subdomain.match(subdomain) is not None
    #   can't have "bad" words in them
    bad_word = has_bad_words(subdomain)
    #   can't have "blocked" words in them
    blocked_word = is_blocklisted(subdomain)
    #   can't be taken by someone else
    taken = (
        RegisteredSubdomain.objects.filter(
            subdomain_hash=hash_subdomain(subdomain)
        ).count()
        > 0
    )
    if not valid or bad_word or blocked_word or taken:
        raise CannotMakeSubdomainException("error-subdomain-not-available")
