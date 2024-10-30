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
