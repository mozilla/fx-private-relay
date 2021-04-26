# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

### Brands
### Dev Note: When adding to this section, use this file for naming conventions: https://github.com/mozilla/bedrock/blob/master/l10n/en/brands.ftl

-brand-name-firefox = Firefox
-brand-name-firefox-relay = Firefox Relay
-brand-name-firefox-account = Firefox Account
-brand-name-firefox-browser = Firefox Browser

### Navigation 

logo-alt= { -brand-name-firefox-relay }
nav-home = Home
# FAQ stands for Frequently Asked Questions. The intent of this page is to answer commonly asked questions.
nav-faq = FAQ

### Home Page
### URL: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/

home-hero-headline = Hide your real email address to help protect your identity
home-hero-copy = { -brand-name-firefox-relay } makes it easy to create aliases, randomly generated email addresses that forward to your real inbox. Use it to protect your online accounts - and your identity - from hackers. Sign in with your { -brand-name-firefox-account } to get started.
home-hero-cta = Sign In

how-it-works-headline = How It Works
how-it-works-subheadline = Protect your personal identity everywhere you use the { -brand-name-firefox-browser }.
how-it-works-step-1-headline = Install the extension

# Variables:
#   $addon (url) - https://addons.mozilla.org/firefox/addon/private-relay/
#   $attrs (string) - specific attributes added to external links
how-it-works-step-1-copy-html = <a href="{ $addon }" { $attrs }>Download the Relay extension for { -brand-name-firefox }</a>. Select the icon that appears on your { -brand-name-firefox } toolbar to access the sign in page. Sign in with your { -brand-name-firefox-account } to get started.
how-it-works-step-2-headline = Create a new alias
how-it-works-step-2-copy = As you browse, the Relay icon will appear in form fields where sites ask for your email address. Select it to generate a new, random address that ends in @relay.firefox.com. Relay will forward messages to the primary email address associated with your account.
how-it-works-step-3-headline = Manage your account
how-it-works-step-3-copy = Sign in to the Relay website to keep track of the aliases you’ve created.  If you find that one receives spam or unwanted messages, you can block all messages or even delete the alias, right from the management page.
