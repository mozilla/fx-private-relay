# Internationalization, Localization, and Translation

Relay users come from several regions and speak various languages. Relay developers need
to prepare for these variations when implementing features. Specialists call this design
discipline _internationalization_ and _localization_ (see [Terms](#terms)). This overview
includes Mozilla- and Relay-specific notes.

<!--
  Note: This manual table of contents (TOC) duplicates a GitHub feature, a table of
  contents behind a UI element:
  https://github.blog/changelog/2021-04-13-table-of-contents-support-in-markdown-files/
  If maintenance of this TOC becomes a burden, then remove it.
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
  - [Adding New Translations](#adding-new-translations)
  - [Relay Assumes Left-To-Right Script](#relay-assumes-left-to-right-script)
- [The Technical Details of Region Selection](#the-technical-details-of-region-selection)
  - [Identifying the User's Region](#identifying-the-users-region)
  - [Identifying Available Plans and Prices](#identifying-available-plans-and-prices)
- [Terms](#terms)
- [Standards for Identifiers](#standards-for-identifiers)

## How a User Experiences Relay

Localization affects the user's experience in several ways.

When a user first visits the Relay website, their browser gets the page in English.
The English page is pre-rendered for fast loading. The page is then
re-rendered into their preferred language. When none of the user's preferred languages
are available, then the user gets English.

The user sees different plan details based on their region. On the homepage there is a
table comparing Relay premium plans. If a premium plan is available in their region,
they see a price in their local currency. If a premium plan is not available, the user
sees a prompt to join a waitlist. The FAQ also changes, to omit entries for unavailable
plans.

A new or logged-out user sees the sign-in buttons in the page header. The button text is
"Sign Up" and "Sign In" in the English localization. The text will be different if the
user's preferred language is not English. When a user selects a sign-in button, they go
to the Accounts website. This website is also in their preferred language. If they enter
a new email, they go through account creation. Their new account profile stores their
real email and preferred language.

The user generates a Relay email mask, which they use instead of their real email on
other services. When that service sends an email to the Relay email mask, Relay forwards
the email to the user's real email. The forwarded email has header and footer sections
surrounding the original content. These sections appear in the user's preferred language
from their Mozilla account.

When a user selects a premium plan, they go to the Subscription Platform website. Most
of the content appears in their preferred language. The product details are in the
primary supported language for their region. This may be different from the user's
preferred language. The price is in their region's currency.

The Relay phone plan is a premium plan that is available in Canada and the United
States. The user cannot buy a phone plan unless they are in one of those countries. A
new premium user submits their real number. Relay sends a message to the user's number
with a verification code. After verifying their real number, the user picks a Relay mask
number. Relay only suggests mask numbers from the same country as the user's real phone.
After the user selects a Relay mask number, Relay sends a welcome message from their
mask number. Relay sends all the messages with English text.

When an external contact sends an SMS text to a mask number, the service forwards the
message to the Relay user. The forwarded message has a prefix identifying the sender's
number. The content is not translated. When an external contact calls the mask number,
Relay starts a call with the Relay user.

When a user installs the Relay Add-On, the content is also in their preferred language.
The Add-On reflects the Relay premium plan availability in their region.

## Development Workflows

The project `README.md` has basic instructions on [working with translations][]. This
section has more details.

[working with translations]: ../README.md#working-with-translations

### Loading Translations

The translations are in a separate repository, and included as a [submodule][]. This
references a specific commit in a separate repository.

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
submodule with the branch, run:

```sh
git submodule update --remote
```

To automate syncing the translations submodule, set the configuration:

```sh
git config --global submodule.recurse true
```

[submodule]: https://git-scm.com/book/en/v2/Git-Tools-Submodules

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
This is a powerful tool that requires deeper understanding of `git`. See [About Git][]
for a tutorial. See [On undoing, fixing, or removing commits in git][] for a guided
experience. See [Oh Shit, Git!?!] for an emotional experience.

The process is:

1. Run `git rebase origin/main`, and take care of any conflicts.
2. Find the commit that changed the submodule with `git log -- privaterelay/locales`.
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

[About Git]: https://docs.github.com/en/get-started/using-git/about-git
[On undoing, fixing, or removing commits in git]: https://sethrobertson.github.io/GitFixUm/fixup.html
[Oh Shit, Git!?!]: https://ohshitgit.com/

### Nightly Translation Updates

A GitHub action, [Fetch latest strings from the l10n repo][], updates
translations. The action runs at midnight UTC. It updates the `privaterelay/locales`
submodule to the latest commit. The commit message is "Merge in latest l10n strings". If
there are no translation updates, then there will be no commit. The action status is
still "success".

The action uses a Personal Access Token (PAT), required to create the commit. If the
nightly update fails, check that the PAT is still valid, and regenerate as needed.

[Fetch latest strings from the l10n repo]: https://github.com/mozilla/fx-private-relay/actions/workflows/l10n-sync.yml

### Adding New Translatable Strings During Development

Relay translations use the [Fluent localization system][]. To start working with translations,
**read the documentation from the Fluent team**.

Read the [Fluent Syntax Guide][] while looking at some Relay `.ftl` files. This guide
describes the syntax and promotes specific usage, such as:

- [Variables][] for strings with inserted values
- [References][] for product names inside other strings
- [Selectors][] for including a number or count

The Fluent document [Good Practices for Developers][] has useful tips.

**Use pending translations when developing content for Relay**. This is because the
English text can change many times during development. Strings that are still changing
are not a good fit for the translation process. The Localization team reviews
translation changes. Translation teams spend time and effort translating strings.
Development progress would slow down, and translators would waste effort. Pending
translations avoid these issues.

The pending translations for the front end are in [frontend/pendingTranslations.ftl][].
The back end strings are in [privaterelay/pending_locales/en/pending.ftl][]. If both the
front and back ends need the string, duplicate it to both files. These files are in the
Relay codebase, not the translations submodule. Include pending translation changes with
the pull request that uses them.

**Do not re-use IDs for new or updated strings**. The translations of existing strings
are valid and used in live content. When updating content, add a digit to the string ID
to signal it will replace another string. For example,
`premium-promo-availability-warning-4` replaces `premium-promo-availability-warning-3`.
Remove the old strings when they are no longer referenced in the code.

[Fluent Syntax Guide]: https://projectfluent.org/fluent/guide/
[Fluent localization system]: https://projectfluent.org/
[Good Practices for Developers]: https://github.com/projectfluent/fluent/wiki/Good-Practices-for-Developers
[References]: https://projectfluent.org/fluent/guide/references.html
[Selectors]: https://projectfluent.org/fluent/guide/selectors.html
[Variables]: https://projectfluent.org/fluent/guide/variables.html
[frontend/pendingTranslations.ftl]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/pendingTranslations.ftl
[privaterelay/pending_locales/en/pending.ftl]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/pending_locales/en/pending.ftl

#### Translatable Strings with Embedded HTML

Translation is simple when the string has no embedded formatting. Some Relay strings are
more natural with embedded HTML. For example, prose that links to other content may have
an embedded `<a>` element.

For Relay strings that include HTML, set the string to the complete sentence or UI
element. Inject element attributes as variables.

For example, if the rendered HTML is:

```html
<p class="relay-footnote">
  To change your email preference, see
  <a class="a-ext-link" href="https://relay.firefox.com/accounts/settings/">
    Relay Settings
  </a>
</p>
```

The Fluent string, with helper comments, could be:

```text
#   { $settings_url } (url) - full link to the settings page
#   { $link_attrs } (string) - specific attributes added to links
#   { settings-headline } (string) - the title of the settings page
email-footer-pref-link =
  To change your email preference, see
  <a href="{ $settings_url }" { $link_attrs }>{ settings-headline }</a>
```

Translators can re-arrange the sentence as needed for their language. The Pontoon UI
helps translators with HTML strings. Pontoon linters detect some translation issues
such as malformed HTML and missing variables. The URL and attributes are not part of the
string. Translators cannot break them by changing them like translations. The values
can change in the future without requiring re-translation.

The Django email template could be:

```html
<p class="relay-footnote">
  {% ftlmsg 'email-footer-pref-link'
  settings_url=SITE_ORIGIN|add:'/accounts/settings/'
  link_attrs='class="a-ext-link"' %}
</p>
```

The front end uses the `<Localized>` component for strings with embedded HTML. See the
[profile-label-welcome-html][] code for an example.

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
`privaterelay/locales/en/`. Do not change the translation files for other languages. Pontoon
handles those during import and export. The pending translations for the front end are
in [frontend/pendingTranslations.ftl][]. The same for the back end are in
[privaterelay/pending_locales/en/pending.ftl][]. A change can include strings from both
files.

When ready, create and push a branch:

```sh
cd privaterelay/locales
git branch message-updates-yyymmdd
git status
git add -u
git commit
git push -u origin message-updates-yyymmdd
```

You can then visit [mozilla-l10n/fx-private-relay-l10n][] to create the pull request.
You can make changes in the local submodule branch for any code review feedback.

After approval, the Localization team merges the new strings. The next nightly
translation update brings the new strings into Relay's `main` branch.

At this point, the pending translations have redundant strings. The Fluent code may log
warnings about these strings. The duplicate strings may confuse Relay engineers. Create
a new Relay pull request to remove the migrated strings. The pending translations for
the front end are in [frontend/pendingTranslations.ftl][]. The same for the back end are
in [privaterelay/pending_locales/en/pending.ftl][]. A change can include removing
strings from both files.

[mozilla-l10n/fx-private-relay-l10n]: https://github.com/mozilla-l10n/fx-private-relay-l10n

### Expanding a Premium Plan

Adding new regions to a premium plan is a cross-company effort. The Legal team ensures
Mozilla can do business in the new region. The Subscription Platform team integrates the
expanded tax requirements. The Localization team identifies languages for the new
region. Quality Assurance tests the experience in the new region and language. Customer
Support expands support documents. Managers at several levels coordinate the work.

Premium plan expansion can take months. A Relay engineer should **create a waffle flag
for the expansion effort**. This allows engineers to ship partial changes without
affecting current users.

The Subscription Platform (version 2) uses [Stripe][] for paid services. A
[Stripe Price][] tracks currency, taxes, and a subscription term. Relay
subscription terms are monthly or yearly. There are usually two prices per region, one
for each term. The Subscription Platform also uses the price to track language and region.
The product details are in the selected language. The Localization team helps pick the
region's primary language. The product reports use the price to segment purchases by
region.

The Relay product manager create the prices on the Stripe webpage. The product manager
shares the new price IDs with the Relay engineers. In some cases, complex criteria
selects the price for a region. For example, a region can use the prices of a different
region. Another case is when a region has per-language prices. The manager highlights
these complex cases.

The Relay engineer updates the data structures in [privaterelay/plans.py][]:

1. Add new currencies in `CurrencyStr`
2. Add new regions in `CountryStr`
3. Add new prices details in `_STRIPE_PLAN_DATA`
4. Add a new section in `_RELAY_PLANS`, such as `premium_expansion`, with the expanded
   regions
5. Update the relevant functions to take a boolean signaling the waffle flag is
   on or off. See [PR #3745][], which retired the 2023 expansion flag, for
   details.

Relay staff can turn on the expansion flag for themselves and others. With an enabled
flag, users can view new content and test buying a subscription.

> [!NOTE]
> Testing subscriptions in a new region requires setting the preferred language.
> Change the browser language preference, `intl.accept_languagues` in `about:config`.
> Use a Mozilla account created with that language preference.
>
> Do not use a language-switcher extension. Many extensions are not allowed to run on the
> Accounts website. Inconsistent language preferences may invalidate testing. See
> "[Identifying The User's Preferred Languages](#identifying-the-users-preferred-languages)"
> for more information.

When the expansion ships to all users, a Relay engineer can cleanup the data
structures:

1. Merge the expanded section in `_RELAY_PLANS`, and re-sort
2. Drop the expansion boolean. Or, add a comment for the unused variable. Or, if time
   allows, leave flexible code for future expansions.
3. Remove other code and documentation references to the expansion waffle flag

[privaterelay/plans.py]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/plans.py
[PR #3745]: https://github.com/mozilla/fx-private-relay/pull/3745
[Stripe]: https://stripe.com
[Stripe Price]: https://stripe.com/docs/api/prices

### Viewing Translation Errors

The back-end library [django-ftl][] logs when a translation is not available. The log
message writes to `stderr` with severity `ERROR` and name `django_ftl.message_errors`.
The log message looks like:

> FTL exception for locale [es-mx], message 'relay-email-your-dashboard',
> args {}: KeyError('relay-email-your-dashboard')"

The report "[FTL Errors in Relay Production][]" gathers and categorizes recent errors.
The filter _supported_ means Relay has an assigned language team in Pontoon. The other
filters are by _locale_ and _key_ (or string ID). A Relay engineer uses this report to
detect issues with a team's translation. The report also measures the traffic volume for
unsupported languages.

The source query defines the list of supported languages. The list needs an update when
a new language team takes on the Relay project. A Relay engineer can update the query,
called a "data source" in Looker, to add the new team.

There are no error reports for the front end or the add-on. Relay engineers or QA catch
issues in translated strings with manual testing.

[django-ftl]: https://github.com/django-ftl/django-ftl
[FTL Errors in Relay Production]: https://lookerstudio.google.com/reporting/63983869-6199-43b8-acb5-52971ffdd023

## The Technical Details of Translation

Relay supports over 20 languages. This section details the technologies used to deploy
those translations.

### Identifying the User's Preferred Languages

The browser communicates the user's preferred languages with each web request. The
[`Accept-Language` header][] encodes this preference. The default header for
Firefox downloaded in the US is "`en-US, en`". This header specifies a preference for
English as spoken in the United States. If that is not available, fallback to generic
English.

Browsers detect a user's desired language when setting up for the first time. For
example, a browser could ask the operating system. The browser defaults change based on
the language. A Firefox user could change the defaults by typing `about:config` in the
location bar. After accepting the risk, they can find and change the key
`intl.accept_languages`. This changes the `Accept-Language` header sent to websites.
Most users do not change their language settings and keep the browser defaults.

Translators use Pontoon to set the value for `intl.accept_languages`. See the
[intl.properties][] group, LOCALES tab, for values for each language.
Note that many end in "`en-US, en`" as fallback languages. All include "`en`" for
generic English.

Some browser extensions allow changing `Accept-Language`. This can be useful for testing
translations on the Relay front end. Extensions are [disabled on some websites][] due to
security concerns. These websites include Accounts and the Subscription Platform. Do not
use language-switcher extensions when testing user flows for buying subscriptions.

[`Accept-Language` header]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
[intl.properties]: https://pontoon.mozilla.org/es-ES/firefox/toolkit/chrome/global/intl.properties/?string=81017
[disabled on some websites]: https://support.mozilla.org/en-US/kb/quarantined-domains

### Picking the Language

Relay may not support the user's top preferred language, but picks the best match.
Different contexts use different implementations:

| Context            | Implementation                          | `Accept-Language` source     | Content Scope  |
| :----------------- | :-------------------------------------- | :--------------------------- | :------------- |
| API and Web Server | [Django middleware][]                   | Web Browser                  | Error messages |
| Background Tasks   | [Django's parse_accept_lang_header()][] | Mozilla account (at sign-up) | Emails         |
| Website            | [@fluent/langneg][]                     | Web Browser                  | Relay Website  |
| Add-On             | [i18n API][]                            | Web Browser                  | Add-on         |

Each implementation parses the `Accept-Language` header into languages. They start at
the first entry and continue until there is a match to a supported language. If there
are no supported languages, the code falls back to English (`"en"`).

[@fluent/langneg]: https://github.com/projectfluent/fluent.js/tree/main/fluent-langneg
[Django middleware]: https://docs.djangoproject.com/en/3.2/topics/i18n/translation/#how-django-discovers-language-preference
[Django's parse_accept_lang_header()]: https://github.com/django/django/blob/2c6ebb65c9eb6b11347d907127b82d31e04569e5/django/utils/translation/trans_real.py#L618C1-L639C13
[i18n API]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n

### Managing Languages and Translations

Mozilla uses [Pontoon][] to identify supported languages and coordinate translations.
[Volunteer translation teams][] coordinate their own translation work. They set
standards and decide which projects to support.

Language tags identify translation teams. Many team identifiers are a language code
(such as "`fr`" for [French][], or `"scn"` for [Sicilian][]). Other teams use a
language-plus-region code, such as `"es-ES"` for [Spanish spoken in Spain][]. A longer
code is `"ca-valencia"` for [Catalan spoken in the Valencian Community of Spain][].

Some teams are active and quick to translate, such as the [French][] and [German][]
teams. Some teams volunteer to translate a project, such as [Interlingua][]. Other teams
have few or no active members, such as [Luxembourgish][]. These small teams focus their
resources on a few projects. The Localization team (Slack channel `#l10n`) is familiar
with team capacity. This team decides when to expand a project to new languages. They
reach out to the language team leads to ask for expansion.

Language support varies among [Mozilla projects][]. Some relevant projects, and the
supported languages as of September 2023, include:

- [Firefox Relay Website][pontoon-relay-website] (26 languages)
- [Firefox Relay Add-on][pontoon-relay-add-on] (26 languages)
- [Accounts][pontoon-accounts] (78 languages)
- [Mozilla.org][pontoon-mozilla-org] (98 languages)
- [SUMO][pontoon-sumo] for [support.mozilla.org][support-for-relay] (87 languages)
- [AMO Frontend][pontoon-amo-frontend] for [addons.mozilla.org][addons-relay-page] (64 languages)

Relay staff can check translation status on the Pontoon project sites. They may use the
completeness of translated strings to decide to turn on a feature for a region. They
may focus on completeness of the Relay-specific project. These are the projects for the
[Firefox Relay Website][pontoon-relay-website] and the [Add-on][pontoon-relay-add-on].
Relay staff may identify critical strings in other projects for integration efforts.

[Catalan spoken in the Valencian Community of Spain]: https://pontoon.mozilla.org/ca-valencia/
[French]: https://pontoon.mozilla.org/fr/
[German]: https://pontoon.mozilla.org/de/
[Interlingua]: https://pontoon.mozilla.org/ia/firefox-relay-website/
[Luxembourgish]: https://pontoon.mozilla.org/lb/
[Mozilla projects]: https://pontoon.mozilla.org/projects/
[Pontoon]: https://pontoon.mozilla.org/
[Sicilian]: https://pontoon.mozilla.org/scn/
[Spanish spoken in Spain]: https://pontoon.mozilla.org/es-ES/
[Volunteer translation teams]: https://pontoon.mozilla.org/teams/
[addons-relay-page]: https://addons.mozilla.org/en-US/firefox/addon/private-relay/
[pontoon-accounts]: https://pontoon.mozilla.org/projects/firefox-accounts/
[pontoon-amo-frontend]: https://pontoon.mozilla.org/projects/amo-frontend/
[pontoon-mozilla-org]: https://pontoon.mozilla.org/projects/mozillaorg/
[pontoon-relay-add-on]: https://pontoon.mozilla.org/projects/firefox-relay-add-on/
[pontoon-relay-website]: https://pontoon.mozilla.org/projects/firefox-relay-website/
[pontoon-sumo]: https://pontoon.mozilla.org/projects/sumo/
[support-for-relay]: https://support.mozilla.org/en-US/products/relay

### Shipping Translations

Pontoon syncs translations between its database and code repositories. The
[Mozilla Localization Team][] GitHub organization hosts most project translation
repositories. The Pontoon project page has a link to the project repository. Some
relevant repositories include:

- [mozilla-l10n/fx-private-relay-l10n][] for the [Firefox Relay Website][]
- [mozilla-l10n/fx-private-relay-add-on-l10n][] for the [Firefox Relay Add-on][]
- [mozilla/fxa-content-server-l10n][] for [Accounts][],
  including [subscription pages][]
- [mozilla-l10n/www-l10n][] for [mozilla.org][]
- [mozilla-l10n/sumo-l10n][] for [support.mozilla.org][]
- [mozilla/addons-frontend][] for [addons.mozilla.org][]

Pontoon writes translation updates as new commits to their repository. Relay projects
include the translation repositories as [git submodules][], such as
[privaterelay/locales][]. A submodule references a specific commit in a separate
repository. A [GitHub action][] updates this commit to the latest each
night. This action synchronizes the main Relay branch with the latest translations.

This synchronization strategy works best for Relay. It balances up-to-date translation
changes against the complexity of submodules. There are other strategies. Some
projects allow Pontoon to write to their code repository. This clutters commit history
with translations. It also runs continuous integration tests for each translation
update. Other projects keep a copy of translations and sync them when needed. This
requires manual work, documentation, and discipline. It often falls to a single
engineer, and is not done when they are busy or out of office.

Translations for Relay, and many projects at Mozilla, use the [Fluent format][]. The
["en" bundle][] (American / generic English) has the source translations. Developers
split the translations into functional areas, such as [faq.ftl][] for the [FAQ page][].
The other language bundles are translations of the `"en"` bundle, coordinated in
Pontoon. Relay's continuous testing creates Docker images that include the translations.
The [Django back end][] uses select Fluent files. The front end uses translations
embedded into the JavaScript during Docker image creation.

["en" bundle]: https://github.com/mozilla-l10n/fx-private-relay-l10n/tree/main/en
[Accounts]: https://accounts.firefox.com/
[Django back end]: https://github.com/mozilla/fx-private-relay/blob/main/privaterelay/ftl_bundles.py
[FAQ page]: https://relay.firefox.com/faq/
[Firefox Relay Add-on]: https://addons.mozilla.org/firefox/addon/private-relay/
[Firefox Relay Website]: https://relay.firefox.com/
[Fluent format]: https://projectfluent.org/
[GitHub action]: https://github.com/mozilla/fx-private-relay/actions/workflows/l10n-sync.yml
[Mozilla Localization Team]: https://github.com/mozilla-l10n
[addons.mozilla.org]: https://addons.mozilla.org/
[faq.ftl]: https://github.com/mozilla-l10n/fx-private-relay-l10n/blob/main/en/faq.ftl
[git submodules]: https://git-scm.com/book/en/v2/Git-Tools-Submodules
[mozilla-l10n/fx-private-relay-add-on-l10n]: https://github.com/mozilla-l10n/fx-private-relay-add-on-l10n
[mozilla-l10n/sumo-l10n]: https://github.com/mozilla-l10n/sumo-l10n
[mozilla-l10n/www-l10n]: https://github.com/mozilla-l10n/www-l10n
[mozilla.org]: https://www.mozilla.org/
[mozilla/addons-frontend]: https://github.com/mozilla/addons-frontend/locale
[mozilla/fxa-content-server-l10n]: https://github.com/mozilla/fxa-content-server-l10n
[privaterelay/locales]: https://github.com/mozilla/fx-private-relay/tree/main/privaterelay
[subscription pages]: https://subscriptions.firefox.com/subscriptions
[support.mozilla.org]: https://support.mozilla.org/

### Adding New Translations

Many teams and systems work together to get new translations to Relay users. The
high-level steps are:

1. A Relay designer and copy-editor create designs with new strings.
2. A Relay developer adds pending strings to the Relay repository.
3. Relay staff refine the strings during feature development.
4. A Relay developer submits the strings to the translation repository.
5. The Localization team reviews the strings.
6. The Localization team merges the accepted strings into the translation repository.
7. Pontoon imports the new strings.
8. Translators translate the new strings.
9. Pontoon exports translations to the translation repository.
10. The nightly GitHub action updates the Relay repository with the latest translations.
11. The continuous testing process builds a release Docker image with the
    translations.
12. The continuous integration process releases the Docker image to the stage environment.
13. The Quality Assurance (QA) team checks the stage environment. They verify the
    features and translations.
14. A Service Reliability Engineer (SRE) releases the Docker image to the production
    environment. Users see the new content in their language.
15. A Relay developer removes the pending strings from the Relay repository.

The section [Submitting Pending Translations](#submitting-pending-translations) details the
development process.

### Relay Assumes Left-To-Right Script

All Relay-supported languages use a left-to-right (LTR) script. For example, the
default Relay language is English, the same language as this document. English uses the
Latin script, written left-to-right.

> [!WARNING]
> None of Relay's supported languages use [right-to-left scripts][]. Other Mozilla
> projects support right-to-left (RTL) languages. They spent significant time and effort
> to add the first RTL language.

To add the first RTL script, developers must educate themselves on [internationalization
techniques][]. Designers will learn RTL conventions. Developers examine every webpage,
email, and UI element. The content should work regardless of text direction. Buttons
should flow with the text direction. Some existing translation strings will change and
need re-translation. The new language translation team will want to review strings in
the context of the website.

The first right-to-left language is the hardest. The next languages are as easy to add
as other left-to-right languages.

[Hebrew][], [Arabic][], and [Persian][] are the most widespread right-to-left modern
writing systems. The support website has localized content in [Hebrew][support-hebrew],
[Arabic][support-arabic], and [Persian][support-persian]. These pages show right-to-left
layouts. Compare them to a left-to-right layout such as the [French localization][].

[Arabic]: https://en.wikipedia.org/wiki/Arabic_script
[Hebrew]: https://en.wikipedia.org/wiki/Hebrew_alphabet
[Persian]: https://en.wikipedia.org/wiki/Persian_alphabet
[right-to-left scripts]: https://en.wikipedia.org/wiki/Right-to-left_script
[internationalization techniques]: https://www.w3.org/International/techniques/authoring-html
[support-hebrew]: https://support.mozilla.org/he/
[support-arabic]: https://support.mozilla.org/ar/
[support-persian]: https://support.mozilla.org/fa/
[French localization]: https://support.mozilla.org/fr/

## The Technical Details of Region Selection

Relay premium plans are not available world-wide, only in some regions. As of September
2023, the premium email service is available in 34 regions. Phone infrastructure varies,
so the phone service is available in only 2 regions. This section details the
technologies used to distinguish users by region.

### Identifying the User's Region

The stage and production deployments use similar load balancers. The Service Reliability
Engineers (SREs) configured these to add an `X-Client-Region` header. The header value
is the visitor's region, based on their IP address. There is no way for a user to
override this region selection. A tester can use a [VPN][] to change their IP address
and their detected region.

The `X-Client-Region` header is sometimes missing. In stage and production, some IP
addresses do not have a clear region. The development deployment does not have the
header. Local development also omits the header.

Without a `X-Client-Region` header, the code guesses a region from the `Accept-Language`
header. The language fallback looks for a language code with a regional variant. For
example, the language code `"es-MX"` (Mexican Spanish) implies region code `"MX"`
(Mexico). When there is no regional variant, the code guesses a probable region from a
[lookup table][]. The lookup table uses Unicode [Common Locale Data Repository][] (CLDR)
[Supplemental Data][]. The [Language-Territory Information][] data includes estimates of
language speakers by region.

[Common Locale Data Repository]: https://cldr.unicode.org/
[Language-Territory Information]: https://www.unicode.org/cldr/charts/42/supplemental/language_territory_information.html
[Supplemental Data]: https://www.unicode.org/cldr/charts/42/supplemental/index.html
[VPN]: https://www.mozilla.org/products/vpn
[lookup table]: https://github.com/mozilla/fx-private-relay/blob/f5c5ebf568639810db45de1ebb69f2498600d58c/privaterelay/utils.py#L72-L216

### Identifying Available Plans and Prices

The user's region determines what premium plans are available. The API sends this data
in [/api/v1/runtime_data][]. The front end adjusts content based on availability in the
user's region.

The [Subscription Platform][] (version 2) uses [Stripe][]. A [Stripe product][] represents
each Relay plan, such as the premium email service. A [Stripe price][] represents how a
user will pay. The price has an associated product, a currency, tax details, and a term.
Many Relay plans have monthly and yearly subscription terms. The VPN bundle only has a
yearly subscription term.

The Subscription Platform associates a price with a region. Product reports may use this
to segment purchasers by region. Relay detects the user's region and determines what
plans are available. Relay selects the relevant price ID when sending a user to the
Subscription Platform. The Subscription Platform [does not confirm the user's region][].

The Subscription Platform associates a price with a language. On the subscription page,
product details appear in the price language. The rest of the subscription page appears
in the user's preferred language. For most users, the price language and preferred
language should be the same.

Many regions have their own price, such as Denmark, which uses the Danish language and
the krone. Others share the price of a nearby region, such as Austria, which uses
Germany's prices in German and Euros. A minority are more complex, choosing a price
based on language. Belgium users share the price in Euros of a neighbor, based on
language. Switzerland has separate prices for German, French, and Italian speakers.
All the Swiss prices are in Swiss Francs. See [privaterelay/plans.py][] for details.

The Subscription Platform supports certain [markets and currencies][]. The Subscription
Platform has configured Stripe to reject payments from outside these markets.
A Relay user's payment method, such as a credit card, has a payment region. The
user region detected by Relay may differ from the user's payment region. Relay may say a
user can buy a plan, and then Stripe may reject payment.

In development and stage, there are test prices connected to the [Stripe test mode][].
One feature of test mode is fake credit cards. These cards allow testing without paying
real money, and testing failure modes. A test visitor from the United States will get
these prices. Other regions get the production prices.

[/api/v1/runtime_data]: https://relay.firefox.com/api/v1/runtime_data
[Stripe product]: https://stripe.com/docs/api/products
[Stripe test mode]: https://stripe.com/docs/test-mode
[Subscription Platform]: https://mozilla.github.io/ecosystem-platform/relying-parties/reference/sub-plat-features
[does not confirm the user's region]: https://mozilla.github.io/ecosystem-platform/relying-parties/reference/sub-plat-features#geo-restrictions
[markets and currencies]: https://mozilla-hub.atlassian.net/wiki/spaces/FJT/pages/173539548/Supported+Markets+and+Currencies

## Terms

Relay developers will see these terms as they work in this topic:

- **[Internationalization][]**: Designing a service to adapt to different locales
  without per-locale code changes. This is often abbreviated **i18n**, to stand for the
  starting letter "i", the next 18 letters, and the ending letter "n". This abbreviation
  also avoids the spelling differences between American and British English.
- **[Language][]**: A spoken or written system of communication. English is a broad
  language category. A language can be specific to a region, such as German spoken in
  Switzerland. In localization, the written system can be important as well. For
  example, Chinese can vary between mainland China and other regions. It can also
  use Simplified or Traditional Chinese script when written.
- **[Locale][]**: Shared cultural conventions that appear in a user interface. This
  can include language, letters, and currencies. It can also include formats for prices,
  numbers, dates, and times. For example, American English can be a locale. This locale
  uses the English alphabet in left-to-right text. Prices are in US Dollars (USD, "$5.99").
  Numbers use commas as thousands separators (525,960 minutes in a year). The first
  number in a short date is the month ("9/12/2023" for September 12, 2023).
  English-speaking users in other regions share some of these conventions. Other
  conventions, like currency and date formats, will vary.
- **[Localization][]**: Adapting software to a specific locale. This includes translating
  text and using locale-specific formats. This is often abbreviated **L10n**, in a
  similar way to i18n. A capital "L" avoids confusing a lowercase "l" with an
  uppercase "I".
- **[Region][]**: An [administrative division][] that can be the basis for a
  locale. Mozilla prefers to use "Region" instead of "**Country**" when talking about
  localization. A region can include areas within a country, as well as areas that
  span countries.
- **[Translation][]**: The process of adapting language strings or patterns to a
  second language. This is one aspect of Localization. At Mozilla, American English is
  the source language for interface text.

[Internationalization]: https://en.wikipedia.org/wiki/Internationalization_and_localization
[Language]: https://en.wikipedia.org/wiki/Language
[Locale]: https://en.wikipedia.org/wiki/Locale_(computer_software)
[Localization]: https://en.wikipedia.org/wiki/Internationalization_and_localization
[Region]: https://en.wikipedia.org/wiki/Region
[Translation]: https://en.wikipedia.org/wiki/Translation
[administrative division]: https://en.wikipedia.org/wiki/Administrative_division

## Standards for Identifiers

There are internet standard identifiers for regions, languages, locales, and currency.
In most cases, Mozilla uses the standard identifiers. There are exceptions for common
usage and legacy cases. Relay users should follow the standards, unless Mozilla has an
established exception.

- **Currency**: [ISO 4217][] defines codes for currencies.
  - The Subscription Platform and Relay use the upper-case, three-letter codes.
    For example, `"USD"` for United States dollars and `"EUR"` for Euros.
- **Language**: [ISO 639][] is a multi-part standard for identifying languages.
  Wikipedia has a [useful table][] of [ISO 639-1][] codes (two lowercase letters). The
  Library of Congress has a [table of languages][] with [ISO 639-2][] codes (three
  lowercase letters). This table has the related ISO 639-1 codes, when available.
  - Mozilla uses the ISO 639-1 two-letter code when available. For example, `"en"`
    identifies English, and `"fr"` identifies French. Mozilla falls back to the ISO
    639-2 three-letter code (such as `"yue"` for [Cantonese][]).
- **Locale**: Locales are usually identified by a language tag. This is a language
  identifier, plus extra identifiers as needed. [RFC 5646][], "Tags for Identifying
  Languages", defines language tags. This RFC is the second half of [BCP 47][].
  The "Accept-Language" header ([RFC 9110][]) uses language tags. This
  header is how a web browser communicates the user's preferred language.
  - Mozilla uses language tags to identify locales. For
    example, `"fr"` identifies generic French, and `"es-ES"` for Spanish in Spain.
  - Pontoon uses `"en"`, rather than `"en-US"`, for [English][] as written in the
    United States. Other English-speaking locales include the region. For example,
    `"en-GB"` identifies English as used in the United Kingdom .
  - The default Firefox `Accept-Language` header for every language includes `"en"`.
    Most also include "`en-US`". See ["Identifying the User's Preferred Languages"][] for
    more details.
  - Mozilla uses the language tag `"zh-CN"` for
    [Simplified Chinese as common in China][]. The language tag `"zh-TW"` stands for
    [Traditional Chinese as common in Taiwan][]. Recent standards may instead emphasize
    the script. For example, `"zh-Hans"` means Han Simplified, and `"zh-Hant"` means Han
    Traditional. A region can make the tag more specific, such as `"zh-Hans-CN"`.
    [Most browsers][], including [Firefox][], use `"zh-CN"` and `"zh-TW"` in the
    `Accept-Language` header. Mozilla web services may need to handle the `-Hans` and
    `-Hant` variants.
  - [RFC 9110][] specifies "quality values", or "qvalues" to weight language
    preferences. The header `"Accept-Language: en-US,en;q=0.5"` uses qvalues. Some
    websites break when parsing a header with qvalues. Firefox and other browsers do not
    use qvalues in `Accept-Language` defaults. Instead, the order of languages is the
    order of preference.
- **Region**: [ISO 3166][] is a multi-part standard for identifying countries,
  territories, and subdivisions. The [ISO 3166-1 alpha-2][] code (two uppercase
  letters) is common as a region identifier.
  - Mozilla uses the ISO 3166-1 alpha-2 code for a region when available. For example,
    `"US"` identifies the United States, and `"DE"` identifies Germany. An
    exception is [Valencia][], which uses `"valencia"`. Another is the
    [Surselva Region][], which uses `"sursilv"`.

["Identifying the User's Preferred Languages"]: #identifying-the-users-preferred-languages
[BCP 47]: https://www.rfc-editor.org/info/bcp47
[Cantonese]: https://en.wikipedia.org/wiki/Cantonese
[English]: https://en.wikipedia.org/wiki/English_language
[Firefox]: https://pontoon.mozilla.org/zh-CN/firefox/toolkit/chrome/global/intl.properties/?string=81017
[ISO 3166-1 alpha-2]: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
[ISO 3166]: https://en.wikipedia.org/wiki/ISO_3166
[ISO 4217]: https://en.wikipedia.org/wiki/ISO_4217
[ISO 639-1]: https://en.wikipedia.org/wiki/ISO_639-1
[ISO 639-2]: https://en.wikipedia.org/wiki/ISO_639-2
[ISO 639]: https://en.wikipedia.org/wiki/ISO_639
[Most browsers]: https://stackoverflow.com/questions/69709824/what-is-the-typical-chinese-language-code-for-the-accept-language-header
[RFC 5646]: https://www.rfc-editor.org/rfc/rfc5646.html
[RFC 9110]: https://www.rfc-editor.org/rfc/rfc9110#field.accept-language
[Simplified Chinese as common in China]: https://pontoon.mozilla.org/zh-CN/
[Surselva Region]: https://en.wikipedia.org/wiki/Surselva_Region
[Traditional Chinese as common in Taiwan]: https://pontoon.mozilla.org/zh-TW/
[Valencia]: https://en.wikipedia.org/wiki/Valencia
[table of languages]: https://www.loc.gov/standards/iso639-2/php/English_list.php
[useful table]: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
