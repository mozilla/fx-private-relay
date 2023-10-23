"""Tests for emails.policy"""

from email import message_from_string, errors

from emails.policy import relay_policy

from .views_tests import EMAIL_INCOMING


def test_compliant_email():
    """An RFC-compliant message is parsed correctly."""
    email_in_text = EMAIL_INCOMING["plain_text"]
    email = message_from_string(email_in_text, policy=relay_policy)
    headers = list(email.items())
    assert headers == [
        ("Subject", "Text-Only Email"),
        ("From", "A server <root@server.example.com>"),
        ("To", "ebsbdsan7@test.com"),
        ("Date", "Wed, 27 Sep 2023 16:33:12 +0000"),
        ("Content-Type", 'text/plain; charset="utf-8"'),
        ("Content-Transfer-Encoding", "7bit"),
        ("MIME-Version", "1.0"),
    ]
    for name, value in headers:
        assert not value.defects
    email_out_text = email.as_string(policy=relay_policy)
    assert email_in_text == email_out_text
    assert email.defects == []


def test_invalid_message_id():
    email_in_text = EMAIL_INCOMING["message_id_in_brackets"]
    email = message_from_string(email_in_text, policy=relay_policy)
    headers = list(email.items())
    assert headers == [
        ("Subject", "Message-ID in brackets"),
        ("From", "A concerned user <user@clownshoes.example.com>"),
        ("To", "ebsbdsan7@test.com"),
        ("Date", "Thu, 12 Oct 2023 15:57:53 +0000"),
        ("Content-Type", 'text/plain; charset="utf-8"'),
        ("Content-Transfer-Encoding", "7bit"),
        ("MIME-Version", "1.0"),
        ("Message-ID", "<[d7c5838b5ab944f89e3f0c1b85674aef====@example.com]>"),
    ]
    for name, value in headers:
        if name != "Message-ID":
            assert not value.defects
        else:
            assert len(value.defects) == 1
            assert isinstance(value.defects[0], errors.InvalidHeaderDefect)

    email_out_text = email.as_string(policy=relay_policy)
    assert email_in_text == email_out_text
    assert email.defects == []


def test_from_with_unquoted_commas():
    email_in_text = EMAIL_INCOMING["emperor_norton"]
    email = message_from_string(email_in_text, policy=relay_policy)
    headers = list(email.items())
    assert headers == [
        ("Subject", "Declaration and Meeting of the Union"),
        (
            "From",
            '"Norton I.", Emperor of the United States <norton@sf.us.example.com>',
        ),
        ("To", "ebsbdsan7@test.com"),
        ("Date", "Sat, 17 Sep 1859 11:33:12 -0700"),
        ("Content-Type", 'text/plain; charset="utf-8"'),
    ]
    for name, value in headers:
        if name != "From":
            assert not value.defects
        else:
            assert len(value.defects) == 4
            assert all(
                isinstance(defect, errors.InvalidHeaderDefect)
                for defect in value.defects
            )
    email_out_text = email.as_string(policy=relay_policy)
    assert email_in_text == email_out_text
    assert email.defects == []


def test_from_with_nested_brackets_service():
    email_in_text = EMAIL_INCOMING["nested_brackets_service"]
    email = message_from_string(email_in_text, policy=relay_policy)
    headers = list(email.items())
    assert headers == [
        ("Subject", "Welcome to our service!"),
        ("From", 'The Service <"The Service">'),
        ("To", "ebsbdsan7@test.com"),
        ("Date", "Wed, 04 Oct 2023 12:16:22 -0000"),
        ("Content-Type", 'text/plain; charset="utf-8"'),
    ]
    for name, value in headers:
        if name != "From":
            assert not value.defects
        else:
            assert len(value.defects) == 7
            assert all(
                isinstance(
                    defect, (errors.InvalidHeaderDefect, errors.ObsoleteHeaderDefect)
                )
                for defect in value.defects
            )
    email_out_text = email.as_string(policy=relay_policy)
    assert email_in_text == email_out_text
    assert email.defects == []
