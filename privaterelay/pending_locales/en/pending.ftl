# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the Django equivalent of frontend/pendingTranslations.ftl

## Relay SMS reply errors

sms-error-no-previous-sender = Message failed to send. You can only reply to phone numbers that have sent you a text message.
# Variables
#   $account_settings_url (string) - The URL of the Relay account settings, to enable logs
sms-error-no-phone-log = The reply feature requires { -brand-name-firefox-relay } to keep a log of your callers and text senders. You can reply to future messages by enabling “Caller and texts log” in Settings: { $account_settings_url }

# Variables
#   $short_prefix (string) - A four-digit code, such as '1234', that matches the end of a phone number
sms-error-short-prefix-matches-no-senders = Message failed to send. There is no phone number in this thread ending in { $short_prefix }. Please check the number and try again.
# Variables
#   $short_prefix (string) - A four-digit code, such as '1234', that matches the end of a phone number
sms-error-multiple-number-matches = Message failed to send. There is more than one phone number in this thread ending in { $short_prefix }. To retry, start your message with the complete number.
# Variables
#   $short_prefix (string) - A four-digit code, such as '1234', that matches the end of a phone number
sms-error-no-body-after-short-prefix = Message failed to send. Please include a message after the phone number ending in { $short_prefix }.

# Variables
#   $full_number (string) - A phone number, such as '+13025551234' or '1 (302) 555-1234'
sms-error-full-number-matches-no-senders = Message failed to send. There is no previous sender with the phone number { $full_number }. Please check the number and try again.
# Variables
#   $full_number (string) - A phone number, such as '+13025551234' or '1 (302) 555-1234'
sms-error-no-body-after-full-number = Message failed to send. Please include a message after the phone number { $full_number }.
