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
relay-email-relay-dashboard = { -brand-name-relay } dashboard
relay-email-block-sender = Block sender
# $url - the url to Relay using site origin
relay-email-premium-by-line-html = by <a class="container-link" href="{ $url }">{ -brand-name-firefox-relay-premium }</a>
# $display_email - the mask email address
relay-email-forwarded-from-html = Forwarded from <span class="forwarded-by">{ $display_email }</span>
# $number - the number of email trackers removed
relay-email-trackers-removed = { $number } email trackers removed