"""Exceptions raised by phones app"""

from django.conf import settings

from api.exceptions import ErrorContextType, RelayAPIException


class RelaySMSException(RelayAPIException):
    """Base exception for SMS text issues"""

    ftl_id_prefix = "sms-error-"


class NoPhoneLog(RelaySMSException):
    default_code = "no_phone_log"
    default_detail_template = (
        "The reply feature requires Firefox Relay to keep a log of your callers"
        " and text senders. You can reply to future messages by enabling “Caller and"
        " texts log” in Settings: {account_settings_url}"
    )
    ftl_id = "sms-error-no-phone-log"
    status_code = 400

    def error_context(self) -> ErrorContextType:
        return {
            "account_settings_url": f"{settings.SITE_ORIGIN or ''}/accounts/settings/"
        }


class NoPreviousSender(RelaySMSException):
    default_code = "no_previous_sender"
    default_detail = (
        "Message failed to send. You can only reply to phone numbers that have sent"
        " you a text message."
    )
    ftl_id = "sms-error-no-previous-sender"
    status_code = 400


class ShortPrefixException(RelaySMSException):
    """Base exception for short prefix exceptions"""

    status_code = 200

    def __init__(self, short_prefix: str):
        self.short_prefix = short_prefix
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"short_prefix": self.short_prefix}


class FullNumberException(RelaySMSException):
    """Base exception for full number exceptions"""

    status_code = 200

    def __init__(self, full_number: str):
        self.full_number = full_number
        super().__init__()

    def error_context(self) -> ErrorContextType:
        return {"full_number": self.full_number}


class ShortPrefixMatchesNoSenders(ShortPrefixException):
    default_code = "short_prefix_matches_no_senders"
    default_detail_template = (
        "Message failed to send. There is no phone number in this thread ending"
        " in {short_prefix}. Please check the number and try again."
    )
    ftl_id = "sms-error-short-prefix-matches-no-senders"


class FullNumberMatchesNoSenders(FullNumberException):
    default_code = "full_number_matches_no_senders"
    default_detail_template = (
        "Message failed to send. There is no previous sender with the phone"
        " number {full_number}. Please check the number and try again."
    )
    ftl_id = "sms-error-full-number-matches-no-senders"


class MultipleNumberMatches(ShortPrefixException):
    default_code = "multiple_number_matches"
    default_detail_template = (
        "Message failed to send. There is more than one phone number in this"
        " thread ending in {short_prefix}. To retry, start your message with"
        " the complete number."
    )
    ftl_id = "sms-error-multiple-number-matches"


class NoBodyAfterShortPrefix(ShortPrefixException):
    default_code = "no_body_after_short_prefix"
    default_detail_template = (
        "Message failed to send. Please include a message after the sender identifier"
        " {short_prefix}."
    )
    ftl_id = "sms-error-no-body-after-short-prefix"


class NoBodyAfterFullNumber(FullNumberException):
    default_code = "no_body_after_full_number"
    default_detail_template = (
        "Message failed to send. Please include a message after the phone number"
        " {full_number}."
    )
    ftl_id = "sms-error-no-body-after-full-number"
