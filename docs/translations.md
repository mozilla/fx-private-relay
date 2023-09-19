# Internationalization, Localization, and Translation

Relay users come from several regions and speak various languages. Relay developers need
to prepare for these variations when implementing features. Specialists call this design
discipline _internationalization_ and _localization_ (see [Terms](#terms)). This overview
includes Mozilla- and Relay-specific notes.

<!--
  Note: This manual table of contents (TOC) duplicates a GitHub feature, a table of
  contents behind a UI element:
  https://github.blog/changelog/2021-04-13-table-of-contents-support-in-markdown-files/
  If maintenance of this TOC becomes a larger burden than the benefit of an overview,
  then consider removing it.
-->

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

When an user first visits the Relay website, their browser gets the page in English.
The English page is pre-rendered for fast loading. The page is then
re-rendered into their preferred language. When none of the user's preferred languages
are available, then the user gets English.

The user sees different plan details based on their region. On the homepage there is a
table comparing Relay premium plans. If a premium plan is available in their region,
they see a price in their local currency. If a premium plan is not available, the user
sees a prompt to join a waitlist. The FAQ also changes, to omit entries for plans that
are unavailable in the user's region.

A new or logged-out user sees the sign-in buttons in the page header. The button text is
"Sign Up" and "Sign In" in the English localization. The text will be different if the
user's preferred language is not English. When a user selects a sign-in button, they go
to the Firefox Accounts website. This website is also in their preferred language. If
they enter a new email, they go through account creation. Firefox Accounts stores their
real email and preferred language on their new profile.

The user generates a Relay email mask, which they use instead of their real email on
other websites. When that website sends an email to the Relay email mask, Relay forwards
the email to the user's real email. The forwarded email has header and footer sections
surrounding the original content. These sections appear in the user's preferred language
from their Firefox Account.

When a user selects a premium plan, they go to the Firefox Subscriptions website. Most
of the content appears in their preferred language. The product details are in the
primary supported language for their region. This may be different from the user's
preferred language. The price is in their region's currency.

When a user installs the Relay Add-On, the content is also in their preferred language.
The Add-On reflects the Relay premium plan availability in their region.

## Development Workflows

The project `README.md` has basic instructions on ["working with
translations"][readme-wwt]. This section has more details.

[readme-wwt]: ../README.md#working-with-translations

### Loading Translations

The translations are in a separate repository, and included as a
[submodule][git-submodules]. This combines a separate repository with a
specific commit in that repository.

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

When checking out a branch, `git status` may show `privaterelay/locales` has changed.
This is because the submodule commit is out of sync with the branch. To sync the
submodule with the branch, you can run `git submodule update --remote`. To automate
syncing the translations submodule, set the configuration:

```sh
git config --global submodule.recurse true
```

[git-submodules]: https://git-scm.com/book/en/v2/Git-Tools-Submodules

### Rebasing a Branch

When rebasing a branch to pick up changes from `main`, the submodule commit may now be
out of sync. You may see `privaterelay/locales` in the "Changes not staged for commit".
**Do not add this directory**, as it may revert translations to an earlier version.

If you already added it, for example with `git add -u`, it is now in the staging area.
This is the "official" name of the "Changes to be committed" section. You can remove it
with:

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

If you commit an update to `privaterelay/locales`, you can remove it with `git rebase`.
This is a powerful tool that requires deeper understanding of `git`. See
[About Git][gh-git] for a tutorial, and
[On undoing, fixing, or removing commits in git][sr-fixup] for a guided experience.

1. Run `git rebase origin/main`, and take care of any conflicts.
2. Find the commit that changed locals with `git log -- privaterelay/locales`.
3. Start an interactive rebase with `git rebase -i origin/main`. A rebase plan will open
   in your editor.
4. Edit the commit line, changing from `pick` to `edit`. Save the rebase plan and exit
   the editor to start the rebase.
5. When rebasing gets to the target the commit, run
   `git checkout head~1 -- privaterelay/locales`. This sets the submodule version
   _before_ your change and stages it. You can run `git status` to confirm it is in
   "Changes to be committed".
6. Run `git rebase --continue` to continue the rebase.

If the only change in the commit was updating the submodule, you'll now have an empty
commit. You can remove it with another interactive rebase by removing the commit line.
In the rebase planner, `git` will annotate the line with an `# empty` suffix.

[gh-git]: https://docs.github.com/en/get-started/using-git/about-git
[sr-fixup]: https://sethrobertson.github.io/GitFixUm/fixup.html

### Nightly Translation Updates

A GitHub action, ["Fetch latest strings from the l10n repo"][action-l10n], updates
translations. The action runs at midnight UTC. It updates the `privaterelay/locales`
submodule to the latest commit. The commit message is "Merge in latest l10n strings". If
there are no translation updates, then there will be no commit. The action status is
still "success" if there are no updates.

The action uses a Personal Access Token (PAT), required to create the commit. If the
nightly update fails, check that the PAT is still valid, and regenerate as needed.

[action-l10n]: https://github.com/mozilla/fx-private-relay/actions/workflows/l10n-sync.yml

### Adding New Translatable Strings During Development

Relay translations use [Fluent localization system][fluent]. To start working with translations,
**read the documentation from the Fluent team**.

Read the [Fluent Syntax Guide][fl-syntax] while looking at some Relay `.ftl` files. This
guide documents the syntax and promotes specific usage, such as:

- [Variables][fl-syntax-variables] for strings with inserted values
- [References][fl-syntax-references] for using strings like product names inside other strings
- [Selectors][fl-syntax-selectors] for strings that include a number or count

The Fluent document [Good Practices for Developers][good-practice] has useful tips.

**Use pending translations when developing content for Relay**. This is because the
English text can change many times during development. If these string entered the
mature translation process, these changes would cause problems. The i18n team reviews
mature translation changes. Translation teams spend time and effort translating strings.
Development progress would slow down., and translators would waste effort. Pending
translations avoid these issues.

The pending translations for the front end are in [frontend/pendingTranslations.ftl][].
The back end strings are in [privaterelay/pending_locales/en/pending.ftl][]. If both the
front and back ends need the string, duplicate it to both files. These files are in the
Relay codebase, not the translations submodule. Include pending translation changes with
the pull request that uses them.

**Do not re-use IDs for new or updated strings**. The translations of an existing string
are valid and used in live content. When updating content, add a digit to the string ID
to signal it will replace another string. For example,
`premium-promo-availability-warning-4` replaces `premium-promo-availability-warning-3`.
Remove the old strings when they are no longer referenced in the code.

[fl-syntax-references]: https://projectfluent.org/fluent/guide/references.html
[fl-syntax-selectors]: https://projectfluent.org/fluent/guide/selectors.html
[fl-syntax-variables]: https://projectfluent.org/fluent/guide/variables.html
[fl-syntax]: https://projectfluent.org/fluent/guide/
[fluent]: https://projectfluent.org/
[frontend/pendingTranslations.ftl]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/pendingTranslations.ftl
[good-practice]: https://github.com/projectfluent/fluent/wiki/Good-Practices-for-Developers
[privaterelay/pending_locales/en/pending.ftl]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/pending_locales/en/pending.ftl

#### Translatable Strings with Embedded HTML

Translation is simple when the string has no embedded formatting. Some Relay strings are
more natural with embedded HTML. For example, prose that links to other content may have
an embedded `<a>` element.

For Relay strings that include HTML, set the string to the complete sentence or UI
element. Inject element attributes as variables. For example, if the rendered HTML is:

```html
<p class="relay-footnote">
  To change your email preference, see
  <a class="a-ext-link" href="https://relay.firefox.com/accounts/settings/">
    Relay Settings
  </a>
</p>
```

The Fluent string, with helper comments, would be something like:

```text
#   { $settings_url } (url) - full link to the settings page
#   { $link_attrs } (string) - specific attributes added to links
#   { settings-headline } (string) - the title of the settings page
email-footer-pref-link =
  To change your email preference, see
  <a href="{ $settings_url }" { $link_attrs }>{ settings-headline }</a>
```

Translators can re-arrange the sentence as needed for their language. The Pontoon UI
helps translators translate HTML strings. Pontoon linters detect some translation issues
such as malformed HTML and missing variables. The URL and attributes are not part of the
string. Translators can not break them by changing them like translations. The values
can change in the future without requiring re-translation.

The Django email template may look like:

```html
<p class="relay-footnote">
  {% ftlmsg 'email-footer-pref-link'
  settings_url=SITE_ORIGIN|add:'/accounts/settings/'
  link_attrs='class="a-ext-link"' %}
</p>
```

The frontend uses the `<Localized>` component for strings with embedded HTML. See the
[profile-label-welcome-html][] code for details.

[profile-label-welcome-html]: https://github.com/mozilla/fx-private-relay/blob/f5c5ebf568639810db45de1ebb69f2498600d58c/frontend/src/pages/accounts/profile.page.tsx#L285-L293

### Submitting Pending Translations

The `privaterelay/locales` directory is a checkout of the git repository
[mozilla-l10n/fx-private-relay-l10n][]. To add new strings for translation,
open a pull request against that repository.

The `privaterelay/locales` checkout is an `https` checkout by default. You will need to
authenticate with a GitHub password when pushing the branch. To switch to an `ssh`
checkout and authenticate with your SSH key:

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

Copy translations from the pending translations to the proper files in
`private/locales/en/`. Do not change the translation files for other languages.
The pending translations for the front end are in [frontend/pendingTranslations.ftl][].
The same for the back end are in
[privaterelay/pending_locales/en/pending.ftl][]. A change can include strings from both
files.

When ready, create and push a branch:

```sh
cd privaterelay/locales
git branch message-updates-yyymmdd
git status
git commit -u
git push -u origin message-updates-yyymmdd
```

You can then visit [mozilla-l10n/fx-private-relay-l10n][] to create the pull request.
You can make changes in the local submodule branch for any code review feedback.

After approval, the Mozilla l10n team merges the new strings. The next nightly
translation update brings the new strings into Relay's `main` branch. You should then
create a pull request to remove the redundant strings from the pending files.

[mozilla-l10n/fx-private-relay-l10n]: https://github.com/mozilla-l10n/fx-private-relay-l10n

### Expanding a Premium Plan

Adding new regions to a premium plan is a cross-company effort. The Legal team ensures
Mozilla can do business in the new region. The Subscription Platform integrates the
expanded tax requirements. The Localization team identifies languages for the new
region. Quality Assurance tests the experience in the new region and language. Customer
Support expands support documents. Managers at several levels coordinate the work.

Premium plan expansion can take months. A Relay engineer should **create a waffle flag
for the expansion effort**. This allows engineers to ship partial changes without
affecting current users. Staff with the flag enabled can test expansion code in stage
and production.

The Subscription Platform (version 2) uses [Stripe][stripe] for paid services. A
[Stripe Price][stripe-price] tracks currency, taxes, and a subscription term. Relay
subscription terms are monthly or yearly. There are usually two prices per region, one
for each term. The Subscription Platform also uses a price to track language and region.
The product details are in the selected language. The Localization team helps pick the
region's primary language. Product reports use the price to segment purchases by region.

The Relay product manager create the Prices on the Stripe webpage. The product manager
shares the new price IDs with the Relay engineers. In some cases, complex criteria
selects the price for a region. For example, a region can use the prices of a different
region. Another case is when a region has per-language prices. The manager highlights
these complex cases.

The product manager shares the new price IDs with the Relay engineers. In some cases,
complex criteria selects the price for a region. For example, a region can use the
prices of a different region. Another case is when a region has per-language prices.
The manager highlights these complex cases.

The Relay engineer updates the data structures in [privaterelay/plans.py][]:

1. New currencies in `CurrencyStr`
2. New regions in `CountryStr`
3. New prices details in `_STRIPE_PLAN_DATA`
4. A new section in `_RELAY_PLANS`, such as `premium_expansion`, with the expanded
   regions
5. Update the relevant functions to take a boolean signalling the waffle flag is
   on or off. See [PR #3745][pr-3745], which retired the 2023 expansion flag, for
   details.

Relay staff can turn on the waffle flag for themselves and others. With an enabled flag,
users can view new content and test buying a subscription.

In development and stage, there are test prices connected to the
[Stripe test mode][stripe-test]. A test visitor from the United States will get these
prices. Other regions get the production prices.

> [!NOTE]
> Testing subscriptions in a new region requires setting the preferred language.
> Change the browser language preference, `intl.accept_languagues` in `about:config`.
> Use a Firefox Account created with that language preference.
>
> Do not use a language-switcher extension. Many extensions are not allowed to run on Firefox
> Accounts. Inconsistent language preferences may invalidate testing. See
> [Identifying The User's Preferred Languages](#identifying-the-users-preferred-languages)
> for more information.

When the expansion ships to all users, a Relay engineer can cleanup the data
structures:

1. Merge the expanded section in `_RELAY_PLANS`, and re-sort
2. Drop the expansion boolean. Or, add a comment for the unused variable. Or, if time
   allows, leave flexible code for future expansions.
3. Remove other code and documentation references to the expansion waffle flag

[privaterelay/plans.py]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/plans.py
[pr-3745]: https://github.com/mozilla/fx-private-relay/pull/3745
[stripe]: https://stripe.com
[stripe-price]: https://stripe.com/docs/api/prices
[stripe-test]: https://stripe.com/docs/test-mode

### Viewing Translation Errors

The web server library [django-ftl][] logs when a translation is not available. The log
message writes to `stderr` with severity `ERROR` and name `django_ftl.message_errors`.
The log message looks like:

> FTL exception for locale [es-mx], message 'relay-email-your-dashboard',
> args {}: KeyError('relay-email-your-dashboard')"

The report [FTL Errors in Relay Production][ftl-report] gathers and categorizes recent
errors. The filter "supported" means Relay has an assigned language team in Pontoon. The
other filters are by locale and key (or string ID). A Relay engineer uses this report to
detect issues with a team's translation. The report also implies the traffic volume for
unsupported languages.

The source query defines the list of supported languages. The list needs an update when
a new language team takes on the Relay project. A Relay engineer can update the query,
called a "data source" in Looker, to add the new team.

There are no error reports for the front-end website or the add-on. Relay engineers or QA
catch issues in translated strings with manual testing.

[django-ftl]: https://github.com/django-ftl/django-ftl
[ftl-report]: https://lookerstudio.google.com/reporting/63983869-6199-43b8-acb5-52971ffdd023

## The Technical Details of Translation

Relay supports 26 languages (as of September 2023). This section details the
technologies used to deploy those translations.

> [!WARNING]
> None of Relay's supported languages use [right-to-left scripts][].
> [Hebrew][], [Arabic][], and [Persian][] are the most widespread right-to-left
> modern writing systems. The Relay engineers will spend significant effort to
> support the first right-to-left script.

[Arabic]: https://en.wikipedia.org/wiki/Arabic_script
[Hebrew]: https://en.wikipedia.org/wiki/Hebrew_alphabet
[Persian]: https://en.wikipedia.org/wiki/Persian_alphabet
[right-to-left scripts]: https://en.wikipedia.org/wiki/Right-to-left_script

### Identifying the User's Preferred Languages

The browser communicates the user's preferred languages with each web request. The
[`Accept-Language` header][accept-lang] encodes this preference. The default header for
Firefox downloaded in the US is "`en-US, en`". This header specifies a preference for
English as spoken in the United States. If that is not available, it specifies to
fallback to generic English.

Most users do not change their language settings and keep the browser defaults.
Browsers use different methods to detect a user's language and pick good defaults.
A Firefox user could change the defaults by typing `about:config` in the location bar.
After accepting the risk, they can find and change the key `intl.accept_languages`. This
changes the `Accept-Language` header sent to websites.

Translators use Pontoon to set the value for `intl.accept_languages`. See the
[intl.properties][intl-props] group, LOCALES tab, for values for each language.
Note that most end in "`en-US, en`" as fallback languages. All include `en` for
generic English.

Some browser extensions allow changing `Accept-Language`. This can be useful for testing
translations on the Relay website. Extensions are be
[disabled on some websites][quar-domain] due to security concerns. These websites
include Firefox Accounts and the Subscription Platform. Do not use language-switcher
extensions when testing user flows for buying subscriptions.

[accept-lang]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
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

Each implementation parses the `Accept-Language` header into languages. They start at
the first entry and continue until there is a match to a supported language. If there
are no supported languages, the code falls back to English (`"en"`).

[dj-lang]: https://docs.djangoproject.com/en/3.2/topics/i18n/translation/#how-django-discovers-language-preference
[ext-i18n]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n
[flt-lang]: https://github.com/projectfluent/fluent.js/tree/main/fluent-langneg

### Managing Languages and Translations

Mozilla uses [Pontoon][pontoon] to identify supported languages and coordinate
translation work. [Volunteer translation teams][pt-teams] coordinate their own
translation work. They set translation standards and decide which projects to support.
Locale codes identify translation teams. Many teams identifiers are a language code
(such as "`fr`" for [French][pt-fr], or `"scn"` for [Sicilian][pt-scn]). Other teams
use a language-plus-region code, such as `"es-ES"` for
[Spanish spoken in Spain][pt-es-ES]. A longer code is `"ca-valencia"` for
[Catalan spoken in the Valencian Community of Spain][pt-ca-valencia].

Some teams are active and quick to translate, such as the [French][pt-fr] and
[German][pt-de] teams. Some teams volunteer to translate a project, such as
[Interlingua][pt-ia-relay]. Other teams have few or no active members, such as
[Luxembourgish][pt-lb]. Small teams focus their resources on a few projects. The Mozilla
localization team (Slack channel `#l10n`) is familiar with team capacity. This team
decides when to expand a project to new languages. They reach out to the language
team leads to ask for expansion.

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

Pontoon syncs translations between its database and code repositories. The
[Mozilla Localization Team][mozilla-l10n] GitHub organization hosts most project
translation repositories. The Pontoon project page has a link to the project repository.
Some relevant repositories include:

- [mozilla-l10n/fx-private-relay-l10n][] for the [Firefox Relay Website][]
- [mozilla-l10n/fx-private-relay-add-on-l10n][] for the [Firefox Relay Add-on][]
- [mozilla/fxa-content-server-l10n][] for [Firefox Accounts][], including [subscription pages][]
- [mozilla-l10n/www-l10n][] for [mozilla.org][]
- [mozilla-l10n/sumo-l10n][] for [support.mozilla.org][]
- [mozilla/addons-frontend][] for [addons.mozilla.org][]

Pontoon writes new translations as new commits to their repository. Relay projects
include the translation repositories as [git submodules][git-submodules], such as
[privaterelay/locales][]. A submodule references a specific commit in a separate
repository. A [GitHub action][ga-l10n-sync] updates this commit to the latest each
night. This action synchronizes the main Relay branch with the latest translations.

This synchronization strategy works best for Relay. It balances up-to-date translation
changes against the complexity of submodules. There are other strategies. Some
projects allow Pontoon to write to their code repository. This clutters commit history
with translations. It also runs continuous integration tests for each translation. Other
projects keep a copy of translations and sync them when needed. This requires manual
work, documentation, and discipline. It often falls to a single engineer, and is not
done when they are busy or out of office.

Translations for Relay, and many projects at Mozilla, use the [Fluent format][fluent].
The ["en" bundle][relay-l10n-en] (American / generic English) has the source
translations. Developers split the translations into functional areas, such as
[faq.ftl][] for the [FAQ page][]. The other language bundles are translations of the
`"en"` bundle, coordinated in Pontoon. The continuous integration process creates Docker
images that include the translations. The [Django back end][ftl-bundles] uses select
Fluent files. The front end uses translations embedded into the JavaScript during
Docker image creation.

Relay developers create new translatable strings when updating the service. The
in-progress strings are in the Relay repository. The source strings change often during
development. The front end uses [frontend/pendingTranslations.ftl][]. The back end code
uses [privaterelay/pending_locales/en/pending.ftl][].

Approved strings are ready for translation. The developers open a pull request to the
translation repository. The localization team reviews the new strings. When the
localization team merges the changes, Pontoon imports the new strings. The language
teams translate the strings. Pontoon exports them to the translation repository. The
nightly action updates the submodule to pull in the latest translations. The release
Docker image includes the new translations. Once released, the users see the content in
their language.

[Firefox Accounts]: https://accounts.firefox.com/
[Firefox Relay Add-on]: https://addons.mozilla.org/firefox/addon/private-relay/
[Firefox Relay Website]: https://relay.firefox.com/
[addons.mozilla.org]: https://addons.mozilla.org/
[ftl-bundles]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/ftl_bundles.py
[ga-l10n-sync]: https://github.com/mozilla/fx-private-relay/actions/workflows/l10n-sync.yml
[mozilla-l10n/fx-private-relay-add-on-l10n]: https://github.com/mozilla-l10n/fx-private-relay-add-on-l10n
[mozilla-l10n/sumo-l10n]: https://github.com/mozilla-l10n/sumo-l10n
[mozilla-l10n/www-l10n]: https://github.com/mozilla-l10n/www-l10n
[mozilla-l10n]: https://github.com/mozilla-l10n
[mozilla.org]: https://www.mozilla.org/
[mozilla/addons-frontend]: https://github.com/mozilla/addons-frontend/locale
[mozilla/fxa-content-server-l10n]: https://github.com/mozilla/fxa-content-server-l10n
[privaterelay/locales]: https://github.com/mozilla/fx-private-relay/tree/main/privaterelay
[relay-l10n-en]: https://github.com/mozilla-l10n/fx-private-relay-l10n/tree/main/en
[subscription pages]: https://subscriptions.firefox.com/subscriptions
[support.mozilla.org]: https://support.mozilla.org/
[faq.ftl]: https://github.com/mozilla-l10n/fx-private-relay-l10n/blob/main/en/faq.ftl
[FAQ page]: https://relay.firefox.com/faq/

## The Technical Details of Region Selection

Relay premium plans are not available world-wide, only in some regions. As of September
2023, the premium email service is available in 34 regions. Phone infrastructure varies,
so the phone service in available in only 2 regions. This section details the
technologies used to distinguish users by region.

### Identifying the User's Region

The stage and production deployments use similar load balancers. These set a
`X-Client-Region` header based on their IP address. There is no way for a user to
override this region selection. A tester can use a [VPN][moz-vpn] to change their
IP address and their detected region.

The `X-Client-Region` header is sometimes missing. In stage and production, some IP
addresses do not have a clear region. The development deployment does not have the
header. Local development also omits the header.

Without a `X-Client-Region` header, the code guesses a region from the `Accept-Language`
header. The `Accept-Language` fallback looks for a language code with a regional
variant. For example, the language code `"es-MX"` (Mexican Spanish) implies region code
`"MX"` (Mexico). When there is no regional variant, the code guesses a probable region
from a [lookup table][]. The lookup table uses Unicode
[Common Locale Data Repository][cldr] (CLDR) [Supplemental Data][cldr-sup]. The
[Language-Territory Information][cldr-lti] includes estimates of language speakers by
region.

[cldr-lti]: https://www.unicode.org/cldr/charts/42/supplemental/language_territory_information.html
[cldr-sup]: https://www.unicode.org/cldr/charts/42/supplemental/index.html
[cldr]: https://cldr.unicode.org/
[lookup table]: https://github.com/mozilla/fx-private-relay/blob/f5c5ebf568639810db45de1ebb69f2498600d58c/privaterelay/utils.py#L72-L216
[moz-vpn]: https://www.mozilla.org/products/vpn

### Identifying Available Plans and Prices

The user's region determines what premium plans are available. The API sends this data
from [/api/v1/runtime_data][]. The website adjusts content based on availability in the
user's region.

The subscription platform (version 2) uses [Stripe][stripe]. A
[Stripe product][stripe-product] represents each Relay plan, such as the premium email
service. A [Stripe price][stripe-price] represents how a user will pay. The price has
an associate plan / product, a currency, tax details, and the term. Many Relay plans have
monthly and yearly subscription terms. The VPN bundle has yearly terms.

The subscription platform associates a price with a region. Product reports may use this
to segment purchasers by region.

The subscription platform associates a price with a language. On the subscription page,
product details appear in the price language. The rest of the subscription page appear
in the user's preferred language. For most users, the price language and preferred
language should be the same.

Many regions have their own price, such as Denmark, which uses the Danish language and
the krone. Others share the price of a nearby region, such as Austria, which uses
Germany's prices in German and Euros. A minority are more complex, choosing a price
based on language. Belgium users share the price in Euros of a neighbor, based on
language. Switzerland has separate prices for German, French, and Italian speakers.
All the Swiss prices are in Swiss Francs. See [privaterelay/plans.py][] for details.

[/api/v1/runtime_data]: https://relay.firefox.com/api/v1/runtime_data
[stripe-product]: https://stripe.com/docs/api/products

## Terms

Relay developers will see these terms as they work in this topic:

- **[Internationalization][]**: Designing a service to adapt to different locales
  without per-locale code changes. This is often abbreviated **i18n**, to stand for the
  starting letter "i", the next 18 letters, and the ending letter "n". This abbreviation
  also avoids the spelling differences between American and British English.
- **[Localization][]**: Adapting software to a specific locale. This includes translating
  text and using locale-specific formats. This is often abbreviated **L10n**, in a
  similar way to i18n. A capital "L" avoids confusing a lowercase "l" with an
  uppercase "I".
- **[Locale][]**: Shared cultural conventions that appear in a user interface. This
  can include language, script and currencies. It can also include formats for prices,
  numbers, dates, and times. The identifier for many locales is the combination of a
  language code and a region code. An example is `"en-US"` to specify English speakers
  in America. It implies the English alphabet in left-to-right text. Prices should be
  in US Dollars (USD, "$5.99"). Numbers use commas as thousands separators (525,960
  minutes in a year). The first number in a short date the month ("9/12/2023" for
  September 12, 2023). English-speaking users in other regions share some of these
  conventions. Other conventions, like currency and date formats, will vary.
- **[Region][]**: An [administrative division][] that can be the basis for a
  locale. Mozilla prefers to use "Region" instead of "**Country**" when talking about
  localization. A Region can include areas within a country and areas that span
  countries.
- **[Language][]**: A spoken or written system of communication. English is a broad
  language category. A language can be specific to a region, such as German spoken in
  Switzerland. In localization, the written system can be important as well. For
  example, Chinese can vary between mainland China and other regions. It can also
  use Simplified or Traditional Chinese script when written.
- **[Translation][]**: The process of adapting language strings or patterns to a
  second language. This is one aspect of Localization. At Mozilla, American English is
  the source language for interface text.

[Internationalization]: https://en.wikipedia.org/wiki/Internationalization_and_localization
[Localization]: https://en.wikipedia.org/wiki/Internationalization_and_localization
[Locale]: https://en.wikipedia.org/wiki/Locale_(computer_software)
[Language]: https://en.wikipedia.org/wiki/Language
[Translation]: https://en.wikipedia.org/wiki/Translation
[administrative division]: https://en.wikipedia.org/wiki/Administrative_division
[Region]: https://en.wikipedia.org/wiki/Region

## Standards for Identifiers

There are internet standard identifiers for regions, languages, locales, and currency.
In most cases, Mozilla uses the standard identifiers. There are exceptions for common
usage and legacy cases. Relay users should follow the standards, unless Mozilla has an
established exception.

- **Region**: [ISO 3166][] is a multi-part standard for identifying countries,
  territories, and subdivisions. The [ISO 3166-1 alpha-2][] code (two uppercase
  letters) is common as a region identifier.
  - Mozilla uses the ISO 3166-1 alpha-2 code for a region when available. An
    exception is [Valencia][], which uses `"valencia"`. Another is the
    [Surselva Region][], which uses `"sursilv"`.
- **Language**: [ISO 639][] is a multi-part standard for identifying languages.
  Wikipedia has a [useful table][iso-639-1-list] of [ISO 639-1][] codes (two lowercase
  letters). The Library of Congress has a [table of languages][iso-639-2-list]
  with [ISO 639-2][] codes (three lowercase letters). This table has the related
  ISO 639-1 codes, when available.
  - Mozilla uses the ISO 639-1 two-letter code when available. Mozilla falls back to the ISO
    639-2 three-letter code (such as `"yue"` for [Cantonese][]).
- **Locale**: Locales are usually identified by a language tag. This is a language
  identifier, plus extra identifiers as needed. [RFC 5646][], "Tags for Identifying
  Languages", defines language tags. This RFC is the second half of [BCP 47][].
  The "Accept-Language" header ([RFC 9110][]) uses language tags. This
  header is how a web browser communicates the user's preferred language.
  - Pontoon uses `"en"`, rather than `"en-US"`, for [English][] as written in the
    [United States][]. Other English-speaking locales include the region. For example,
    `"en-GB"` identifies English as used in the [United Kingdom][] .
  - The default Firefox `Accept-Language` header for every language includes `"en"`.
    Most also include "`en-US`". See ["Identifying the User's Preferred Languages"][] for
    more details.
  - Mozilla uses the language tag `"zh-CN"` for
    [Simplified Chinese as common in China][pt-zh-CN]. The language tag `"zh-TW"` stands
    for [Traditional Chinese as common in Taiwan][pt-zh-TW]. Recent standards may
    instead emphasize the script. For example, `"zh-Hans"` means Han Simplified, and
    `"zh-Hant"` means Han Traditional. A region can make the tag more specific, such as
    `"zh-Hans-CN"`. [Most browsers][so-browsers], including
    [Firefox][pt-zh-CN-intl-prop], use `"zh-CN"` and `"zh-TW"` in the `Accept-Language`
    header. Mozilla web services may need to handle the `-Hans` and `-Hant` variants.
  - [RFC 9110][] specifies "quality values", or "qvalues" to weight language
    preferences. The header `"Accept-Language: en-US,en;q=0.5"` uses qvalues. Some
    websites break when parsing a header with qvalues. Firefox and other browsers do not
    use qvalues in `Accept-Language` defaults. Instead, the order of languages is the
    order of preference.
- **Currency**: [ISO 4217][] defines codes for currencies.
  - The Subscription Platform and Relay use the upper-case, three-letter codes. Some
    examples are `"USD"` for United States dollars and `"EUR"` for Euros.

[BCP 47]: https://www.rfc-editor.org/info/bcp47
[Cantonese]: https://en.wikipedia.org/wiki/Cantonese
[English]: https://en.wikipedia.org/wiki/English_language
[ISO 3166-1 alpha-2]: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
[ISO 3166]: https://en.wikipedia.org/wiki/ISO_3166
[ISO 4217]: https://en.wikipedia.org/wiki/ISO_4217
[ISO 639-1]: https://en.wikipedia.org/wiki/ISO_639-1
[ISO 639-2]: https://en.wikipedia.org/wiki/ISO_639-2
[ISO 639]: https://en.wikipedia.org/wiki/ISO_639
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
["Identifying the User's Preferred Languages"]: #identifying-the-users-preferred-languages
