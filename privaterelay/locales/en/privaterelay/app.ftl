# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

### Brands
### Dev Note: When adding to this section, use this file for naming conventions: https://github.com/mozilla/bedrock/blob/master/l10n/en/brands.ftl

-brand-name-firefox = Firefox
-brand-name-firefox-relay = Firefox Relay
-brand-name-firefox-account = Firefox Account
-brand-name-firefox-browser = Firefox Browser

### Header 
logo-alt= { -brand-name-firefox-relay }
nav-menu = Menu
nav-home = Home
# FAQ stands for Frequently Asked Questions. The intent of this page is to answer commonly asked questions.
nav-faq = FAQ

### Footer
nav-footer-privacy = Privacy
nav-footer-relay-terms = Relay Terms
nav-footer-legal = Legal


### Home Page
### URL: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/

home-hero-headline = Hide your real email address to help protect your identity
home-hero-copy = { -brand-name-firefox-relay } makes it easy to create aliases, randomly generated email addresses that forward to your real inbox. Use it to protect your online accounts - and your identity - from hackers. Sign in with your { -brand-name-firefox-account } to get started.
home-hero-cta = Sign In

how-it-works-headline = How It Works
how-it-works-subheadline = Protect your personal identity everywhere you use the { -brand-name-firefox-browser }.
how-it-works-step-1-headline = Install the extension

# Variables:
#   $url (url) - https://addons.mozilla.org/firefox/addon/private-relay/
#   $attrs (string) - specific attributes added to external links
how-it-works-step-1-copy-html = <a href="{ $addon }" { $attrs }>Download the Relay extension for { -brand-name-firefox }</a>. Select the icon that appears on your { -brand-name-firefox } toolbar to access the sign in page. Sign in with your { -brand-name-firefox-account } to get started.
how-it-works-step-2-headline = Create a new alias
how-it-works-step-2-copy = As you browse, the Relay icon will appear in form fields where sites ask for your email address. Select it to generate a new, random address that ends in @relay.firefox.com. Relay will forward messages to the primary email address associated with your account.
how-it-works-step-3-headline = Manage your account
how-it-works-step-3-copy = Sign in to the Relay website to keep track of the aliases you’ve created.  If you find that one receives spam or unwanted messages, you can block all messages or even delete the alias, right from the management page.

### FAQ Page
### URL: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/faq

faq-headline = Frequently Asked Questions
faq-question-1-question = What about spam?
# Variables:
#   $url (url) - https://addons.mozilla.org/firefox/addon/private-relay/
#   $attrs (string) - specific attributes added to external links
faq-question-1-answer-html = While Relay does not filter for spam, our email partner Amazon SES does block spam and malware. If Relay forwards messages you don’t want, you can update your Relay settings to block messages from the alias forwarding them. <br/><br/> If you see a broader problem of unwanted email from all of your aliases, please <a  href="{ $url }" { $attrs }>report this to us</a> so we can consider adjusting the SES spam thresholds for this service. <br/><br/> If you report these as spam, your email provider will see Relay as the source of spam, not the original sender.
faq-question-2-question = Why won’t a site accept my Relay alias?
# Variables:
#   $url (url) - https://addons.mozilla.org/firefox/addon/private-relay/
#   $attrs (string) - specific attributes added to external links
faq-question-2-answer-html = Some sites may not accept an email address that includes a subdomain (ie, the “relay” portion of @relay.firefox.com) and others have stopped accepting all addresses except those from Gmail, Hotmail, or Yahoo accounts. As Firefox Relay grows in popularity and issues more aliases, our service might be placed on a blocklist. If you are not able to use a Relay alias, <a  href="{ $url }" { $attrs }>please let us know</a>.
faq-question-3-question = Is Relay available only in the US?
faq-question-3-answer = The site is currently only available in English, but you can use the service anywhere.
faq-question-4-question = Can I reply to messages using my Relay alias?
# Variables:
#   $url (url) - https://github.com/mozilla/fx-private-relay/issues/99
#   $attrs (string) - specific attributes added to external links
faq-question-4-answer-html = Relay does not yet offer the ability to reply using an alias. If you try, nothing will happen. We are planning an additional feature to let you <a href="{ $url }" {$attrs}>reply anonymously to senders</a>.
faq-question-5-question = Can I make up my own Relay alias using the @relay.firefox.com domain?
faq-question-5-answer = Not currently, but we are considering new features including letting you create your own alias with a designated domain.
faq-question-6-question = What happens if Mozilla shuts down the Firefox Relay service?
faq-question-6-answer = We will give you advance notice that you need to change the email address of any accounts that are using Relay aliases.
faq-question-7-question = What if an email sent to my alias contains an attachment?
faq-question-7-answer = We now support attachment forwarding. However, there is a 150KB limit for email forwarding using Relay. Any emails larger than 150KB will not be forwarded.
