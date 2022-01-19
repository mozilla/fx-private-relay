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

# This will be read to screen readers when focusing the button to copy an alias to the clipboard.
# Variables:
#   $address (string) - Alias address, e.g. wz7n0vykd@mozmail.com.
profile-label-click-to-copy-alt = Click to copy alias { $address }.

profile-details-expand = Show alias details
profile-details-collapse = Hide alias details

profile-filter-category-button-label = Filter visible aliases
profile-filter-category-button-tooltip = Filter aliases by domain and/or whether they are enabled or disabled
profile-filter-category-title = Filter visible aliases

# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
#   $domain (string) - Applicable domain, i.e. `.mozmail.com`
modal-domain-register-available-v2 = <subdomain>{ $subdomain }</subdomain><domain>.{ $domain }</domain> is available!
# Variables:
#   $subdomain (string) - Chosen subdomain, i.e. the part after `@` and before `.mozmail.com`
modal-domain-register-confirmation-checkbox-v2 = Yes, I want to register <subdomain>{ $subdomain }</subdomain>

# Variables:
#   $step (number) - Which step the user currently is on
#   $max (number) - Total number of steps
multi-part-onboarding-step-counter = Step { $step } of { $max }.

profile-label-generate-new-alias-menu-random = Random Alias
# Variables
#   $subdomain (string) - The user's custom subdomain, if any, e.g. `@eduardofeo`.
profile-label-generate-new-alias-menu-custom = @{ $subdomain } Alias

tips-header-title = Help & Tips
tips-header-button-close-label = Dismiss
tips-footer-link-faq-label = FAQs
tips-footer-link-faq-tooltip = Frequently asked questions
tips-footer-link-feedback-label = Feedback
tips-footer-link-feedback-tooltip = Give feedback
tips-footer-link-support-label = Support
tips-footer-link-support-tooltip = Contact support

modal-custom-alias-picker-heading = Create a new custom alias
modal-custom-alias-picker-warning = You don’t need to create custom aliases before you use them; as soon as you receive an email sent to your custom domain, the alias will be generated automatically. All you need to do is make up a prefix—the part of the email that goes before the @.
modal-custom-alias-picker-form-heading = Generate a custom alias manually
modal-custom-alias-picker-form-prefix-label = Enter alias prefix
# This is shown in the form field in which users can pick a custom alias prefix for their own subdomain.
# Please avoid using real company names here.
modal-custom-alias-picker-form-prefix-placeholder = acme_corp
modal-custom-alias-picker-form-submit-label = Generate Alias
modal-custom-alias-picker-creation-error = Your custom alias could not be created. Please try again, or send an email to the alias to create it.

popover-custom-alias-explainer-heading = How to create custom aliases
popover-custom-alias-explainer-explanation = You don’t need to create custom aliases before you use them; as soon as you receive an email sent to your custom domain, the alias will be generated automatically. All you need to do is make up a prefix—the part of the email that goes before the @.
popover-custom-alias-explainer-generate-button-heading = Generate a custom alias manually
popover-custom-alias-explainer-generate-button-label = Generate custom alias
popover-custom-alias-explainer-close-button-label = Close

tips-custom-alias-heading = Creating aliases using your custom domain
tips-custom-alias-content = You don’t need to create custom aliases before you use them; as soon as you receive an email sent to your custom domain, the alias will be generated automatically. All you need to do is make up a prefix—the part of the email that goes before the @.
