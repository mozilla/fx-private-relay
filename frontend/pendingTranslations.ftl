# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

banner-dismiss = Dismiss

# Do not change '@mozmail.com'
landing-how-it-works-step-2-body-2 = As you browse, the { -brand-name-relay } icon will appear where sites ask for your email address.
    Select it to generate a new, random address that ends in @mozmail.com.

landing-use-cases-heading = Use { -brand-name-firefox-relay } for:

faq-question-acceptable-use-answer-measure-unlimited-payment-2 = Requiring payment for a user to create more than five masks
faq-question-acceptable-use-answer-measure-rate-limit-2 = Rate-limiting the number of masks that can be generated in one day

error-settings-update = There was an error updating your settings, please try again
error-mask-create-failed = The mask could not be created. Please try again.
# This currently appears when a mask label could not be updated,
# but in the future it might also appear if other mask data could not be changed.
error-mask-update-failed = The mask data could not be updated. Please try again.
# Variables:
#   $mask (string) - The email mask (e.g. abcdef@mozmail.com) that the user tried to delete
error-mask-delete-failed = The mask { $mask } could not be deleted. Please try again.

profile-label-subdomain-tooltip-trigger = More info
# This will be read to screen readers when focusing the button to copy an mask to the clipboard.
# Variables:
#   $address (string) - Mask address, e.g. wz7n0vykd@mozmail.com.
profile-label-click-to-copy-alt = Click to copy mask { $address }.

profile-details-expand = Show mask details
profile-details-collapse = Hide mask details

profile-filter-category-button-label = Filter visible masks
profile-filter-category-button-tooltip = Filter masks by subdomain and/or whether they are currently blocking incoming email
profile-filter-category-title = Filter visible masks
profile-filter-no-results = No masks match your selected criteria. <clear-button>Clear all filters.</clear-button>

profile-promo-email-blocking-description-all-2 = { -brand-name-relay } is blocking all emails sent to this mask.
profile-promo-email-blocking-description-none-2 = { -brand-name-relay } is not blocking any emails for this mask.

# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
#   $domain (string) - Applicable domain, i.e. `.mozmail.com`
modal-domain-register-available-2 = <subdomain>{ $subdomain }</subdomain><domain>.{ $domain }</domain> is available!
# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
modal-domain-register-confirmation-checkbox-2 = Yes, I want to register <subdomain>{ $subdomain }</subdomain>

# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
#   $domain (string) - Applicable domain, i.e. `.mozmail.com`
modal-domain-register-success-3 = <subdomain>{ $subdomain }</subdomain><domain>.{ $domain }</domain> is now your email subdomain!

# Variables:
#   $step (number) - Which step the user currently is on
#   $max (number) - Total number of steps
multi-part-onboarding-step-counter = Step { $step } of { $max }.

# Label for each of the dots representing a tip in a panel in the bottom right-hand corner.
# Variables
#   $nr (number) - Which tip can be seen by clicking/tapping this particular dot.
tips-switcher-label = Tip { $nr }

# This copy (and the term "critical email") is not final yet:
tips-critical-emails-heading = Critical email forwarding
# This copy (and the term "critical email") is not final yet:
tips-critical-emails-content = Relay allows you to receive only critical emails sent to an mask. You’ll receive emails like receipts but not spam or marketing emails.

# This copy is not final yet:
tips-addon-signin-heading = Sign in with your masks
# This copy is not final yet:
tips-addon-signin-content = To sign in with a previously-used alias, open the context menu (right-click or control-click) where the site asks for your email. You’ll be able to select the alias and auto-fill the email field.

whatsnew-trigger-label = News
whatsnew-counter-label = { $count } new announcements.
whatsnew-close-label = Close
whatsnew-tab-new-label = News
whatsnew-tab-archive-label = History
whatsnew-footer-clear-all-label = Clear all
whatsnew-footer-back-label = Back
whatsnew-footer-learn-more-label = Learn more

whatsnew-empty-message = Be sure to check back here—we’re always working on great new features to make { -brand-name-relay } even better.

whatsnew-feature-size-limit-heading = Attachment size increase
# A preview of the full content of `whatsnew-feature-size-limit-description`.
# When translating, please make sure the resulting string is of roughly similar
# length as the English version.
whatsnew-feature-size-limit-snippet = { -brand-name-firefox-relay } can now forward emails up to 25MB, including…
whatsnew-feature-size-limit-description = { -brand-name-firefox-relay } can now forward emails up to 25MB, including attachments.
# A preview of the full content of `whatsnew-feature-size-limit-description-var`.
# When translating, please make sure the resulting string is of roughly similar
# length as the English version.
whatsnew-feature-size-limit-snippet-var = { -brand-name-firefox-relay } can now forward emails up to { email-size-limit }, including…
whatsnew-feature-size-limit-description-var = { -brand-name-firefox-relay } can now forward emails up to { email-size-limit }, including attachments.

whatsnew-feature-sign-back-in-heading = Sign back in with your aliases
# A preview of the full content of `whatsnew-feature-sign-back-in-description`.
# When translating, please make sure the resulting string is of roughly similar
# length as the English version.
whatsnew-feature-sign-back-in-snippet = To create a new alias when you’re asked for your email, open...
whatsnew-feature-sign-back-in-description = To sign in with a previously-used alias, open the context menu where the site asks for your email. You’ll be able to select the alias and auto-fill the email field.

whatsnew-feature-forward-some-heading = Promotional email blocking
# A preview of the full content of `whatsnew-feature-forward-some-description`.
# When translating, please make sure the resulting string is of roughly similar
# length as the English version.
whatsnew-feature-forward-some-snippet = { -brand-name-relay-premium } allows you to block only promotional emails...
whatsnew-feature-forward-some-description = { -brand-name-relay-premium } allows you to block only promotional emails sent to an alias. You’ll receive emails like receipts but not marketing emails.

whatsnew-feature-alias-to-mask-heading = Aliases are now masks
whatsnew-feature-alias-to-mask-snippet = Notice a change? We’re now calling aliases “masks” to make { -brand-name-firefox-relay }…
whatsnew-feature-alias-to-mask-description = Notice a change? We’re now calling aliases “masks” to make { -brand-name-firefox-relay } easier to use and open the door for new features.
