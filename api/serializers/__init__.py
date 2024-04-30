"""Shared API serializer code."""

from rest_framework.serializers import ErrorDetail, ValidationError


class StrictReadOnlyFieldsMixin:
    """
    Raises a validation error (400) if read only fields are in the body of PUT/PATCH
    requests.

    This class comes from
    https://github.com/encode/django-rest-framework/issues/1655#issuecomment-1197033853,
    where different solutions to mitigating 200 response codes in read-only fields are
    discussed.
    """

    def validate(self, attrs):
        # Mixins and mypy make for weird code....
        attrs = getattr(super(), "validate", lambda x: x)(attrs)
        if not (
            hasattr(self, "initial_data")
            and hasattr(self, "fields")
            and hasattr(self, "Meta")
            and hasattr(self.Meta, "model")
            and hasattr(self.Meta, "read_only_fields")
        ):
            return attrs

        # Getting the declared read only fields and read only fields from Meta
        read_only_fields = {
            field_name for field_name, field in self.fields.items() if field.read_only
        }.union(set(getattr(self.Meta, "read_only_fields", set())))

        # Getting implicit read only fields that are in the Profile model, but were not
        # defined in the serializer.  By default, they won't update if put in the body
        # of a request, but they still give a 200 response (which we don't want).
        implicit_read_only_fields = {
            field for field in vars(self.Meta.model) if field not in self.fields
        }

        received_read_only_fields = set(self.initial_data).intersection(
            read_only_fields.union(implicit_read_only_fields)
        )

        if received_read_only_fields:
            errors = {}
            for field_name in received_read_only_fields:
                errors[field_name] = ErrorDetail(
                    "This field is read only", code="read_only"
                )

            raise ValidationError(errors)

        return attrs
