import re
from typing import Any

from emails.validators import has_bad_words, is_blocklisted

from .exceptions import CannotMakeSubdomainException

# A valid subdomain:
#   can't start or end with a hyphen
#   must be 1-63 alphanumeric characters and/or hyphens
_re_valid_subdomain = re.compile("^(?!-)[a-z0-9-]{1,63}(?<!-)$")


def valid_available_subdomain(subdomain: Any) -> None:
    """Raise CannotMakeSubdomainException if the subdomain fails a validation test."""
    from privaterelay.models import RegisteredSubdomain

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
    taken = RegisteredSubdomain.is_taken(subdomain)
    if not valid or bad_word or blocked_word or taken:
        raise CannotMakeSubdomainException("error-subdomain-not-available")
