# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the Django equivalent of frontend/pendingTranslations.ftl

## Email sent to users when Relay deactivates their mask after the user marks a forwarded
## email as spam.

relay-deactivated-mask-email-subject = This mask has been deactivated

relay-deactivated-mask-email-pretext = Remove email blocking to use your email mask

# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-received-spam-complaint-and-deactivated-mask = An email from your mask address, { $mask }, was marked as spam. When this happens, { -brand-name-firefox-relay } deactivates the mask and blocks emails from forwarding to protect your inbox from future spam.

relay-remove-email-blocking-html =
    To remove email blocking:
    <ol>
    <li><a href="{ $mask_url }">Go to your { -brand-name-relay } dashboard</a> and find this email mask</li>
    <li>Remove email blocking by updating blocking from all to none</li>
    </ol>

relay-remove-email-blocking =
    To remove email blocking:
    1. Go to your { -brand-name-relay } dashboard and find this email mask
    2. Remove email blocking by updating blocking from all to none

# Variables
#   $learn_more_url (string) - support.mozilla.org page with more information
detailed-instructions-about-blocking-html = <a href="{ $learn_more_url }">Detailed instructions to remove email blocking</a>

# Variables
#   $learn_more_url (string) - support.mozilla.org page with more information
detailed-instructions-about-blocking = Detailed instructions to remove email blocking: { $learn_more_url }

remove-email-blocking = Remove email blocking

## Updated first-time user welcome email (MPP-4613)

first-time-user-email-welcome-subhead-2 = Mask your email. Control your inbox.

# Variables
#   $mask_limit (number) - the number of free email masks available
first-time-user-email-hero-primary-text-2 = You have { $mask_limit } free email masks ready to go. Use one when you shop online or sign up for a new account or app.

first-time-user-email-cta-dashboard-button-2 = Go to { -brand-name-firefox-relay }

first-time-user-email-how-item-1-header-2 = Create a mask in seconds

## Updated first-time user welcome email (v3)

first-time-user-email-welcome-subhead-3 = Your email address can be used to track you online — we’re here to help put an end to it.

# Variables
#   $mask_limit (number) - the number of free email masks available
first-time-user-email-hero-primary-text-3 = As a { -brand-name-firefox } user, you get { $mask_limit } email masks for free. Use them to hide your real email address, protect your identity, and forward only the emails you want to your inbox.

first-time-user-email-hero-secondary-text-3 = Manage all your masks from your { -brand-name-relay } dashboard.

first-time-user-email-cta-dashboard-button-3 = Learn to use email masks

# Variables
#   $url (string) - link to the Relay add-on
#   $attrs (string) - link attributes
first-time-user-email-how-item-1-subhead-2-html = Right in { -brand-name-firefox }, with the <a href="{ $url }" { $attrs }>{ -brand-name-relay } add-on</a>, or from your dashboard.
first-time-user-email-how-item-1-subhead-text-2 = Right in { -brand-name-firefox }, with the { -brand-name-relay } add-on, or from your dashboard.

first-time-user-email-how-item-2-header-2 = Forward the emails you want
first-time-user-email-how-item-2-subhead-2 = Senders never see your real address. Keep using a mask to hide your real email or block emails you get.

first-time-user-email-how-item-3-header-2 = You’re in control

# Variables
#   $url (string) - link to sign in
#   $attrs (string) - link attributes
first-time-user-email-how-item-3-subhead-2-html = <a href="{ $url }" { $attrs }>Sign in</a> to create, label, or delete masks anytime.
first-time-user-email-how-item-3-subhead-text-2 = Sign in to create, label, or delete masks anytime.

# Variables
#   $url (string) - link to support center
#   $attrs (string) - link attributes
first-time-user-email-questions-subhead-2-html = Visit our <a href="{ $url }" { $attrs }>Support Center</a> for help
first-time-user-email-questions-subhead-text-2 = Visit our Support Center for help

first-time-user-email-footer-text-1-2 = You’re receiving this automated email as a subscriber of { -brand-name-firefox-relay }. If you received it in error, no action is required.
