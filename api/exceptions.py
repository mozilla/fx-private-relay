from typing import Union

from rest_framework import status
from rest_framework.exceptions import APIException


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Request conflicts with current state of the target resource."
    default_code = "conflict_error"


class DomainAddressConflictError(ConflictError):
    default_detail = "This domain address already exists."

    def __init__(
        self, existing_id: int | None = None, existing_address: str | None = None
    ) -> None:
        self.existing_id = existing_id
        self.existing_address = existing_address
        super().__init__()


ErrorContextType = dict[str, Union[int, str]]


class RelayAPIException(APIException):
    """Base class for exceptions that may be returned through API"""

    def error_context(self) -> ErrorContextType:
        """Return context variables for client-side translation."""
        return {}
