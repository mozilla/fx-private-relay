from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypedDict

from rest_framework import status
from rest_framework.exceptions import APIException

from privaterelay.ftl_bundles import main as ftl_bundle

if TYPE_CHECKING:
    # Provided by djangorestframework-stubs
    # https://github.com/typeddjango/djangorestframework-stubs/blob/master/rest_framework-stubs/exceptions.pyi
    from rest_framework.exceptions import _APIExceptionInput


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
    """
    Base class for exceptions that may be returned through the API.

    Derived classes should set `default_code` to a unique string identifying the
    exception. There should be a matching Fluent string with an `api-error-`
    prefix. For example, the Fluent string "api-error-free-tier-limit" matches
    the exception class with the default_code "free-tier-limit". These Fluent
    strings are in misc.ftl.

    Derived classes can set `default_detail` to a human-readable string, or they
    can set `default_detail_template` to dynamically create the string from extra
    context. When using default_detail_template, the Fluent string should use the same
    variable names.

    Derived classes can set `status_code` to the HTTP status code, or accept the
    APIException default of 500 for a Server Error.
    """

    default_code: str
    default_detail: str
    status_code: int

    def __init__(
        self, detail: _APIExceptionInput = None, code: str | None = None
    ) -> None:
        """Check that derived classes have set the required data."""
        if not isinstance(self.default_code, str):
            raise TypeError("default_code must be type str")
        if not isinstance(self.status_code, int):
            raise TypeError("self.status_code must be type int")
        if hasattr(self, "default_detail_template"):
            context = self.error_context()
            if not context:
                raise ValueError("error_context is required")
            self.default_detail = self.default_detail_template.format(**context)
        if not isinstance(self.default_detail, str):
            raise TypeError("self.default_detail must be type str")
        super().__init__(detail, code)

    def error_context(self) -> ErrorContextType:
        """Return context variables for client-side translation."""
        return {}

    def error_data(self) -> ErrorData:
        """Return extra data for API error responses."""

        # For RelayAPIException classes, this is the default_code and is a string
        error_code = self.get_codes()
        if not isinstance(error_code, str):
            raise TypeError("error_code must be type str")

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
