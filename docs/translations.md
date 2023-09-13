# Internationalization, Localization, and Translation

Relay users come from several regions and speak various languages. Relay developers need
to consider internationalization and localization (see [Terms](#terms)) when designing
features and making changes. This overview includes Mozilla- and Relay-specific notes.

- [How a User Experiences Relay](#how-a-user-experiences-relay)
- [Development Workflows](#development-workflows)
  - [Loading Translations](#loading-translations)
  - [Rebasing a Branch](#rebasing-a-branch)
  - [Reverting a Translation Commit](#reverting-a-translation-commit)
  - [Nightly Translation Updates](#nightly-translation-updates)
  - [Adding New Translatable Strings During Development](#adding-new-translatable-strings-during-development)
  - [Submitting Pending Translations](#submitting-pending-translations)
  - [Expanding a Premium Plan](#expanding-a-premium-plan)
  - [Viewing Translation Errors](#viewing-translation-errors)
- [The Technical Details of Translation](#the-technical-details-of-translation)
  - [Identifying the User's Preferred Languages](#identifying-the-users-preferred-languages)
  - [Picking the Language](#picking-the-language)
  - [Managing Languages and Translations](#managing-languages-and-translations)
  - [Shipping Translations](#shipping-translations)
- [The Technical Details of Region Selection](#the-technical-details-of-region-selection)
  - [Identifying the User's Region](#identifying-the-users-region)
  - [Identifying Available Plans and Prices](#identifying-available-plans-and-prices)
- [Terms](#terms)
- [Standards for Identifiers](#standards-for-identifiers)

## How a User Experiences Relay

Localization affects the user's experience in several ways.

When an user first visits the Relay website, their browser gets the English server-side
rendered page, and then the page is re-rendered by JavaScript into their preferred
language. When none of the user's preferred languages are available, then the user gets
English.

The user sees different plan details based on their region. On the homepage there is a
table comparing Relay premium plans. If a premium plan is available in their region,
they see a price in their local currency. If a premium plan is not available, the user
sees a prompt to join a waitlist. The FAQ also changes, to omit entries for plans that
are unavailable in the user's region.

When a user selects a sign-in button (in the page header, labeled "Sign Up" and "Sign
In" in the English localization), they go to the Firefox Accounts website, and see
content in their preferred language. If they enter a new email, they go through Firefox
Account creation, and Firefox Accounts stores their preferred language on their profile.

When a user receives a forwarded email, there is a header and footer surrounding the
forwarded email content, translated into their preferred language, captured at Firefox
Account creation.

When a user selects a premium plan, they go to the Firefox Subscriptions website. The
page appears in their preferred language, except for the product details, which are in
the primary supported language for their region. The price is in their region's
currency.

When a user installs the Relay Add-On, the content is also in their preferred language,
and reflects the Relay premium plan availability in their region.

## Development Workflows

See "Working with translations" in the project [README.md][readme-wwt] for basic
instructions on working with translations, such as adding new strings.

[readme-wwt]: ../README.md#working-with-translations

### Loading Translations

The translations are in a separate repository, and included as a
[submodule][git-submodules].

When cloning a repo, you can also fetch the translations:

```sh
git clone --recurse-submodules https://github.com/mozilla/fx-private-relay.git
```

If you didn't use `--recurse-submodules` when cloning, you can setup up translations
with:

```sh
git submodule init
git submodule update
```

When checking out a branch, `git status` may show `privaterelay/locales` has changed,
when it is just synced with the branch. To sync the translations with the branch, you
can run `git submodule update --remote`. To automatically sync the translations
submodule when switching branches, set the configuration:

```sh
git config --global submodule.recurse true
```

[git-submodules]: https://git-scm.com/book/en/v2/Git-Tools-Submodules

### Rebasing a Branch

When rebasing a branch to pick up changes from `main`, you may see
`privaterelay/locales` in the "Changes not staged for commit". **Do not add this
directory**, as it may revert translations to an earlier version.

If you already added it to "Changes to be committed" (also known as the staging area),
for example with `git add -u`, you can remove it with:

```sh
git restore --staged privaterelay/locales
```

To remove it from the changed files, you can run _one of_:

```sh
git submodule update --remote
git restore privaterelay/locales
git checkout -- privaterelay/locales/
```

### Reverting a Translation Commit

If you accidentally commit an update to `privaterelay/locales`, you can remove it with
`git rebase`. This is a powerful tool that requires deeper understanding of `git`. See
[About Git][gh-git] for a tutorial, and
[On undoing, fixing, or removing commits in git][sr-fixup] for a guided experience.

1. Run `git rebase origin/main`, and take care of any conflicts.
2. Find the commit that changed locals with `git log -- privaterelay/locales`.
3. Start an interactive rebase with `git rebase -i origin/main`. A rebase plan will open
   in your editor.
4. Edit the commit line, changing from `pick` to `edit`. Save the rebase plan and exit
   the editor to start the rebase.
5. When rebasing gets to the target the commit, run `git checkout head~1 --
privaterelay/locales` to get the submodule version _before_ your change and
   automatically stage it (put it into "Changes to be committed").
6. Run `git rebase --continue` to continue the rebase.

If the only change in the commit was updating the submodule, you'll now have an empty
commit. You can remove it with another interactive rebase by removing the commit line
(which `git` will annotate with a `# empty` suffix).

[gh-git]: https://docs.github.com/en/get-started/using-git/about-git
[sr-fixup]: https://sethrobertson.github.io/GitFixUm/fixup.html

### Nightly Translation Updates

A GitHub action ["Fetch latest strings from the l10n repo"][ga-l10n] runs at midnight
UTC and updates the `privaterelay/locales` submodule to the latest commit. The commit
message is "Merge in latest l10n strings". If there are no translation updates, then
there will be no commit, but the action will still finish successfully.

The action uses a Personal Access Token (PAT), required to create the commit. If the
nightly update fails, check that the PAT is still valid, and regenerate as needed.

[ga-l10n]: https://github.com/mozilla/fx-private-relay/actions/workflows/l10n-sync.yml

### Adding New Translatable Strings During Development

If this is your first time working with translations, read the [Fluent Syntax
Guide][fl-syntax] while looking at some Relay `.ftl` files. This guide documents the
syntax and promotes specific usage, such as:

- [Variables][fl-syntax-variables] for strings with inserted values
- [References][fl-syntax-references] for using strings like product names inside other strings
- [Selectors][fl-syntax-selectors] for strings that include a number or count

The document [Good Practices for Developers][good-practice] has useful tips for writing
strings, such as:

- Write Everything Twice
- Prefer separate messages over variants for UI logic

Use pending translations when developing new content or updating content for Relay. The
product manager and other reviewers can make tweaks to the content during acceptance,
without throwing away translator work or requiring ID updates. The pending translations
for the frontend are in [frontend/pendingTranslations.ftl][], and the pending
translations for the backend are in [privaterelay/pending_locales/en/pending.ftl][].

When updating content, add a digit to the string ID to help make it clear that this will
replace another string. For example, `premium-promo-availability-warning-4` replaces
`premium-promo-availability-warning-3`. Do not re-use IDs for new strings.

[fl-syntax-references]: https://projectfluent.org/fluent/guide/references.html
[fl-syntax-selectors]: https://projectfluent.org/fluent/guide/selectors.html
[fl-syntax-variables]: https://projectfluent.org/fluent/guide/variables.html
[fl-syntax]: https://projectfluent.org/fluent/guide/
[frontend/pendingTranslations.ftl]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/pendingTranslations.ftl
[good-practice]: https://github.com/projectfluent/fluent/wiki/Good-Practices-for-Developers
[privaterelay/pending_locales/en/pending.ftl]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/pending_locales/en/pending.ftl

#### Translatable Strings with Embedded HTML

Some Relay strings are more natural with embedded HTML, especially prose that links to
other content. For Relay strings that include HTML, set the string to the complete
sentence or UI element, and inject element attributes as variables. For example, if the
rendered HTML is:

```html
<p class="relay-footnote">
  To change your email preference, see
  <a class="never-blue" href="https://relay.firefox.com/accounts/settings/">
    Relay Settings
  </a>
</p>
```

The Fluent string would be something like:

```text
email-footer-pref-link =
  To change your email preference, see
  <a href="${ settings_url }" ${ link_attrs }>{ settings-headline }</a>
```

Translators can re-arrange the sentence as needed for their language, while avoiding
mistranslating a URL or HTML attributes. The Pontoon UI helps translators with HTML
strings, and Pontoon linters detect some translation issues such as malformed HTML and
missing variables.

The Django email template may look like:

```html
<p class="relay-footnote">
  {% ftlmsg 'email-footer-pref-link'
  settings_url=SITE_ORIGIN|add:'/accounts/settings/'
  link_attrs='class="never-blue"' %}
</p>
```

The frontend uses the `<Localized>` component for strings with embedded HTML. See the
[profile-label-welcome-html][] code for details.

[profile-label-welcome-html]: https://github.com/mozilla/fx-private-relay/blob/f5c5ebf568639810db45de1ebb69f2498600d58c/frontend/src/pages/accounts/profile.page.tsx#L285-L293

### Submitting Pending Translations

The `privaterelay/locales` directory is a checkout of the git repository
[mozilla-l10n/fx-private-relay-i10n][]. To add new strings for translation,
open a pull request against that repository.

The `privaterelay/locales` checkout is an `https` checkout by default, requiring a
GitHub password when pushing the branch. To switch to an `ssh` checkout and use your SSH
key:

```sh
cd privaterelay/locales
git remote set-url origin git@github.com:mozilla-l10n/fx-private-relay-l10n.git
git remote set-url origin --push git@github.com:mozilla-l10n/fx-private-relay-l10n.git
```

To prepare translatable strings for a pull request, first checkout the main branch:

```sh
cd privaterelay/locales
git fetch
git checkout main
```

Copy translations from [frontend/pendingTranslations.ftl][] and / or
[privaterelay/pending_locales/en/pending.ftl][] to the proper files in
`private/locales/en/`. Do not change the translation files for other languages.

When ready, create and push a branch:

```sh
cd privaterelay/locales
git branch message-updates-yyymmdd
git status
git commit -u
git push -u origin message-updates-yyymmdd
```

You can then visit [mozilla-l10n/fx-private-relay-i10n][] to create the pull request,
and make changes locally for any code review feedback.

After the l10n team merges the new strings, the next nightly translation update brings
them into Relay's `main` branch. At that point, you should create a pull request to
remove the redundant strings from `frontend/pendingTranslations.ftl` and
`privaterelay/pending_locales/en/pending.ftl`.

[mozilla-l10n/fx-private-relay-i10n]: https://github.com/mozilla-l10n/fx-private-relay-l10n

### Expanding a Premium Plan

Adding new regions to a premium plan is a cross-company effort, requiring help and
support from the Subscription Platform, Quality Assurance, Legal, Localization, and
Customer Support. This section describes the code changes for Relay.

Premium plan expansion can take months. A Relay engineer should create a waffle flag for
the expansion effort, so that engineers can incrementally ship expansion changes and
staff can test expansion in production.

The Relay product manager creates Stripe prices for each subscription term (such as
monthly and yearly) for each new region, and gives the price IDs to the Relay engineer.
The product manager works with the Localization team to pick the primary language for
that region as well. Relay engineering does not need to know this choice, unless there
are multiple prices distinguished by language for a single region.

In September 2023, the product manager creates Stripe prices manually, and so we've only
set them up for production. In development and stage, the active testing price is for
the United States in English.

The Relay engineer updates the data structures in [privaterelay/plans.py][]:

1. New currencies in `CurrencyStr`
2. New regions in `CountryStr`
3. New prices details in `_STRIPE_PLAN_DATA`
4. A new section in `_RELAY_PLANS`, such as `premium_expansion`, with the expanded
   regions
5. Update the relevant functions to take a boolean signalling the waffle flag is
   on or off. See [PR #3745][pr-3745], which retired the 2023 expansion flag, for
   details.

Relay staff can turn on the waffle flag for themselves and others, and test the
new content and purchase flows.

> [!NOTE]
> When testing account and purchase flows, change the browser language preference
> (`intl.accept_languagues`) rather than use an extension, and use a Firefox Account
> created with that language preference.
>
> This is because many language-switcher extensions are not allowed to run on Firefox
> Accounts, and email forwarding processes use the `Accept-Language` header captured by
> Firefox Accounts. See
> [Identifying The User's Preferred Languages](#identifying-the-users-preferred-languages)
> for more information.

When the expansion ships to all users, a Relay engineer can cleanup the data
structures:

1. Merge the expanded section in `_RELAY_PLANS`, and re-sort
2. Drop the expansion boolean, or add a comment for the unused variable, or leave
   flexible code for future expansions.
3. Remove other code and documentation references to the expansion waffle flag

[privaterelay/plans.py]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/plans.py
[pr-3745]: https://github.com/mozilla/fx-private-relay/pull/3745

### Viewing Translation Errors

The web server library [django-ftl][] logs when a translation is not available. The log
message, sent to `stderr` with severity `ERROR` and name `django_ftl.message_errors`,
looks like:

> FTL exception for locale [es-mx], message 'relay-email-your-dashboard',
> args {}: KeyError('relay-email-your-dashboard')"

The report [FTL Errors in Relay Production][ftl-report] gathers and categorizes recent
errors by "supported" (which means Relay has an assigned language team in Pontoon),
locale, and key (string ID). A Relay engineer uses this report to detect issues with a
particular team's translation files, or to find the top unsupported languages.

The supported language list is manually added to the source query. A Relay engineer
updates the query (called a "data source" in Looker) when new language teams take on the
Relay projects.

There are no error reports for the frontend website or the add-on. Relay engineers or QA
catch issues in translated strings with manual testing.

[django-ftl]: https://github.com/django-ftl/django-ftl
[ftl-report]: https://lookerstudio.google.com/reporting/63983869-6199-43b8-acb5-52971ffdd023

## The Technical Details of Translation

Relay supports 26 languages (as of September 2023). This section details the
technologies used to deploy those translations.

> [!WARNING]
> None of Relay's supported languages use [right-to-left scripts][].
> The Relay engineers will need to spend significant effort to support one
> of these languages, such as [Arabic][] or [Hebrew][].

[Arabic]: https://en.wikipedia.org/wiki/Arabic
[Hebrew]: https://en.wikipedia.org/wiki/Hebrew_language
[right-to-left scripts]: https://en.wikipedia.org/wiki/Right-to-left_script

### Identifying the User's Preferred Languages

The browser communicates the user's preferred languages with an
[`Accept-Language` header][accept-lang], sent with each web request. The default for
Firefox downloaded in the US is "`en-US, en`", which specifies either English as spoken
in the United States, or fallback to generic English.

Most users do not change their language settings and keep the browser defaults. The
[generic Firefox download page][ff-download] redirects the user to a download page that
best matches their region and language, which includes a default language preference. A
user can then change the `Accept-Language` header in `about:config`, key
`intl.accept_languages`. The per-language default preferences are available in Pontoon
in the [intl.properties][intl-props] group. Each localized version of Firefox should
include "`en-US, en`" as fallback languages.

Some browser extensions allow changing `Accept-Language`, but may be
[disabled on some websites][quar-domain], such as Firefox Accounts, due to security
concerns.

[accept-lang]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
[ff-download]: https://www.mozilla.org/firefox/new/
[intl-props]: https://pontoon.mozilla.org/es-ES/firefox/toolkit/chrome/global/intl.properties/?string=81017
[quar-domain]: https://support.mozilla.org/en-US/kb/quarantined-domains

### Picking the Language

Relay may not support the user's top preferred language, but picks the best match.
Different contexts use different implementations:

| Context            | Implementation       | `Accept-Language` source      | Content Scope  |
| :----------------- | :------------------- | :---------------------------- | :------------- |
| API and Web Server | [Django][dj-lang]    | Web Browser                   | Error messages |
| Background Tasks   | [Django][dj-lang]    | Firefox Accounts (at sign-up) | Emails         |
| Website            | [Fluent][flt-lang]   | Web Browser                   | Relay Website  |
| Add-On             | [i18n API][ext-i18n] | Web Browser                   | Add-on         |

Each of these starts at the first entry in `Accept-Language` and continues until it hits
a match in the supported languages. If there are no supported languages, the code falls
back to English (`"en"`).

[dj-lang]: https://docs.djangoproject.com/en/3.2/topics/i18n/translation/#how-django-discovers-language-preference
[ext-i18n]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n
[flt-lang]: https://github.com/projectfluent/fluent.js/tree/main/fluent-langneg

### Managing Languages and Translations

Mozilla uses [Pontoon][pontoon] to identify supported languages and coordinate
translation work. [Volunteer translation teams][pt-teams] coordinate the translation
work, set standards, and decide which projects to support. Teams identifiers are a
language code (such as "`fr`" for [French][pt-fr], or `"scn"` for [Sicilian][pt-scn]),
or a language-plus-region code (such as `"es-ES"` for
[Spanish spoken in Spain][pt-es-ES], or `"ca-valencia"` for
[Catalan spoken in the Valencian Community of Spain][pt-ca-valencia]).

Some teams are active and quick to translate, such as the [French][pt-fr] and
[German][pt-de] teams. Some teams volunteer to translate a project, such as
[Interlingua][pt-ia-relay]. Other teams have few or no active members, such as
[Luxembourgish][pt-lb], and focus their resources on a few projects. The Mozilla
localization team (Slack channel `#l10n`) is familiar with team capacity, and helps
decide if and when to expand a project to new languages, and reaches out to the
language team leads.

Language support varies among [Mozilla projects][pt-projs]. Some relevant projects, and
the supported languages as of September 2023, include:

- [Firefox Relay Website][pt-proj-relay] (26 languages)
- [Firefox Relay Add-on][pt-proj-addon] (26 languages)
- [Firefox Accounts][pt-proj-fxa] (78 languages)
- [Mozilla.org][pt-proj-bedrock] (98 languages)
- [SUMO][pt-proj-sumo] for [support.mozilla.org][sumo-relay] (87 languages)
- [AMO Frontend][pt-proj-amo] for [addons.mozilla.org][amo-relay] (64 languages)

Relay staff can check translation status on the Pontoon project sites. They may use
the completeness of translated strings to decide to turn on a feature for a region.

[amo-relay]: https://addons.mozilla.org/en-US/firefox/addon/private-relay/
[pontoon]: https://pontoon.mozilla.org/
[pt-ca-valencia]: https://pontoon.mozilla.org/ca-valencia/
[pt-de]: https://pontoon.mozilla.org/de/
[pt-es-ES]: https://pontoon.mozilla.org/es-ES/
[pt-fr]: https://pontoon.mozilla.org/fr/
[pt-ia-relay]: https://pontoon.mozilla.org/ia/firefox-relay-website/
[pt-lb]: https://pontoon.mozilla.org/lb/
[pt-proj-addon]: https://pontoon.mozilla.org/projects/firefox-relay-add-on/
[pt-proj-amo]: https://pontoon.mozilla.org/projects/amo-frontend/
[pt-proj-bedrock]: https://pontoon.mozilla.org/projects/mozillaorg/
[pt-proj-fxa]: https://pontoon.mozilla.org/projects/firefox-accounts/
[pt-proj-relay]: https://pontoon.mozilla.org/projects/firefox-relay-website/
[pt-proj-sumo]: https://pontoon.mozilla.org/projects/sumo/
[pt-projs]: https://pontoon.mozilla.org/projects/
[pt-scn]: https://pontoon.mozilla.org/scn/
[pt-teams]: https://pontoon.mozilla.org/teams/
[sumo-relay]: https://support.mozilla.org/en-US/products/relay

### Shipping Translations

Pontoon syncs translations between its database and code repositories, most hosted in
the [Mozilla Localization Team][mozilla-l10n] GitHub organization. The Pontoon project
page has a link to the project repository. Some relevant repositories include:

- [mozilla-l10n/fx-private-relay-i10n][] for the Firefox Relay Website
- [mozilla-l10n/fx-private-relay-add-on-l10n][] for the Firefox Relay Add-on
- [mozilla/fxa-content-server-l10n][] for Firefox Accounts, including subscription pages
- [mozilla-l10n/www-l10n][] for mozilla.org
- [mozilla-l10n/sumo-l10n][] for support.mozilla.org
- [mozilla/addons-frontend][] for addons.mozilla.org

Relay projects include the translations as [git submodules][git-submodules], such as
[privaterelay/locales][]. A submodule references a specific commit in a separate repository.
A [GitHub action][ga-l10n-sync] updates this commit reference nightly to get the
latest translations from Pontoon. This strategy works better for Relay than other
strategies, such as letting Pontoon write directly to the code repository, or
periodically syncing translations.

Translations for Relay, and many projects at Mozilla, use the [Fluent format][fluent].
The ["en" bundle][relay-l10n-en] (American / generic English) has the source
translations, split into functional areas, such as website pages. The other language
bundles are translations of the `"en"` bundle, coordinated in Pontoon. The continuous
integration process creates Docker images that include the Fluent files, both in the
source form used by the [Django backend][ftl-bundles], and embedded into the website
JavaScript.

Relay developers create new translatable strings when updating the service. The website
code uses [frontend/pendingTranslations.ftl][], and the backend code uses
[privaterelay/pending_locales/en/pending.ftl][]. These strings change often during
development. When the strings are in their final form, the developers moved them to the
relevant Pontoon repository, via a pull request, for translation to the supported
languages.

[fluent]: https://projectfluent.org/
[ftl-bundles]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/ftl_bundles.py
[ga-l10n-sync]: https://github.com/mozilla/fx-private-relay/actions/workflows/l10n-sync.yml
[mozilla-l10n/fx-private-relay-add-on-l10n]: https://github.com/mozilla-l10n/fx-private-relay-add-on-l10n
[mozilla-l10n/sumo-l10n]: https://github.com/mozilla-l10n/sumo-l10n
[mozilla-l10n/www-l10n]: https://github.com/mozilla-l10n/www-l10n
[mozilla-l10n]: https://github.com/mozilla-l10n
[mozilla/addons-frontend]: https://github.com/mozilla/addons-frontend/locale
[mozilla/fxa-content-server-l10n]: https://github.com/mozilla/fxa-content-server-l10n
[privaterelay/locales]: https://github.com/mozilla/fx-private-relay/tree/main/privaterelay
[relay-l10n-en]: https://github.com/mozilla-l10n/fx-private-relay-l10n/tree/main/en

## The Technical Details of Region Selection

Relay premium plans are not available world-wide, only in some regions. As of September
2023, the premium email service is available in 34 regions, and the phone service in 2
regions. This section details the technologies used to distinguish by region.

### Identifying the User's Region

In the stage and production deployments, the load balancer sets a `X-Client-Region`
header that identifies the user's region, based on their IP address. There is no
way for a user to override this region selection. A tester can use a [VPN][moz-vpn] to
change their region.

When the `X-Client-Region` header is not available, then the code falls back to the
`Accept-Language` header to guess the user's region. The `X-Client-Region` header is not
available in the development deployment or in local development, and may not be
available in stage and production deployments for some IP addresses.

The `Accept-Language` fallback looks for a language code with a regional variant, such
as `es-MX` for Mexican Spanish, and uses that region. If the language code does not
include a region, then the code guesses a probable region from a [lookup table][].
The [Language-Territory Information][cldr-lti] from the Unicode
[Common Locale Data Repository][cldr] (CLDR) [Supplemental Data][cldr-sup], which
estimates of language speakers by region, provides the data for the lookup table.

[cldr-lti]: https://www.unicode.org/cldr/charts/42/supplemental/language_territory_information.html
[cldr-sup]: https://www.unicode.org/cldr/charts/42/supplemental/index.html
[cldr]: https://cldr.unicode.org/
[lookup table]: https://github.com/mozilla/fx-private-relay/blob/f5c5ebf568639810db45de1ebb69f2498600d58c/privaterelay/utils.py#L72-L216
[moz-vpn]: https://www.mozilla.org/products/vpn

### Identifying Available Plans and Prices

The user's region determines what premium plans are available. The API sends this
data from [/api/v1/runtime_data][], and the website adjusts content based on
availability in the user's region.

The subscription platform uses [Stripe][stripe]. A [Stripe product][stripe-product]
represents each Relay plan, such as the premium email service.
A [Stripe price][stripe-price] represents what a user will pay, and is a combination
of plan / product, region(s), language, and the term (monthly or yearly). Many
regions have their own price, such as Denmark, which uses the Danish language and the krone.
Others share the price of a nearby region, such as Austria, which uses Germany's prices
in German and Euros. A minority, such as Belgium and Switzerland, are more complex,
choosing a price based on language. See [privaterelay/plans.py][] for details.

The "price" includes a translation of the plan / products details, which is the main
reason that language is a sometimes a factor in price selection. A user purchasing a
Relay plan will see the product details in the "price" language, and the rest of the
webpage in their browser preferred language, which could be the same or different.

[/api/v1/runtime_data]: https://relay.firefox.com/api/v1/runtime_data
[stripe-price]: https://stripe.com/docs/api/prices
[stripe-product]: https://stripe.com/docs/api/products
[stripe]: https://stripe.com

## Terms

Relay developers will see these terms as they work in this topic:

- **Internationalization** - The design and engineering effort to make it
  possible to adapt a service to various languages and regions with minimal or no
  engineering changes. This is often abbreviated **i18n**, to stand for the starting
  letter "i", the next 18 letters, and the ending letter "n". This abbreviation
  also avoids the spelling differences between American and British English.
- **Localization** - The process for adapting software to a specific locale,
  including translating text and using locale-specific features. This is often
  abbreviated **L10n**, in a similar way to i18n, but with a capital "L" since a
  lowercase "l" might look like an uppercase "I".
- **Locale** - A shared set of parameters, such as language, currency, number
  date, and time formats shared by a group of users. The identifier for many locales is
  the combination of a language code and a region code. An example is `"en-US"` to
  specify English speakers in America, implying US Dollars (USD, "$5.99"), left-to-right
  text, commas as thousands separators (525,960 minutes in a year), as well as the
  default date and time formats ("9/12/2023" for September 12, 2023).
- **Region** - An [administrative division][admin-div] that can be the basis for a
  locale. Mozilla prefers to use "Region" instead of **Country**, as "Region" can
  includes areas that useful for defining locales but may fall short of universal
  recognition as a country.
- **Language** - A spoken or written language. A language can have a simple
  identifier, such as `"en"` for English; a regional variant, such as `"de-CH"` for
  German spoken in Switzerland; or a more complex identifier, such as `"zh-CN-Hans"`,
  for Chinese as spoken in mainland China with Simplified Chinese characters.
- **Translation** - The process of adapting language strings or patterns to a
  second language. This is one aspect of Localization.

[admin-div]: https://en.wikipedia.org/wiki/Administrative_division

## Standards for Identifiers

There are internet standard identifiers for regions, languages, locales, and currency.
In most cases, Mozilla uses the standard identifiers, but there are exceptions, mostly
in legacy cases. Relay users should follow the standards, unless Mozilla has an
established exception.

- **Region** - [ISO 3166][] is a multi-part standard for identifying countries,
  territories, and subdivisions. The [ISO 3166-1 alpha-2][] code (two uppercase
  letters) is widely used as region identifiers.
  - Mozilla uses the ISO 3166-1 alpha-2 code for a region when available. Some
    exceptions are [Valencia][], which uses `"valencia"`, and the [Surselva Region][],
    which uses `"sursilv"`.
- **Language** - [ISO 639][] is a multi-part standard for identifying languages.
  Wikipedia has a [useful table][iso-639-1-list] of [ISO 639-1][] codes (two lowercase
  letters), and the Library of Congress has a [table of languages][iso-639-2-list] that
  lists the languages with an [ISO 639-2][] code (three lowercase letters) and their ISO
  639-1 codes.
  - Mozilla uses the ISO 639-1 two-letter code when available, falling back to the ISO
    639-2 three-letter code (such as `"yue"` for [Cantonese][]).
- **Locale** - Locales are usually identified by a language tag, a language identifier
  plus extra identifiers as needed. [BCP 47][] collects two RFCs, [RFC 4647][],
  "Matching of Language Tags", and [RFC 5646][], "Tags for Identifying Languages". RFC
  5646 defines the format of these tags, used in the "Accept-Language" header
  ([RFC 9110][]) by a web browser for the user's preferred language.
  - Pontoon uses `"en"`, rather than `"en-US"`, for [English][] as written in the
    [United States][]. Other English-speaking locales include the region, such as
    `"en-GB"` for English as written in the [United Kingdom][].
  - For most localizations, the default Firefox `Accept-Language` header ends in
    the fallback languages "`en-US, en`" (see the [intl.properties][intl-props] group).
  - Mozilla uses the identifiers
    `"zh-CN"` for [Simplified Chinese as common in China][pt-zh-CN] and
    `"zh-TW"` for [Traditional Chinese as common in Taiwan][pt-zh-TW].
    [Most browsers][so-browsers], including [Firefox][pt-zh-CN-intl-prop],
    follow this convention for the `Accept-Language` header.
    Recent standards may instead emphasize the script (such as
    `"zh-Hans"` for Han Simplified, or `"zh-Hans-CN"` to specify China, and
    `"zh-Hant"` for Han Traditional, or `"zh-Hant-TW"` to specify Taiwan).
  - [RFC 9110][] specifies "quality values", or "qvalues" to weight language
    preferences, such as `"Accept-Language: en-US,en;q=0.5"`. In general,
    browsers such as Firefox do not use qvalues, since they break some websites.
    Instead, the order of languages is the order of preference.
- **Currency** - [ISO 4217][] defines codes for currencies.
  - The Subscription Platform and Relay use the upper-case,
    three-letter codes, such as `"USD"` for United States dollars and `"EUR"` for
    Euros.

[BCP 47]: https://www.rfc-editor.org/info/bcp47
[Cantonese]: https://en.wikipedia.org/wiki/Cantonese
[English]: https://en.wikipedia.org/wiki/English_language
[ISO 3166-1 alpha-2]: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
[ISO 3166]: https://en.wikipedia.org/wiki/ISO_3166
[ISO 4217]: https://en.wikipedia.org/wiki/ISO_4217
[ISO 639-1]: https://en.wikipedia.org/wiki/ISO_639-1
[ISO 639-2]: https://en.wikipedia.org/wiki/ISO_639-2
[ISO 639]: https://en.wikipedia.org/wiki/ISO_639
[RFC 4647]: https://www.rfc-editor.org/rfc/rfc4647.html
[RFC 5646]: https://www.rfc-editor.org/rfc/rfc5646.html
[RFC 9110]: https://www.rfc-editor.org/rfc/rfc9110#field.accept-language
[Surselva Region]: https://en.wikipedia.org/wiki/Surselva_Region
[United Kingdom]: https://en.wikipedia.org/wiki/United_Kingdom
[United States]: https://en.wikipedia.org/wiki/United_States
[Valencia]: https://en.wikipedia.org/wiki/Valencia
[iso-639-1-list]: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
[iso-639-2-list]: https://www.loc.gov/standards/iso639-2/php/English_list.php
[pt-zh-CN-intl-prop]: https://pontoon.mozilla.org/zh-CN/firefox/toolkit/chrome/global/intl.properties/?string=81017
[pt-zh-CN]: https://pontoon.mozilla.org/zh-CN/
[pt-zh-TW]: https://pontoon.mozilla.org/zh-TW/
[so-browsers]: https://stackoverflow.com/questions/69709824/what-is-the-typical-chinese-language-code-for-the-accept-language-header
