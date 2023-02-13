# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the Django equivalent of frontend/pendingTranslations.ftl

# $sender (string) - the sender's email address
relay-email-replies-not-included-in-free-account-message = We’ve sent this reply to { $sender }. But moving forward, your replies will not be sent. Replying to forwarded emails from your masked email is only available with { -brand-name-firefox-relay-premium }.
relay-email-replies-not-included-in-free-account-header = Replies are not included with your free account
relay-email-upgrade-to-reply-to-future-emails = Upgrade now to reply to future emails
relay-email-upgrade-for-more-protection = Upgrade for more protection
relay-email-upgrade-to-premium = Upgrade to { -brand-name-firefox-relay-premium }
relay-email-manage-your-masks = Manage your masks
relay-email-manage-this-mask = Manage this mask
relay-email-relay-dashboard = { -brand-name-relay } dashboard
relay-email-your-dashboard = Your dashboard
relay-email-block-sender = Block sender
# The by line for the premium email header that reads "by Firefox Relay Premium"
relay-email-by-line = by
# This is used by relay-email-premium-by-line to create a sentence like "by Firefox Relay Premium"
relay-email-premium-by-line-link = { -brand-name-firefox-relay-premium }
# This is used by relay-email-by-line to create a sentence like "by Firefox Relay"
relay-email-by-line-link = { -brand-name-firefox-relay }
relay-email-forwarded-from = Forwarded from
# $number - the number of email trackers removed
relay-email-trackers-removed = { $number } email trackers removed

## Email sent to free users who try to reply

# Variables
#   $sender (string) - the original sender's email address
other-reply-not-forwarded = Your reply was NOT sent to { $sender }.
# Variables
#   $sender (string) - the original sender's email address
other-reply-not-forwarded-2 = Your reply was not sent to { $sender }.
