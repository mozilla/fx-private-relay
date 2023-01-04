# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the Django equivalent of frontend/pendingTranslations.ftl

## Relay SMS reply errors

relay-sms-error-no-previous-sender = Message failed to send. Could not find a previous text sender.
# Variables
#   $account_settings_url (string) - The URL of the Relay account settings, to enable logs
relay-sms-error-no-phone-log = You can only reply if you allow { -brand-name-firefox-relay } to keep a log of your callers and text senders. See { $account_settings_url }.

# Variables
#   $short_prefix (string) - A four-digit code, such as '1234', that matches the end of a phone number
relay-sms-error-short-prefix-matches-no-senders = Message failed to send. There is no phone number in this thread ending in { $short_prefix }. Please check the number and try again.
# Variables
#   $short_prefix (string) - A four-digit code, such as '1234', that matches the end of a phone number
relay-sms-error-multiple-number-matches = Message failed to send. There is more than one phone number in this thread ending in { $short_prefix }. To retry, start your message with the complete number.
# Variables
#   $short_prefix (string) - A four-digit code, such as '1234', that matches the end of a phone number
relay-sms-error-no-body-after-short-prefix = Message failed to send. Please include a message after the sender identifier { $short_prefix }.

# Variables
#   $full_number (string) - A phone number, such as '+13025551234' or '1 (302) 555-1234'
relay-sms-error-full-number-matches-no-senders = Message failed to send. There is no previous sender with the phone number { $full_number }. Please check the number and try again.
# Variables
#   $full_number (string) - A phone number, such as '+13025551234' or '1 (302) 555-1234'
relay-sms-error-no-body-after-full-number = Message failed to send. Please include a message after the phone number { $full_number }.

## Email sent to free users who try to reply

# Variables
#   $sender (string) - the original sender's email address
other-reply-not-forwarded = Your reply was NOT sent to { $sender }.
