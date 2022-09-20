# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

menu-upgrade-button = Upgrade
menu-toggle-open = Open menu
menu-toggle-close = Close menu
nav-dashboard = Dashboard
nav-phone = Phone Number
nav-settings = Settings
nav-support = Help and Support
nav-sign-out = Sign Out
nav-contact = Contact Us
nav-duo-description = Switch dashboards
nav-duo-email-mask-alt = Email masks
nav-duo-phone-mask-alt = Phone masks

setting-api-key-copied-alt = Click to copy

waitlist-control-country-label-2 = What country or region do you live in?

fx-desktop-2 = { -brand-name-firefox } for Desktop
fx-mobile-2 = { -brand-name-firefox } for Mobile
fx-containers = { -brand-name-firefox } Containers

## Phone Onboarding

phone-onboarding-step1-headline = Introducing phone number masking
phone-onboarding-step1-body = With phone number masking, you can create a phone number mask that helps you  protect your true phone number. Share it, and receive messages privately.
phone-onboarding-step1-list-item-1 = Share a masked phone number that forwards messages to your true number.
phone-onboarding-step1-list-item-2 = Need to confirm a dinner reservation? Share your phone number mask instead.
phone-onboarding-step1-list-item-3 = With phone number masking, you can receive texts. Replying is not yet available.

phone-onboarding-step1-button-label = Upgrade to get phone number masking
phone-onboarding-step1-period-toggle-yearly = Yearly
phone-onboarding-step1-period-toggle-monthly = Monthly
# Variables:
#   $monthly_price (string) - the monthly cost (including currency symbol) for Relay Premium. Examples: $0.99, 0,99 €
phone-onboarding-step1-button-price = { $monthly_price } / month
phone-onboarding-step1-button-price-note  = (Billing yearly)
phone-onboarding-step1-button-cta = Upgrade Now

phone-onboarding-step2-headline = Verify your true phone number
phone-onboarding-step2-body = Provide the phone number where you’ll receive your texts and calls (in the future). We’ll send a 6-digit code to this number to verify it.
phone-onboarding-step2-input-placeholder = Enter your phone number
phone-onboarding-step2-button-cta = Send code
phone-onboarding-step2-invalid-number = { $phone_number } is not a valid number. Please review and provide a real phone number.

phone-onboarding-step3-headline = Verify your true phone number
# Variables:
#   $phone_number (string) - The phone number to which a verification code was sent, e.g. +1 (415) 555-2671
#   $remaining_minutes (number) - The number of minutes (to be added to $remaining_seconds) left before the verification code expires
#   $remaining_seconds (number) - The number of seconds (to be added to $remaining_minutes) left before the verification code expires
phone-onboarding-step3-body =
    { $remaining_minutes ->
        [0] {$remaining_seconds ->
            [1] Please enter the verification code that was sent to <span>{ $phone_number } </span> within <strong>{ $remaining_seconds } second</strong>.
            *[other] Please enter the verification code that was sent to <span>{ $phone_number } </span> within <strong>{ $remaining_seconds } seconds</strong>.
        }
        *[other] Please enter the verification code that was sent to <span>{ $phone_number } </span> within <strong>{ $remaining_minutes }:{ NUMBER($remaining_seconds, minimumIntegerDigits: 2) } minutes</strong>.
    }

phone-onboarding-step3-input-placeholder = Enter 6-digit code
phone-onboarding-step3-button-cta = Confirm my phone number
phone-onboarding-step3-button-edit = Edit true phone number
phone-onboarding-step3-button-resend = Resend verification code
phone-onboarding-step3-error-exipred = Try again—the time limit expired.
phone-onboarding-step3-error-cta = Send a new code
phone-onboarding-step3-code-fail-title = Wrong verification code
phone-onboarding-step3-code-fail-body = Please try again or request a new code
phone-onboarding-step3-code-success-title = Congratulations!
phone-onboarding-step3-code-success-body = You’re now ready to choose your phone number mask.
phone-onboarding-step3-code-success-subhead-title = What’s next?
phone-onboarding-step3-code-success-subhead-body = Choose your phone number mask and start using { -brand-name-firefox-relay } to protect your true phone number.
phone-onboarding-step3-code-success-cta = Search for phone number masks
phone-onboarding-step3-loading = Based on your true phone number, { -brand-name-relay } is looking for similar number combinations available to you.

phone-onboarding-step4-country = United States and Canada
phone-onboarding-step4-body = These available phone number masks are similar to your true phone number.
phone-onboarding-step4-sub-body = Once you register a phone number mask, you cannot change it.
phone-onboarding-step4-smiliar-phone = Similar to { $phone_number }
phone-onboarding-step4-input-search = Enter an area code
phone-onboarding-step4-button-more-options = Show me other options
phone-onboarding-step4-button-register-phone-number = Register phone number mask
phone-onboarding-step4-search-results-body = Phone number masks available in <strong>{ $location }</strong>. Once you register a phone number mask, you cannot change it.
phone-onboarding-step4-confirm-message = To confirm your your phone number mask, enter it below. This can’t be changed later.
phone-onboarding-step4-confirm-alt-cancel = Cancel
phone-onboarding-step4-body-confirm-relay-number = Please confirm that this is the phone number mask you want. This can’t be changed later.
phone-onboarding-step4-button-confirm-relay-number = Confirm
phone-onboarding-step4-code-success-title = Congratulations!
phone-onboarding-step4-code-success-body = You’ve registered your new phone number mask.
phone-onboarding-step4-code-success-subhead-title = What’s next?
phone-onboarding-step4-code-success-subhead-body-p1 = { -brand-name-relay } sent you a text with a new contact card through which we’ll forward your calls and messages.
phone-onboarding-step4-code-success-subhead-body-p2 = Please save the contact so you can identify your forwarded messages and calls.
phone-onboarding-step4-code-success-cta = Continue
phone-onboarding-step4-results= No results found. Please try again.

# Phone Settings
phone-settings-caller-sms-log = Caller and texts log
phone-settings-caller-sms-log-description = Allow { -brand-name-firefox-relay } to keep a log of your callers and text senders.
phone-settings-caller-sms-log-warning = If you decide to opt out from this preference, you will lose the ability to block and reply to senders or callers. If you’ve blocked any, they will become unblocked and your existing caller and text sender log will be permanently cleared from your history.

# Phone Resend SMS Banner
phone-banner-resend-welcome-sms-cta = Resend welcome text
phone-banner-resend-welcome-sms-title = Quick Tip
phone-banner-resend-welcome-sms-body =  Remember to save the contact we shared with you by text to help you identify messages forwarded by { -brand-name-relay }. Can’t find it?

# Phone What's New
whatsnew-feature-phone-header = Introducing phone number masking
whatsnew-feature-phone-snippet = With phone number masking, you can now create a phone number mask that helps you…
whatsnew-feature-phone-description = With phone number masking, you can now create a phone number mask that helps you get texts and calls without revealing your true number.
whatsnew-feature-phone-upgrade-cta = Upgrade now

# Phone Dashboard
phone-statistics-remaining-call-minutes = Remaining call minutes
phone-statistics-remaining-texts = Remaining texts
phone-statistics-calls-texts-forwarded = Calls and texts forwarded
phone-statistics-calls-texts-blocked = Calls and texts blocked
phone-dashboard-metadata-forwarded-to = Forwarded to:
phone-dashboard-metadata-date-created = Date Created:
phone-dashboard-number-copied = Copied!
phone-dashboard-forwarding-toggle-enabled = Forwarding enabled
phone-dashboard-forwarding-toggle-disabled = Forwarding disabled
phone-dashboard-forwarding-enabled = { -brand-name-relay } is currently forwarding all phone calls and text messages to your true phone number.
phone-dashboard-forwarding-blocked = { -brand-name-relay } is blocking all phone calls and text messages—you will not receive anything from your phone number mask.
phone-dashboard-senders-header = Callers and text senders
phone-dashboard-sender-table-title-sender = Sender
phone-dashboard-sender-table-title-activity = Latest Activity
phone-dashboard-sender-table-title-action = Action
phone-dashboard-sender-disabled-body =  You have disabled the Caller and Sender log. Go to your settings to
        enable { -brand-name-relay } to keep a log of your callers and senders.
phone-dashboard-sender-disabled-update-settings = Update Settings
phone-dashboard-sender-empty-body = You haven’t received any call or message yet!
phone-dashboard-header-new = New

vpn-relay-welcome-headline = Welcome to your new protection plan
vpn-relay-welcome-subheadline = { -brand-name-firefox-relay } + { -brand-name-mozilla-vpn }
vpn-relay-go-relay-body = Protect your email inbox and your phone number
vpn-relay-go-relay-cta = Go to { -brand-name-relay }
vpn-relay-go-vpn-body = Protect your connection and online actvitiy
vpn-relay-go-vpn-cta = Download { -brand-name-mozilla-vpn }

## Replies

profile-label-replies = Replies
profile-replies-tooltip = You can reply to emails received through this mask, and { -brand-name-firefox-relay } will continue to protect your true email address.

-brand-name-vpn = VPN

## VPN and Relay Bundle What's New Announcement

whatsnew-feature-bundle-header = Introducing: { -brand-name-relay } + { -brand-name-vpn } subscription plan
whatsnew-feature-bundle-snippet = Upgrade your subscription to get both { -brand-name-firefox-relay-premium } + { -brand-name-mozilla-vpn }…
# Variables:
#   $monthly_price (string) - the monthly cost (including currency symbol) for a given plan. Examples: $0.99, 0,99 €
#   $savings (string) - the percentage saved (including % symbol) for a given plan. Examples: 50%, 70%
whatsnew-feature-bundle-body = Upgrade your subscription to get both { -brand-name-firefox-relay-premium } + { -brand-name-mozilla-vpn } for { $monthly_price }/month. Save { $savings }!
whatsnew-feature-bundle-upgrade-cta = Upgrade now

## VPN and Relay Bundle Banner

bundle-banner-header = { -brand-name-firefox-relay } with <vpn-logo>{ -brand-name-mozilla-vpn }</vpn-logo>
bundle-banner-subheader = Security, reliability and speed — on every device, anywhere you go.
bundle-banner-body = Surf, stream, game, and get work done while maintaining your privacy online. Whether you’re traveling, using public Wi-Fi, or simply looking for more online security, we will always put your privacy first.
bundle-banner-1-year-plan = 1 year plan: <b>{ -brand-name-firefox-relay-premium } + { -brand-name-mozilla-vpn }</b>
# Variables:
#   $monthly_price (string) - the monthly cost (including currency symbol) for a given plan. Examples: $0.99, 0,99 €
bundle-price-monthly = Monthly: <monthly-price>{ $monthly_price }</monthly-price>
# Variables:
#   $savings (string) - the percentage saved (including % symbol) for a given plan. Examples: 50%, 70%
#   $old_price (string) - the outdated monthly cost (including currency symbol) for a given plan. This value has a strikethrough.
bundle-price-save-amount = Save { $savings } <outdated-price>Normally { $old_price }</outdated-price>
bundle-banner-alt = { -brand-name-mozilla-vpn } and { -brand-name-relay }
bundle-banner-cta = Get { -brand-name-mozilla-vpn } + { -brand-name-relay }
# Variables:
#   $days_guarantee (string) - the number of days for money-back guarantee. Examples: 30, 90
bundle-banner-money-back-guarantee = { $days_guarantee }-day money-back guarantee for first-time subscribers
# Variables:
#   $num_vpn_servers (string) - the number of VPN servers. Examples: 400, 500, 600
bundle-feature-one = More than { $num_vpn_servers } servers
# Variables:
#   $num_vpn_countries (string) - the number of VPN available countries. Examples: 30, 40, 50
bundle-feature-two = More than { $num_vpn_countries } countries
bundle-feature-three = Fast and secure network

## Phone Banner

phone-banner-pill-new = New!
phone-banner-callout = Phone number masking
phone-banner-header = Layer on even more protection with phone number masking
phone-banner-body = With phone number masking, you can choose a phone number mask that protects your phone number. Share your phone number mask to receive and reply to calls and texts privately without revealing your true phone number.
phone-banner-cta-landing = Sign Up
phone-banner-cta-user = Upgrade now
# Variables:
#   $nr_calls (number) - the number of calls one can make per month
#   $nr_texts (number) - the number of texts one can send and receive per month
phone-banner-float-limits = { $nr_calls } call minutes + { $nr_texts } texts
phone-banner-float-replies = Reply to texts privately

## Comparison table of the different plans

# Variables:
#   $monthly_price (string) - the monthly cost (including currency symbol) for a given plan. Examples: $0.99, 0,99 €
# Please preserve the asterisk (*) following the price; it indicates that the price is billed yearly.
plan-matrix-bundle-offer-heading = Limited-time only: { -brand-name-relay-premium } + { -brand-name-mozilla-vpn } ${ $monthly_price }/month*
plan-matrix-bundle-offer-content = Try { -brand-name-firefox-relay } email masks and start protecting your email inbox. Then upgrade to { -brand-name-relay-premium } for even more flexibility and customized control.
plan-matrix-heading-features = Features
plan-matrix-heading-plan-free = Limited email protection
plan-matrix-heading-plan-premium = Email protection
plan-matrix-heading-plan-phones = Email & phone protection
plan-matrix-heading-plan-bundle = Add VPN protection
plan-matrix-heading-plan-bundle-alt = Get { -brand-name-relay-premium } and { -brand-name-mozilla-vpn }
# This heading accompanies the number of email masks available in each plan (i.e. 5 for free plans, unlimited otherwise)
plan-matrix-heading-feature-email-masks = Email masks
plan-matrix-heading-feature-browser-extension = Browser extension
plan-matrix-heading-feature-email-tracker-removal = Remove email trackers
plan-matrix-heading-feature-promo-email-blocking = Block promotional emails
plan-matrix-heading-feature-email-subdomain = Email subdomain
plan-matrix-heading-feature-email-reply = Reply to forwarded emails
plan-matrix-heading-feature-phone-mask = Phone number mask
plan-matrix-heading-feature-vpn = Access to <vpn-logo>{ -brand-name-mozilla-vpn }</vpn-logo>
plan-matrix-feature-list-email-masks-unlimited = Unlimited email masks
# Variables:
#   $mask_limit (number) - the number of masks included with a particular plan
plan-matrix-feature-list-email-masks = { $mask_limit } email masks
plan-matrix-feature-list-browser-extension = Browser extension
plan-matrix-feature-list-email-tracker-removal = Remove email trackers
plan-matrix-feature-list-promo-email-blocking = Block promotional emails
plan-matrix-feature-list-email-subdomain = Email subdomain
plan-matrix-feature-list-email-reply = Reply to forwarded emails
plan-matrix-feature-list-phone-mask = Phone number mask
plan-matrix-feature-list-vpn = Access to <vpn-logo>{ -brand-name-mozilla-vpn }</vpn-logo>
plan-matrix-heading-price = Price
plan-matrix-feature-count-unlimited = Unlimited
plan-matrix-feature-included = Included
plan-matrix-feature-not-included = Not included
plan-matrix-price-free = Free
# Variables:
#   $monthly_price (string) - the monthly cost (including currency symbol) for a given plan. Examples: $0.99, 0,99 €
plan-matrix-price-monthly = { $monthly_price }/month
plan-matrix-price-period-yearly = Yearly
# We're showing a monthly price to make it easier to compare, but with an asterisk noting that it'll be billed yearly
plan-matrix-price-period-yearly-note = Billing yearly
plan-matrix-price-period-monthly = Monthly
# Variables:
#   $percentage (number) - how many percent discount this plan gets subscribers on the regular Mozilla VPN price
plan-matrix-price-vpn-discount = Save { $percentage }% on regular VPN price
plan-matrix-pick = Sign Up
plan-matrix-join-waitlist = Join the Waitlist
