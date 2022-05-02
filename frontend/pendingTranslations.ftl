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

landing-use-cases-shopping = Shopping
landing-use-cases-shopping-hero-heading = Shopping with email masks
landing-use-cases-shopping-hero-content1 = Want to buy something online and don’t know or fully trust the shop?
landing-use-cases-shopping-hero-content2 = Use an email mask whenever you shop online. Get the confirmation sent to your real email and then easily turn the mask off anytime later.

landing-use-cases-on-the-go = On the Go
landing-use-cases-on-the-go-heading = On the go with { -brand-name-relay }
landing-use-cases-on-the-go-lead = Instantly make a custom email mask anywhere and everywhere you go! 
landing-use-cases-on-the-go-connect-heading = Connect on the go
landing-use-cases-on-the-go-connect-body = Use your email mask when you want to privately sign into your favorite coffee shop or public wifi 
landing-use-cases-on-the-go-receipt-heading = Get email receipts
landing-use-cases-on-the-go-receipt-body = Share a custom email mask for in-store shopping receipts without sharing your real email 
landing-use-cases-on-the-go-phone-heading = Use on your phone
landing-use-cases-on-the-go-phone-body = No matter where you are create a custom email mask in seconds for anything you want to do 

landing-use-cases-on-the-go-connect-image-alt = Image of a person sitting on a table looking at their tablet
landing-use-cases-on-the-go-receipt-image-alt = Image of a person on their phone in front of a store cart
landing-use-cases-on-the-go-phone-image-alt = Image of a person checking their phone 

landing-use-cases-signups = Signups
landing-use-cases-signups-hero-heading = Worry-free signups
landing-use-cases-signups-hero-content1 = Want to start a new subscription, RSVP to an event, or get a bargain promo code without having spam flooding your inbox?
landing-use-cases-signups-hero-content2 = Before you complete that next signup, use an email mask instead of your real one to protect your info and keep control over your inbox.

landing-use-cases-shopping-image-alt = Image of phone for shopping tab
landing-use-cases-social-networks-image-alt = Image of thumb up and chat bubbles for social networks tab
landing-use-cases-on-the-go-image-alt = Image of luggage for on the go tab
landing-use-cases-signups-image-alt = Image of notebook and a document for the signups tab
landing-use-cases-gaming-image-alt= Image of gaming controller for gaming tab

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
tips-critical-emails-content = Relay allows you to receive only critical emails sent to an mask. You’ll receive emails like receipts but not spam or marketing emails.

# This copy is not final yet:
tips-addon-signin-heading = Sign in with your masks
# This copy is not final yet:
tips-addon-signin-content = To sign in with a previously-used alias, open the context menu (right-click or control-click) where the site asks for your email. You’ll be able to select the alias and auto-fill the email field.

waitlist-heading = Join the { -brand-name-relay-premium } Waitlist
waitlist-lead = Get notified when { -brand-name-firefox-relay-premium } is available for your region.
waitlist-control-required = Required
waitlist-control-email-label = What is your email address?
waitlist-control-email-placeholder = yourname@example.com
waitlist-control-country-label = What country do you live in?
waitlist-control-locale-label = Select your preferred language.
waitlist-submit-label = Join the Waitlist
waitlist-privacy-policy-agree = By clicking “{ waitlist-submit-label }”, you agree to our <a>Privacy Policy</a>.
waitlist-privacy-policy-use = Your information will only be used to notify you about { -brand-name-firefox-relay-premium } availability.
waitlist-subscribe-success = You’re on the list! Once { -brand-name-firefox-relay-premium } becomes available for your region, we’ll email you.
waitlist-subscribe-error-connection = There was an error adding you to the waitlist. Please check your connection, then try again.
waitlist-subscribe-error-unknown = There was an error adding you to the waitlist. Please try again.
