# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the Django equivalent of frontend/pendingTranslations.ftl

## Email sent to users when Relay disables their mask after the user marks a forwarded
## email as spam.

relay-disabled-your-mask = { -brand-name-firefox-relay } has disabled one of your email masks.
# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-received-spam-complaint-html = { -brand-name-firefox-relay } received a spam complaint for an email sent to <strong>{ $mask }</strong>. This usually happens if you or your email provider mark an email as spam.
# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-received-spam-complaint = { -brand-name-firefox-relay } received a spam complaint for an email sent to { $mask }. This usually happens if you or your email provider mark an email as spam.
# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-disabled-your-mask-detail-html = To prevent further spam, { -brand-name-firefox-relay } has disabled your <strong>{ $mask }</strong> mask.
# Variables
#   $mask (string) - the Relay email mask that sent a spam complaint
relay-disabled-your-mask-detail = To prevent further spam, { -brand-name-firefox-relay } has disabled your { $mask } mask.
re-enable-your-mask = Visit your { -brand-name-firefox-relay } dashboard to re-enable this mask.
