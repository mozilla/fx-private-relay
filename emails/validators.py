"""Field validators for emails models."""

import re
from typing import Any

from .apps import emails_config
from .exceptions import CannotMakeSubdomainException

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
