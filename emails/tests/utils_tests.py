import base64
import json
import random
import signal
import zlib
from base64 import b64encode
from types import FrameType
from typing import Literal, TypedDict
from unittest.mock import patch
from urllib.parse import quote_plus

from django.test import TestCase, override_settings

import pytest

from emails.utils import (
    InvalidFromHeader,
    canonicalize_url_hosts,
    decode_dict_gza85,
    encode_dict_gza85,
    find_tracker_domain,
    generate_from_header,
    get_domains_from_settings,
    get_email_domain_from_settings,
    parse_email_header,
    remove_trackers,
)


class GetEmailDomainFromSettingsTest(TestCase):
    @override_settings(RELAY_CHANNEL="test", SITE_ORIGIN="https://test.com")
    def test_get_email_domain_from_settings(self) -> None:
        email_domain = get_email_domain_from_settings()
        assert "test.com" == email_domain

    @override_settings(RELAY_FIREFOX_DOMAIN="firefox.com", MOZMAIL_DOMAIN="mozmail.com")
    def test_get_domains_from_settings(self) -> None:
        domains = get_domains_from_settings()
        assert domains == {
            "RELAY_FIREFOX_DOMAIN": "default.com",
            "MOZMAIL_DOMAIN": "test.com",
        }


def _encode_as_base64_utf8_str(value: str) -> str:
    """Encode a string in UTF-8 binary (base64), like an email header"""
    b64 = b64encode(value.encode()).decode()
    return f"=?utf-8?b?{b64}?="


# Test cases for test_generate_from_header
# key: The pytest test ID
# value: a dictionary with the test params:
#   in_from: The From: header in the original message
#   in_to: The To: header in the original message (the Relay mask)
#   out_from: The From: header returned by generate_from_header
_GENERATE_FROM_TEST_CASE_DEF = dict[Literal["in_from", "in_to", "out_from"], str]
GENERATE_FROM_TEST_CASES: dict[str, _GENERATE_FROM_TEST_CASE_DEF] = {
    "with_umlaut": {
        "in_from": '"foö bär" <foo@bar.com>',
        "in_to": "mask@relay.example.com",
        "out_from": _encode_as_base64_utf8_str("foö bär <foo@bar.com> [via Relay]")
        + " <mask@relay.example.com>",
    },
    "realistic_address": {
        "in_from": "something real <somethingreal@protonmail.com>",
        "in_to": "ab12dc34@relay.example.com",
        "out_from": (
            '"something real <somethingreal@protonmail.com> [via Relay]"'
            " <ab12dc34@relay.example.com>"
        ),
    },
    "just_email": {
        "in_from": "foo@bar.example.com",
        "in_to": "foobar@premium.relay.example.com",
        "out_from": (
            '"foo@bar.example.com [via Relay]" <foobar@premium.relay.example.com>'
        ),
    },
    "too_long_original_address": {
        "in_from": f"l{'o' * 90}ng <long@long.example.com>",
        "in_to": (
            "my_very_long_custom_alias@my_very_long_premium_name.relay.example.com"
        ),
        "out_from": (
            f'"l{"o" * 67}... <long@long.example.com> [via Relay]"'
            " <my_very_long_custom_alias@my_very_long_premium_name.relay.example.com>"
        ),
    },
    "too_long_with_umlat": {
        "in_from": f"l{'ö' * 90}ng <long-umlat@long.example.com>",
        "in_to": "umlat123@relay.example.com",
        "out_from": (
            _encode_as_base64_utf8_str(
                f"l{'ö' * 69}… <long-umlat@long.example.com> [via Relay]"
            )
            + " <umlat123@relay.example.com>"
        ),
    },
    "with_linebreak_chars": {
        "in_from": '"Ter\ry \n ct\u2028" <info@lines.example.org>',
        "in_to": "xyz987@relay.example.com",
        "out_from": (
            '"Tery  ct <info@lines.example.org> [via Relay]" <xyz987@relay.example.com>'
        ),
    },
    "exactly_long": {
        "in_from": (
            "This_display_name_is_exactly_71_characters_long_and_no_more__I_promise!"
            " <exact@jerk.example.com>"
        ),
        "in_to": "from_the_jerk@mysubdomain.relay.example.com",
        "out_from": (
            '"This_display_name_is_exactly_71_characters_long_and_no_more__I_promise!'
            ' <exact@jerk.example.com> [via Relay]"'
            " <from_the_jerk@mysubdomain.relay.example.com>"
        ),
    },
}


@pytest.mark.parametrize(
    "params", GENERATE_FROM_TEST_CASES.values(), ids=GENERATE_FROM_TEST_CASES.keys()
)
def test_generate_from_header(params: _GENERATE_FROM_TEST_CASE_DEF) -> None:
    from_header = generate_from_header(params["in_from"], params["in_to"])
    assert from_header == params["out_from"]
    if "=?utf-8?b?" in from_header:
        max_length = 266  # utf-8, base64 encoding maximum
    else:
        max_length = 78
    first_part, rest = from_header.split(" ", 1)
    header_line = f"From: {first_part}"
    assert len(header_line) <= max_length


GENERATE_FROM_HEADER_RAISES_CASES = {
    "no_domain": '"I am groot" <groot>',
    "no_address": '"I am groot" <>',
    "utf_8_encoded": _encode_as_base64_utf8_str('"I am groot" <groot@groot.gr>'),
}


@pytest.mark.parametrize(
    "address",
    GENERATE_FROM_HEADER_RAISES_CASES.values(),
    ids=GENERATE_FROM_HEADER_RAISES_CASES.keys(),
)
def test_generate_from_header_raises(address: str) -> None:
    with pytest.raises(InvalidFromHeader):
        generate_from_header(address, "failures@relay.example.com")


class ParseEmailHeaderCase(TypedDict):
    header_value: str
    expected_out: list[tuple[str, str]]


PARSE_EMAIL_HEADER_CASES: dict[str, ParseEmailHeaderCase] = {
    "email_only": {
        "header_value": "email_only@simple.example.com",
        "expected_out": [("", "email_only@simple.example.com")],
    },
    "display_name": {
        "header_value": '"Display Name" <local@email.example.com>',
        "expected_out": [("Display Name", "local@email.example.com")],
    },
    "two_emails": {
        "header_value": 'one@multiple.example.com, "Two" <two@multiple.example.com>',
        "expected_out": [
            ("", "one@multiple.example.com"),
            ("Two", "two@multiple.example.com"),
        ],
    },
    "display_name_no_quotes": {
        "header_value": "Display Name <local@email.example.com>",
        "expected_out": [("Display Name", "local@email.example.com")],
    },
    "display_name_with_comma": {
        "header_value": (
            '"Norton I., Emperor of the United States" <norton@us.example.com>'
        ),
        "expected_out": [
            ("Norton I., Emperor of the United States", "norton@us.example.com")
        ],
    },
    "display_name_with_comma_but_no_quotes": {
        "header_value": (
            "Norton I., Emperor of the United States <norton@sf.us.example.com>"
        ),
        "expected_out": [("Emperor of the United States", "norton@sf.us.example.com")],
    },
    "nested_brackets": {
        "header_value": "Nesting Bird <Nesting Bird <nesting@bird.example.com>>",
        "expected_out": [],
    },
    "windows_1252_encoding": {
        "header_value": (
            "=?windows-1252?Q?sos_accessoire_\\(Place_de_march=E9_Cdiscount\\)_?="
            " <vendeur@sn.example.com>"
        ),
        "expected_out": [
            (
                "sos accessoire \\(Place de marché Cdiscount\\) ",
                "vendeur@sn.example.com",
            ),
        ],
    },
}


@pytest.mark.parametrize(
    "params",
    PARSE_EMAIL_HEADER_CASES.values(),
    ids=PARSE_EMAIL_HEADER_CASES.keys(),
)
def test_parse_email_header(params: ParseEmailHeaderCase) -> None:
    out = parse_email_header(params["header_value"])
    assert out == params["expected_out"]


@override_settings(SITE_ORIGIN="https://test.com")
class RemoveTrackers(TestCase):
    url = "https://test.com/contains-tracker-warning/#"
    hyperlink_simple = "https://open.tracker.com/foo/bar.html"
    imagelink_simple = "https://open.tracker.com/foo/bar.jpg"
    hyperlink_complex = "https://foo.open.tracker.com/foo/bar.html"
    imagelink_complex = "https://bar.open.tracker.com/foo/bar.jpg"
    hyperlink_tracker_in_tracker = (
        "https://foo.open.tracker.com/foo/bar.html?src=trckr.com"
    )
    from_address = "spammer@email.com"
    datetime_now = "1682472064"

    def url_trackerwarning_data(self, link):
        return quote_plus(
            json.dumps(
                {
                    "sender": "spammer@email.com",
                    "received_at": "1682472064",
                    "original_link": link,
                },
                separators=(",", ":"),
            )
        )

    def expected_content(self, hyperlink, imagelink):
        return (
            f'<a href="{self.url}{self.url_trackerwarning_data(hyperlink)}">'
            "A link</a>\n"
            f'<img src="{self.url}{self.url_trackerwarning_data(imagelink)}">'
            "An image</img>"
        )

    def setUp(self):
        self.patcher1 = patch(
            "emails.utils.general_trackers",
            return_value=["trckr.com", "open.tracker.com"],
        )
        self.patcher2 = patch(
            "emails.utils.strict_trackers", return_value=["strict.tracker.com"]
        )
        self.mock_general_trackers = self.patcher1.start()
        self.mock_strict_trackers = self.patcher2.start()
        self.addCleanup(self.patcher1.stop)
        self.addCleanup(self.patcher2.stop)

    def test_simple_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content(
            self.hyperlink_simple, self.imagelink_simple
        )
        assert general_removed == 2
        assert general_count == 2

    def test_complex_general_tracker_replaced_with_relay_content(self):
        content = (
            '<a href="https://foo.open.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://bar.open.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content(
            self.hyperlink_complex, self.imagelink_complex
        )
        assert general_removed == 2
        assert general_count == 2

    def test_complex_single_quote_general_tracker_replaced_with_relay_content(self):
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html'>A link</a>\n"
            + "<img src='https://bar.open.tracker.com/foo/bar.jpg'>An image</img>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == self.expected_content(
            self.hyperlink_complex, self.imagelink_complex
        ).replace('"', "'")
        assert general_removed == 2
        assert general_count == 2

    def test_no_tracker_replaced_with_relay_content(self):
        content = (
            "<a href='https://fooopen.tracker.com/foo/bar.html'>A link</a>\n"
            + "<img src='https://baropen.tracker.com/foo/bar.jpg'>An image</img>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert (
            general_count == general_removed
        )  # count uses the same regex pattern as removing trackers

    def test_general_tracker_embedded_in_another_tracker_replaced_only_once(self):
        """
        Test that a general tracker embedded in the URL of another tracker is
        replaced only once with the relay content.
        """
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html?src=trckr.com'>"
            "A link</a>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        expected_content = (
            f"<a href='{self.url}"
            f"{self.url_trackerwarning_data(self.hyperlink_tracker_in_tracker)}'>"
            "A link</a>"
        )
        assert changed_content == expected_content
        assert general_removed == 1
        assert general_count == 1

    def test_general_tracker_also_in_text_tracker_replaced_only_once(self):
        """
        Test that a general tracker embedded in another tracker, and also in the text
        of the link, is replaced only once with the relay content.
        """
        content = (
            "<a href='https://foo.open.tracker.com/foo/bar.html?src=trckr.com'>"
            "trckr.com</a>"
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        expected_content = (
            f"<a href='{self.url}"
            f"{self.url_trackerwarning_data(self.hyperlink_tracker_in_tracker)}'>"
            "trckr.com</a>"
        )
        assert changed_content == expected_content
        assert general_removed == 1
        assert general_count == 1

    def test_simple_strict_tracker_found(self):
        content = (
            '<a href="https://strict.tracker.com/foo/bar.html">A link</a>\n'
            + '<img src="https://strict.tracker.com/foo/bar.jpg">An image</img>'
        )
        changed_content, tracker_details = remove_trackers(
            content, self.from_address, self.datetime_now
        )
        general_removed = tracker_details["tracker_removed"]
        general_count = tracker_details["level_one"]["count"]

        assert changed_content == content
        assert general_removed == 0
        assert general_count == 0

    def test_tracker_host_is_matched_after_canonicalization(self):
        """
        A tracker host the recipient's client would reach must be caught however the
        sender spelled it. The client decodes HTML entities, the URL host parser
        percent-decodes the authority and applies UTS46, and DNS ignores case and the
        root dot, so none of these change where the pixel actually connects.
        See MPP-4770.
        """
        variants = {
            "decimal entity dot": "https://open.tracker&#46;com/bar.jpg",
            "hex entity dot": "https://open.tracker&#x2e;com/bar.jpg",
            "entity without semicolon": "https://open.tracker&#46com/bar.jpg",
            "named entity dot": "https://open.tracker&period;com/bar.jpg",
            "entity in a subdomain": "https://foo&#46;open.tracker.com/bar.jpg",
            "percent-encoded dot": "https://open.tracker%2Ecom/bar.jpg",
            "lowercase percent-encoded dot": "https://open.tracker%2ecom/bar.jpg",
            "percent-encoded dot in a subdomain": (
                "https://foo%2Eopen.tracker.com/bar.jpg"
            ),
            # UTS46 maps each of these to "." and splits labels on the result.
            "fullwidth stop": "https://open.tracker．com/bar.jpg",
            "ideographic stop": "https://open.tracker。com/bar.jpg",
            "halfwidth ideographic stop": "https://open.tracker｡com/bar.jpg",
            "percent-encoded fullwidth stop": (
                "https://open.tracker%EF%BC%8Ecom/bar.jpg"
            ),
            "entity-encoded fullwidth stop": (
                "https://open.tracker&#xFF0E;com/bar.jpg"
            ),
            "uppercase": "https://OPEN.TRACKER.COM/bar.jpg",
            "mixed case": "https://Open.Tracker.Com/bar.jpg",
            "uppercase host with entity": "https://OPEN.TRACKER&#46;COM/bar.jpg",
            "trailing root dot": "https://open.tracker.com./bar.jpg",
            "explicit port": "https://open.tracker.com:443/bar.jpg",
        }
        for label, link in variants.items():
            with self.subTest(label):
                content = f'<img src="{link}">'
                changed_content, tracker_details = remove_trackers(
                    content, self.from_address, self.datetime_now
                )

                assert tracker_details["tracker_removed"] == 1
                assert tracker_details["level_one"]["count"] == 1
                assert tracker_details["level_one"]["trackers"] == {
                    "open.tracker.com": 1
                }
                # The warning page shows the link as the sender wrote it, entities
                # and all, not Relay's canonicalized form.
                assert changed_content == (
                    f'<img src="{self.url}{self.url_trackerwarning_data(link)}">'
                )

    def test_tracker_name_outside_the_host_is_not_a_tracker(self):
        """
        Only the host the client connects to counts. A tracker domain that lands in
        the userinfo or in a longer parent domain points somewhere else entirely, so
        flagging it would warn about the wrong site.
        """
        decoys = {
            "tracker as a parent-domain prefix": (
                "https://open.tracker.com.evil.example/bar.jpg"
            ),
            "tracker as userinfo": "https://open.tracker.com@evil.example/bar.jpg",
            "tracker in the path": "https://evil.example/open.tracker.com/bar.jpg",
            "tracker as a label suffix": "https://fooopen.tracker.com/bar.jpg",
            # "%2F" decodes to "/", never to "://", so this stays a path segment and
            # no request is made for it. Contrast a redirect parameter, which decodes
            # to a scheme and does count. See CANONICALIZE_URL_HOSTS_CASES.
            "tracker in a percent-encoded path": (
                "https://evil.example/%2Fopen.tracker.com/bar.jpg"
            ),
        }
        for label, link in decoys.items():
            with self.subTest(label):
                content = f'<img src="{link}">'
                changed_content, tracker_details = remove_trackers(
                    content, self.from_address, self.datetime_now
                )

                assert changed_content == content
                assert tracker_details["tracker_removed"] == 0
                assert tracker_details["level_one"]["count"] == 0


@override_settings(SITE_ORIGIN="https://test.com")
def test_remove_trackers_does_not_backtrack_on_dotted_url() -> None:
    """A non-matching dotted URL must not blow up the tracker regex.

    Uses the real tracker list, not a stub. The other tests here patch it down to
    three domains, which is fast no matter how bad the pattern is. The cost is
    paid by every domain that fails to match, so only the full list shows it.
    """
    url = "https://click.mailer.example/r?u=" + "seg." * 20 + "end&id=9"
    content = f'<a href="{url}">click</a>'

    def on_timeout(signum: int, frame: FrameType | None) -> None:
        raise AssertionError("remove_trackers did not finish in 10s; regex backtracked")

    # Fail fast on a regression. Without a bound, the old pattern runs for hours
    # on 20 dots instead of failing, which is useless in a test suite.
    previous = signal.signal(signal.SIGALRM, on_timeout)
    signal.alarm(10)
    try:
        changed_content, tracker_details = remove_trackers(
            content, "spammer@email.com", "1682472064"
        )
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)

    assert changed_content == content
    assert tracker_details["tracker_removed"] == 0


CANONICALIZE_URL_HOSTS_CASES = {
    "plain host": ("https://open.tracker.com/bar.jpg", ["open.tracker.com"]),
    "uppercase host": ("https://OPEN.TRACKER.COM/bar.jpg", ["open.tracker.com"]),
    "entity-encoded dot": ("https://open.tracker&#46;com/x", ["open.tracker.com"]),
    "percent-encoded dot": ("https://open.tracker%2Ecom/x", ["open.tracker.com"]),
    "lowercase percent-encoded dot": (
        "https://open.tracker%2ecom/x",
        ["open.tracker.com"],
    ),
    "fullwidth stop": ("https://open.tracker．com/x", ["open.tracker.com"]),
    "percent-encoded fullwidth stop": (
        "https://open.tracker%EF%BC%8Ecom/x",
        ["open.tracker.com"],
    ),
    "entity-encoded fullwidth stop": (
        "https://open.tracker&#xFF0E;com/x",
        ["open.tracker.com"],
    ),
    "ideographic stop": ("https://open.tracker。com/x", ["open.tracker.com"]),
    "halfwidth ideographic stop": (
        "https://open.tracker｡com/x",
        ["open.tracker.com"],
    ),
    "percent-encoded path is left alone": (
        "https://safe.example/%2Fopen.tracker.com/x",
        ["safe.example"],
    ),
    "percent-encoded nested URL": (
        "https://safe.example/r?u=https%3A%2F%2Fopen.tracker.com%2Fx",
        ["safe.example", "open.tracker.com"],
    ),
    "percent-encoded nested URL with an encoded dot": (
        "https://safe.example/r?u=https%3A%2F%2Fopen.tracker%2Ecom%2Fx",
        ["safe.example", "open.tracker.com"],
    ),
    "root dot": ("https://open.tracker.com./x", ["open.tracker.com"]),
    "port": ("https://open.tracker.com:8080/x", ["open.tracker.com"]),
    "userinfo": ("https://user:pw@open.tracker.com/x", ["open.tracker.com"]),
    "css url() wrapper": (
        "background:url(https://open.tracker.com/x)",
        ["open.tracker.com"],
    ),
    "nested redirect URL": (
        "https://safe.example/r?u=https://open.tracker.com/x",
        ["safe.example", "open.tracker.com"],
    ),
    "same host twice": (
        "https://safe.example/r?u=https://safe.example/x",
        ["safe.example"],
    ),
    "host ends at the path": ("https://open.tracker.com/a.b.c", ["open.tracker.com"]),
    "host ends at the query": ("https://open.tracker.com?a=b.c", ["open.tracker.com"]),
    "host ends at the fragment": ("https://open.tracker.com#a.b", ["open.tracker.com"]),
    "no scheme": ("/relative/path.jpg", []),
    "empty authority": ("https:///bar.jpg", []),
}


@pytest.mark.parametrize(
    "url_value, expected",
    CANONICALIZE_URL_HOSTS_CASES.values(),
    ids=CANONICALIZE_URL_HOSTS_CASES.keys(),
)
def test_canonicalize_url_hosts(url_value: str, expected: list[str]) -> None:
    assert canonicalize_url_hosts(url_value) == expected


def test_find_tracker_domain_returns_the_listed_parent_domain() -> None:
    """The reported domain is the listed one, not the host that was seen."""
    trackers = {"tracker.com"}
    assert find_tracker_domain("https://foo.bar.tracker.com/x", trackers) == (
        "tracker.com"
    )
    assert find_tracker_domain("https://nottracker.com/x", trackers) is None


def test_find_tracker_domain_looks_past_the_first_host() -> None:
    """A wrapper whose redirect target is the tracker still reports the tracker."""
    trackers = {"tracker.com"}
    wrapped = "https://safe.example/r?u=https%3A%2F%2Ftracker.com%2Fpx"
    assert find_tracker_domain(wrapped, trackers) == "tracker.com"


def test_find_tracker_domain_prefers_the_most_specific_listed_domain() -> None:
    """
    Both the host and a parent are listed. Report the host's own entry so the
    tracker report names the domain that was actually contacted.
    """
    trackers = {"tracker.com", "open.tracker.com"}
    assert find_tracker_domain("https://open.tracker.com/x", trackers) == (
        "open.tracker.com"
    )


def test_encode_dict_gza85() -> None:
    data = {"key": "value"}
    encoded = encode_dict_gza85(data)
    assert encoded == "Gatg8b\"f'<Z;OLK9?\\hZ<N63&/$B+B"
    decoded = decode_dict_gza85(encoded)
    assert decoded == data


def test_encode_dict_gza85_large_value() -> None:
    data = {
        "key": "value",
        "random_strings": [
            base64.encodebytes(random.randbytes(32)).decode() for _ in range(100)
        ],
    }
    encoded = encode_dict_gza85(data)
    assert len(encoded) > 1024
    assert "\n" in encoded
    decoded = decode_dict_gza85(encoded)
    assert decoded == data


DECODE_DICT_GZA85_ERROR_CASES = {
    "invalid_zlib": ("ascii85_garbage", zlib.error, "incorrect header check"),
    "invalid_a85": ("v_is_invalid_ASCII85", ValueError, "Non-Ascii85 digit found: v"),
    "not_json": (
        base64.a85encode(zlib.compress(b"[This] is {not} JSON"), pad=True).decode(),
        ValueError,
        "Expecting value: line 1 column 2",
    ),
    "not_json_dict": (
        base64.a85encode(zlib.compress(b'["A", "list"]'), pad=True).decode(),
        ValueError,
        "Encoded data is not a dict",
    ),
    "non_string_key": (
        base64.a85encode(zlib.compress(b'{1: "One"}'), pad=True).decode(),
        ValueError,
        "Expecting property name enclosed in double quotes",
    ),
}


@pytest.mark.parametrize(
    "invalid_encoded, expected_error, expected_regex",
    DECODE_DICT_GZA85_ERROR_CASES.values(),
    ids=DECODE_DICT_GZA85_ERROR_CASES.keys(),
)
def test_decode_dict_gza85_invalid_encoded_raises(
    invalid_encoded, expected_error, expected_regex
):
    with pytest.raises(expected_error, match=expected_regex):
        decode_dict_gza85(invalid_encoded)
