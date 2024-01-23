from typing import Any, TypedDict

from rest_framework import status
from rest_framework.exceptions import APIException

from privaterelay.ftl_bundles import main as ftl_bundle


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Request conflicts with current state of the target resource."
    default_code = "conflict_error"


ErrorContextType = dict[str, int | str]


class OptionalErrorData(TypedDict, total=False):
    error_context: ErrorContextType


class ErrorData(OptionalErrorData):
    detail: str
    error_code: str | list[Any] | dict[str, Any] | None


class RelayAPIException(APIException):
    """Base class for exceptions that may be returned through API"""

    def error_context(self) -> ErrorContextType:
        """Return context variables for client-side translation."""
        return {}

    def error_data(self) -> ErrorData:
        """Return extra data for API error responses."""

        # For RelayAPIException classes, this should always be a string
        error_code = self.get_codes()
        assert isinstance(error_code, str)

        # Build the Fluent error ID
        ftl_id_sub = "api-error-"
        ftl_id_error = error_code.replace("_", "-")
        ftl_id = ftl_id_sub + ftl_id_error

        # Replace the default message with the translated Fluent string
        error_context = self.error_context()
        translated_detail = ftl_bundle.format(ftl_id, error_context)

        error_data = ErrorData(detail=translated_detail, error_code=error_code)
        if error_context:
            error_data["error_context"] = error_context
        return error_data
