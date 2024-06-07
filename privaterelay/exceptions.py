"""Exceptions raised by the privaterelay app"""

from django.core.exceptions import BadRequest


class CannotMakeSubdomainException(BadRequest):
    """Exception raised by Profile due to error on subdomain creation.

    Attributes:
        message -- optional explanation of the error
    """

    def __init__(self, message: str | None = None) -> None:
        self.message = message
