"""Tests for emails.policy"""

from email import message_from_string, errors
from typing_extensions import TypedDict

import pytest

from emails.policy import relay_policy

from .views_tests import EMAIL_INCOMING


class NonComplaintHeaderDetails(TypedDict):
    defect_count: int
    defect_types: list[type]
    parsed_value: str
    unstructured_value: str


class NonComplaintHeaderCase(TypedDict):
    email_id: str
    non_compliant_headers: dict[str, NonComplaintHeaderDetails]


NON_COMPLIANT_HEADER_PARSING_CASES: dict[str, NonComplaintHeaderCase] = {
    "invalid_message_id_with_brackets": {
        "email_id": "message_id_in_brackets",
        "non_compliant_headers": {
            "Message-ID": {
                "defect_count": 1,
                "defect_types": [errors.InvalidHeaderDefect],
                "parsed_value": "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>",
                "unstructured_value": (
                    "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>"
                ),
            }
        },
    },
    "invalid_from_with_unquoted_comma": {
        "email_id": "emperor_norton",
        "non_compliant_headers": {
            "From": {
                "defect_count": 4,
                "defect_types": [errors.InvalidHeaderDefect],
                "parsed_value": (
                    '"Norton I.",'
                    " Emperor of the United States <norton@sf.us.example.com>"
                ),
                "unstructured_value": (
                    "Norton I., Emperor of the United States <norton@sf.us.example.com>"
                ),
            }
        },
    },
    "invalid_from_with_nested_brackets": {
        "email_id": "nested_brackets_service",
        "non_compliant_headers": {
            "From": {
                "defect_count": 7,
                "defect_types": [
                    errors.InvalidHeaderDefect,
                    errors.ObsoleteHeaderDefect,
                ],
                "parsed_value": 'The Service <"The Service">',
                "unstructured_value": (
                    "The Service <The Service <hello@theservice.example.com>>"
                ),
            }
        },
    },
}


@pytest.mark.parametrize(
    "params",
    NON_COMPLIANT_HEADER_PARSING_CASES.values(),
    ids=list(NON_COMPLIANT_HEADER_PARSING_CASES.keys()),
)
def test_non_compliant_header_parsing(params: NonComplaintHeaderCase) -> None:
    email_id = params["email_id"]
    non_compliant_headers = params["non_compliant_headers"]
    email_in_text = EMAIL_INCOMING[email_id]
    email = message_from_string(email_in_text, policy=relay_policy)
    for header_name, value in email.items():
        if header_name in non_compliant_headers:
            details = non_compliant_headers[header_name]
            assert len(value.defects) == details["defect_count"]
            for defect_num, defect in enumerate(value.defects):
                assert isinstance(defect, tuple(details["defect_types"]))
            assert str(value) == details["parsed_value"]
            assert str(value.as_unstructured) == details["unstructured_value"]
        else:
            assert len(value.defects) == 0


@pytest.mark.parametrize("email_id", ["plain_text", "russian_spam", "inline_image"])
def test_compliant_header_parsing(email_id: str) -> None:
    email_in_text = EMAIL_INCOMING[email_id]
    email = message_from_string(email_in_text, policy=relay_policy)
    for header_name, value in email.items():
        assert len(value.defects) == 0
