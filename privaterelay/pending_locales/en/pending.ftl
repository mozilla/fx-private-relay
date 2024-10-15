# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the Django equivalent of frontend/pendingTranslations.ftl

## Email sent to users when Relay deactivates their mask after the user marks a forwarded
## email as spam.

relay-deactivated-your-mask = { -brand-name-firefox-relay } has deactivated one of your email masks.

reactivate-your-mask = Reactivate your email mask

# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-received-spam-complaint-and-deactivated-mask-html = An email from your mask address, { $mask }, was marked as spam. When this happens, { -brand-name-firefox-relay } deactivates the mask and stops forwarding emails.

# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-received-spam-complaint-and-deactivated-mask = An email from your mask address, { $mask }, was marked as spam. When this happens, { -brand-name-firefox-relay } deactivates the mask and stops forwarding emails.

# Variables
#   $mask_url (string) - url takes user to Relay dashboard with mask selected
reactivate-mask-detail-html = To reactivate your mask, <a href="{ $mask_url }">remove email blocking</a> on your { -brand-name-firefox-relay } dashboard.

reactivate-mask-detail = To reactivate your mask, remove email blocking on your { -brand-name-firefox-relay } dashboard.

# Variables
#   $learn_more_url (string) - support.mozilla.org page with more information
learn-about-blocking-html = <a href="{ $learn_more_url }">Learn about blocking and email forwarding</a>

# Variables
#   $learn_more_url (string) - support.mozilla.org page with more information
learn-about-blocking = Learn about blocking and email forwarding at { $learn_more_url }

re-enable-your-mask = Visit your { -brand-name-firefox-relay } dashboard to re-enable this mask.
