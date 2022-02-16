# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

survey-option-dismiss = Dismiss

survey-csat-question = How satisfied are you with your Firefox Relay experience?
survey-csat-answer-very-dissatisfied = Very Dissatisfied
survey-csat-answer-dissatisfied = Dissatisfied
survey-csat-answer-neutral = Neutral
survey-csat-answer-satisfied = Satisfied
survey-csat-answer-very-satisfied = Very Satisfied
survey-csat-followup = Thank you for your feedback. We would like to learn more about how we can improve Relay for you, would you be willing to take a two-minute survey?

banner-dismiss = Dismiss

# Do not change '@mozmail.com'
landing-how-it-works-step-2-body-v2 = As you browse, the { -brand-name-relay } icon will appear where sites ask for your email address.
    Select it to generate a new, random address that ends in @mozmail.com.

landing-use-cases-heading = Use { -brand-name-firefox-relay } for:

error-settings-update = There was an error updating your settings, please try again
error-alias-create-failed = The alias could not be created. Please try again.
# This currently appears when an alias label could not be updated,
# but in the future it might also appear if other alias data could not be changed.
error-alias-update-failed = The alias data could not be updated. Please try again.
# Variables:
#   $alias (string) - The email alias (e.g. abcdef@mozmail.com) that the user tried to delete
error-alias-delete-failed = The alias { $alias } could not be deleted. Please try again.

profile-label-domain-tooltip-trigger = More info
# This will be read to screen readers when focusing the button to copy an alias to the clipboard.
# Variables:
#   $address (string) - Alias address, e.g. wz7n0vykd@mozmail.com.
profile-label-click-to-copy-alt = Click to copy alias { $address }.

profile-details-expand = Show alias details
profile-details-collapse = Hide alias details

profile-filter-category-button-label = Filter visible aliases
profile-filter-category-button-tooltip = Filter aliases by domain and/or whether they are enabled or disabled
profile-filter-category-title = Filter visible aliases
profile-filter-no-results = No aliases match your selected criteria. <clear-button>Clear all filters.</clear-button>

# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
#   $domain (string) - Applicable domain, i.e. `.mozmail.com`
modal-domain-register-available-v2 = <subdomain>{ $subdomain }</subdomain><domain>.{ $domain }</domain> is available!
# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
modal-domain-register-confirmation-checkbox-v2 = Yes, I want to register <subdomain>{ $subdomain }</subdomain>

# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
#   $domain (string) - Applicable domain, i.e. `.mozmail.com`
modal-domain-register-success-v2 = <subdomain>{ $subdomain }</subdomain><domain>.{ $domain }</domain> is now your email domain!

# Variables:
#   $step (number) - Which step the user currently is on
#   $max (number) - Total number of steps
multi-part-onboarding-step-counter = Step { $step } of { $max }.

profile-label-generate-new-alias-menu-random = Random Alias
# Variables
#   $subdomain (string) - The user's custom subdomain, if any, e.g. `@eduardofeo`.
profile-label-generate-new-alias-menu-custom = @{ $subdomain } Alias

## The following two strings were already submitted in
## https://github.com/mozilla-l10n/fx-private-relay-l10n/pull/59:
banner-choose-subdomain-input-placeholder-2 = Search your new domain
onboarding-premium-domain-title-2 = Use a custom domain for sharing aliases:

tips-header-title = Help & Tips
tips-header-button-close-label = Dismiss
tips-footer-link-faq-label = FAQ
tips-footer-link-faq-tooltip = Frequently asked questions
tips-footer-link-feedback-label = Feedback
tips-footer-link-feedback-tooltip = Give feedback
tips-footer-link-support-label = Support
tips-footer-link-support-tooltip = Contact support

## The Acceptable Use FAQ entry has already been submitted:
## https://github.com/mozilla-l10n/fx-private-relay-l10n/pull/60
faq-question-acceptable-use-question = What are the acceptable uses of { -brand-name-relay }?
#   $url (url) - link to Mozilla's Acceptable Use Policy, i.e. https://www.mozilla.org/about/legal/acceptable-use/
#   $attrs (string) - specific attributes added to external links
faq-question-acceptable-use-answer-a-html = { -brand-name-firefox-relay } has the same <a href="{ $url }" { $attrs }>conditions of use as all { -brand-name-mozilla } products</a>. We have a zero-tolerance policy when it comes to using { -brand-name-relay } for malicious purposes like spam, resulting in the termination of a user’s account. We take measures to prevent users from violating our conditions by:
faq-question-acceptable-use-answer-measure-account = Requiring a { -brand-name-firefox-account(capitalization: "uppercase") } with a verified email address
faq-question-acceptable-use-answer-measure-unlimited-payment = Requiring payment for a user to create more than five aliases
faq-question-acceptable-use-answer-measure-rate-limit = Rate-limiting the number of aliases that can be generated in one day
#   $url (url) - link to the Terms of Service, i.e. https://www.mozilla.org/about/legal/terms/firefox-relay/
#   $attrs (string) - specific attributes added to external links
faq-question-acceptable-use-answer-b-html = Please review our <a href="{ $url }" { $attrs }>Terms of Service</a> for more information.

modal-custom-alias-picker-heading = Create a new custom alias
modal-custom-alias-picker-warning = All you need to do is make up and share a unique alias that uses your custom domain — the alias will be generated automatically. Try “shop@customdomain.mozmail.com” next time you shop online, for example.
modal-custom-alias-picker-form-heading = Or, create a custom alias manually
modal-custom-alias-picker-form-prefix-label = Enter alias prefix
# This is shown in placeholder of the form field in which users can pick a custom alias prefix for their own subdomain,
# as an example of what email addresses to use (e.g. `coffee@customdomain.mozmail.com`).
modal-custom-alias-picker-form-prefix-placeholder = e.g. "coffee"
modal-custom-alias-picker-form-submit-label = Generate Alias
modal-custom-alias-picker-creation-error = Your custom alias could not be created. Please try again, or send an email to the alias to create it.

popover-custom-alias-explainer-heading = How to create custom aliases
popover-custom-alias-explainer-explanation = All you need to do is make up and share a unique alias that uses your custom domain — the alias will be generated automatically. Try “shop@customdomain.mozmail.com” next time you shop online, for example.
popover-custom-alias-explainer-generate-button-heading = Generate a custom alias manually
popover-custom-alias-explainer-generate-button-label = Generate custom alias
popover-custom-alias-explainer-close-button-label = Close

# Label for each of the dots representing a tip in a panel in the bottom right-hand corner.
# Variables
#   $nr (number) - Which tip can be seen by clicking/tapping this particular dot.
tips-switcher-label = Tip { $nr }

tips-custom-alias-heading = Creating aliases using your custom domain
tips-custom-alias-content = All you need to do is make up and share a unique alias that uses your custom domain — the alias will be generated automatically. Try “shop@customdomain.mozmail.com” next time you shop online, for example.

# This copy (and the term "critical email") is not final yet:
tips-critical-emails-heading = Critical email forwarding
# This copy (and the term "critical email") is not final yet:
tips-critical-emails-content = Relay allows you to receive only critical emails sent to an alias. You’ll receive emails like receipts but not spam or marketing emails.

# This copy is not final yet:
tips-addon-signin-heading = Sign in with your aliases
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
