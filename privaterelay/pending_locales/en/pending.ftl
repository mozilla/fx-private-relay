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

## Email sent to first time free users 

first-time-user-email-welcome = Welcome to { -brand-name-firefox-relay }
first-time-user-email-preheader = Email masking to protect your identity
first-time-user-email-welcome-subhead = Your email address can be used to track you online — we’re here to help put an end to it.
first-time-user-email-hero-primary-text = As a { -brand-name-firefox } user, you get 5 email masks for free. Use them to hide your real email address, protect your identity, and forward only the emails you want to your inbox. 
first-time-user-email-hero-secondary-text = Manage all your masks from your Relay dashboard.
first-time-user-email-hero-cta = View your dashboard

first-time-user-email-how-title = How { -brand-name-relay } works 
first-time-user-email-how-item-1-header = Use a { -brand-name-relay } mask instead of your real email, everywhere
first-time-user-email-how-item-1-subhead-html = Create masks directly on { -brand-name-firefox }, with the <a href="{ $url }" { $attrs }>{ -brand-name-relay } add-on</a>, or on your { -brand-name-relay } dashboard.
first-time-user-email-how-item-2-header = We’ll forward all emails to your inbox 
first-time-user-email-how-item-2-subhead =  Senders will never see your real address, and you can block emails any time.
first-time-user-email-how-item-3-header = Manage your masks from your { -brand-name-relay } dashboard
first-time-user-email-how-item-3-subhead-html =  <a href="{ $url }" { $attrs }>Sign in</a> to create new masks, label your masks, and delete masks that get spam.

first-time-user-email-extra-protection-inbox-title = Extra protection for your inbox
first-time-user-email-extra-protection-inbox-phone-title = Extra protection for your inbox and phone
first-time-user-email-extra-protection-inbox-subhead = Upgrade to { -brand-name-relay-premium } to get unlimited email masks, a custom { -brand-name-relay } domain, and custom inbox controls.
first-time-user-email-extra-protection-inbox-phone-subhead = Upgrade to { -brand-name-relay-premium } for unlimited email masks — plus a phone mask to protect your real number.
first-time-user-email-extra-protection-cta = Get { -brand-name-relay-premium }

first-time-user-email-questions-title = Questions about { -brand-name-firefox-relay }? 
first-time-user-email-questions-subhead-html = Our <a href="{ $url }" { $attrs }>support team</a> is here to help.
first-time-user-email-footer-text-1 = You’re receiving this automated email as a subscriber of { -brand-name-firefox-relay } that used { -brand-name-relay } for the first time. If you received it in error, no action is required.
first-time-user-email-footer-text-2-html = For more information, please visit <a href="{ $url }" { $attrs }>{ -brand-name-mozilla } Support</a>.
first-time-user-email-footer-text-address = 2 Harrison St. #175, San Francisco, California 94105 USA
first-time-user-email-footer-text-legal = Legal
first-time-user-email-footer-text-privacy = Terms & Privacy

