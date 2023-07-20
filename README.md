<p align="center">
<img src="https://raw.githubusercontent.com/mozilla/fx-private-relay/11ad17e197e23a0453bfb74fa3670c87cfc35e36/frontend/src/components/landing/images/logo-firefox-relay.svg" width="250" />
</p>


# Private Relay 

<!-- Badges include: license, size of repository, overall coverage for project via coveralls.io on main branch, status of what is deployed via whatsdeployed.io and our circleci status for main branch. -->
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](https://raw.githubusercontent.com/mozilla/fx-private-relay/main/LICENSE)
![Repo Size](https://img.shields.io/github/repo-size/Mozilla/fx-private-relay)
[![Coverage Status](https://coveralls.io/repos/github/mozilla/fx-private-relay/badge.svg?branch=main)](https://coveralls.io/github/mozilla/fx-private-relay?branch=main)
[![What's Deployed](https://img.shields.io/badge/whatsdeployed-dev,stage,prod-green.svg)](https://whatsdeployed.io/s/60j/mozilla/fx-private-relay)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/mozilla/fx-private-relay/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/mozilla/fx-private-relay/tree/main)
 

Private Relay provides generated email addresses to use in place of personal
email addresses.

Recipients will still receive emails, but Private Relay keeps their personal
email address from being [harvested](https://blog.hubspot.com/marketing/what-is-a-landing-page-ht),
and then [bought, sold, traded, or combined](https://www.bookyourdata.com/)
with other data to personally identify, track, and/or [target
them](https://www.facebook.com/business/help/606443329504150?helpref=faq_content).

- [Private Relay](#private-relay)
  - [Development](#development)
    - [Requirements](#requirements)
    - [Install and Run the Site Locally](#install-and-run-the-site-locally)
    - [Working with translations](#working-with-translations)
      - [Getting the latest translations](#getting-the-latest-translations)
      - [Add/update messages for translation](#addupdate-messages-for-translation)
      - [Commit translations for release](#commit-translations-for-release)
    - [Recommended: Enable Firefox Accounts authentication](#recommended-enable-firefox-accounts-authentication)
    - [Optional: Install and run the add-on locally](#optional-install-and-run-the-add-on-locally)
    - [Optional: Run a development server to compile the frontend](#optional-run-a-development-server-to-compile-the-frontend)
    - [Optional: Enable Premium Features](#optional-enable-premium-features)
    - [Optional: Debugging JavaScript bundle sizes](#optional-debugging-javascript-bundle-sizes)
      - [Test Premium](#test-premium)
  - [Production Environments](#production-environments)
    - [Requirements](#requirements-1)
    - [Environment Variables](#environment-variables)
## Development

Please refer to our [coding standards](docs/coding-standards.md) for code styles, naming conventions and other methodologies.

### Requirements

- python 3.10 (we recommend [virtualenv](https://docs.python-guide.org/dev/virtualenvs/))
- PostgreSQL - even if you are using sqlite for development, requirements.txt installs
  psycopg2 which [requires libpq](https://www.psycopg.org/docs/install.html#build-prerequisites) and Python header files.
  The following should work:
  - [On Windows](https://www.postgresql.org/download/windows/)
  - On Ubuntu: `sudo apt install postgresql libpq-dev python3-dev`
  - On OSX: `brew install postgresql libpq`
  - On Fedora: `sudo dnf install libpq-devel python3-devel`
- [SES](https://aws.amazon.com/ses/) if you want to send real emails
- [Volta](https://volta.sh/) – Sets up the right versions of Node and npm, needed to compile the front-end

### Install and Run the Site Locally

1. Clone and change to the directory:

   ```sh
   git clone --recurse-submodules https://github.com/mozilla/fx-private-relay.git
   cd fx-private-relay
   ```

2. Create and activate a virtual environment:

   Unix based systems:

   ```sh
   virtualenv env
   source env/bin/activate
   ```

   Windows:

   ```sh
   python -m venv env
   source env/Scripts/activate
   ```

   If you are not using Git Bash on Windows, instead of typing `source env/Scripts/activate`, type `.\env\Scripts\activate`.

   Note: If you're running on Windows and get an error message stating that executing scripts are disabled on your computer, go into the Windows powershell and type `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Unrestricted`, then try again.

3. Install Python and Node requirements:

   ```sh
   pip install -r requirements.txt
   ```

   ```sh
   cd frontend
   npm install
   cd ../
   ```

   Note: If you're running on Windows, you may run into an issue with usage of environment variables in npm scripts. You can force npm to use git-bash: `npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"`. This the default location, your install may be different.

4. Copy `.env` file for
   [`decouple`](https://pypi.org/project/python-decouple/) config:

   ```sh
   cp .env-dist .env
   ```

5. Add a `SECRET_KEY` value to `.env`:

   ```ini
   SECRET_KEY=secret-key-should-be-different-for-every-install
   ```

6. Migrate DB:

   ```sh
   python manage.py migrate
   ```

7. Create superuser:

   ```sh
   python manage.py createsuperuser
   ```

8. Run the backend:

   ```sh
   python manage.py runserver
   ```

   and in a different terminal, build the frontend:

   ```sh
   cd frontend
   npm run watch
   ```

### Working with translations

The following docs will get you started with development, include creating new
strings to translate. See [Translation and Localization](docs/translations.md)
for general information on Relay localization.

#### Getting the latest translations

We use a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
for translated message files. The `--recurse-submodules` step of installation
should bring the message files into your working directory already, but you may
want also want to update the translations after install. The easiest way to do
that is:

- `git submodule update --remote`

To update the submodule automatically when running `git pull` or other commands:

- `git config --global submodule.recurse true`

#### Add/update messages for translation

The `privaterelay/locales` directory is a git repository like any other, so to
make changes to the messages:

1. Make whatever changes you need in `privaterelay/locales/en` as you work.

2. `cd privaterelay/locales/en`

3. `git branch message-updates-yyyymmdd`

4. `git push -u origin message-updates-yyyymmdd`

You can then open a pull request from the `message-updates-yyyymmdd` branch to
[the l10n repo](https://github.com/mozilla-l10n/fx-private-relay-l10n) `main` branch.

If you're not yet ready to submit some strings for translation, you can
tentatively add them to `frontend/pendingTranslations.ftl`. Strings in that file
will show up until strings with the same ID are added to the l10n repository.

#### Commit translations for release

To commit updates to the app's translations (e.g., before a release), we need
to commit this submodule update. So, if the updated translations are ready to
be committed into the app, you can `git add` the submodule just like any other
file:

- `git add privaterelay/locales`

You can then commit and push to set the app repository to the updated version
of the translations submodule:

- `git push`

An automated process updates the submodule daily, bringing in any new changes
and translations from the Localization Team.

### Recommended: Enable Firefox Accounts authentication

To enable Firefox Accounts authentication on your local server, you can use the
"Firefox Private Relay local dev" OAuth app on accounts.stage.mozaws.net.

To do so:

1. Set `ADMIN_ENABLED=True` in your `.env` file

2. Shutdown the server if running, and add the admin tables with:

   ```sh
   python manage.py migrate
   ```

3. Run the server, now with `/admin` endpoints:

   ```sh
   python manage.py runserver
   ```

4. Go to [the django admin page to change the default
   site](http://127.0.0.1:8000/admin/sites/site/1/change/).

5. Change `example.com` to `127.0.0.1:8000` and click Save.

6. [Go to the django-allauth social app admin
   page](http://127.0.0.1:8000/admin/socialaccount/socialapp/), sign in with the
   superuser account you created above, and add a social app for Firefox Accounts:

| Field      | Value                                                   |
| ---------- | ------------------------------------------------------- |
| Provider   | Firefox Accounts                                        |
| Name       | `accounts.stage.mozaws.net`                             |
| Client id  | `9ebfe2c2f9ea3c58`                                      |
| Secret key | Request this from `#fx-private-relay-eng` Slack channel |
| Sites      | `127.0.0.1:8000` -> Chosen sites                        |

Now you can sign into [http://127.0.0.1:8000/](http://127.0.0.1:8000/) with an
FxA.

:warning: Remember that you'll need to use an account on https://accounts.stage.mozaws.net/, not
the production site, accounts.firefox.com.

<!-- #### Optional: Enable SES
TODO -->

### Optional: Install and run the add-on locally

_Note: The add-on is located in a [separate repo](https://github.com/mozilla/fx-private-relay-add-on/). See it for additional information on getting started._

The add-on adds Firefox UI to generate and auto-fill email addresses across the web. Running the add-on locally allows it to communicate with your local server (`127.0.0.1:8000`) instead of the production server (`relay.firefox.com`).

### Optional: Run a development server to compile the frontend

`npm run watch` watches the `frontend/src` directory and builds the frontend
when it detects changes. However, creating a production build is just time-consuming
enough to interrupt your development flow. It is therefore also possible to run the
front-end on a separate server that only recompiles changed modules, and does not
apply production optimizations. To do so, instead of `npm run watch`, run
`npm run dev`.

The frontend is now available at http://localhost:3000. Keep in mind that this
does make your local development environment less similar to production; in
particular, authentication is normally bound to the backend server, and thus
needs to be simulated when running the frontend on a separate server. If
you make any changes related to authentication, make sure to test them using
`npm run watch` as well.

### Optional: Enable Premium Features

**Note:** Premium features are automatically enabled for any user with an email address ending in
`mozilla.com`, `getpocket.com`, or `mozillafoundation.org` (see `PREMIUM_DOMAINS` in
`emails/models.py`). To mimic the customer's experience, it is recommended to follow the below
procedure.

To enable the premium Relay features, we integrate with the [FXA Subscription
Platform](https://mozilla.github.io/ecosystem-platform/relying-parties/reference/sub-plat-overview).
At a high level, to set up Relay premium subscription, we:

1. [Enable Firefox Accounts Authentication](#recommended-enable-firefox-accounts-authentication) as described above.

2. Create a product & price in our [Stripe dashboard](https://dashboard.stripe.com/).
   (Ask in #subscription-platform Slack channel to get access to our Stripe dashboard.)

3. Link free users of Relay to the appropriate SubPlat purchase flow.

4. Check users' FXA profile json for a `subscriptions` field to see if they can
   access a premium, subscription-only feature.

In detail:

1. [Enable Firefox Accounts Authentication](#recommended-enable-firefox-accounts-authentication) as described above.

2. Go to our [Stripe dashboard](https://dashboard.stripe.com/).
   (Ask in #subscription-platform Slack channel to get access to our Stripe dashboard.)

3. Create a new product in Stripe.

4. Add all [required `product:` metadata](https://github.com/mozilla/fxa/blob/a0c7ac2b4bad0412a0f3a25fc82b5670922f8957/packages/fxa-auth-server/lib/routes/validators.js#L396-L437).

   - Note: each piece of this metadata must have a `product:` prefix. So, for
     example, `webIconURL` must be entered as `product:webIconURL`.

5. Add `capabilities:` metadata.

   - Note: Each piece of this metadata must have a format like
     `capabilities:<fxa oauth client ID>`, and the value is a free-form string
     to describe the "capability" that purchasing the subscription gives to the
     user. E.g., `capabilities:9ebfe2c2f9ea3c58` with value of `premium-relay`.

6. Set some env vars with values from the above steps:

| Var                            | Value                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| `FXA_SUBSCRIPTIONS_URL`        | `https://accounts.stage.mozaws.net/subscriptions`                     |
| `PERIODICAL_PREMIUM_PROD_ID`   | `prod_KEq0LXqs7vysQT` (from Stripe)                                   |
| `PREMIUM_PLAN_ID_US_MONTHLY`   | `price_1LiMjeKb9q6OnNsLzwixHuRz` (from Stripe)                        |
| `PREMIUM_PLAN_ID_US_YEARLY`    | `price_1LiMlBKb9q6OnNsL7tvrtI7y` (from Stripe)                        |
| `PHONE_PROD_ID`                | `prod_LviM2I0paxH1DZ` (from Stripe)                                   |
| `PHONE_PLAN_ID_US_MONTHLY`     | `price_1LDqw3Kb9q6OnNsL6XIDst28` (from Stripe)                        |
| `PHONE_PLAN_ID_US_YEARLY`      | `price_1Lhd35Kb9q6OnNsL9bAxjUGq` (from Stripe)                        |
| `BUNDLE_PROD_ID`               | `prod_MQ9Zf1cyI81XS2` (from Stripe)                                   |
| `BUNDLE_PLAN_ID_US`            | `price_1Lwp7uKb9q6OnNsLQYzpzUs5` (from Stripe)                        |
| `SUBSCRIPTIONS_WITH_UNLIMITED` | `"premium-relay"` (match the `capabilities` value you used in Stripe) |
| `SUBSCRIPTIONS_WITH_PHONE`     | `"relay-phones"` (match the `capabilities` value you used in Stripe)  |

### Optional: Debugging JavaScript bundle sizes

In `frontend/`, set `ANALYZE=true` when running `npm run build` to generate a
report detailing which modules are taking up most of the bundle size. A report
will be generated for both the client and server part of the frontend, but since
we only use the client, we're really only interested in that. The reports will
automatically open in your browser, and can also be found in
`/frontend/.next/analyze/`.

```sh
ANALYZE=true npm run build
```

#### Test Premium

There is a [comprehensive doc of test
cases](https://docs.google.com/spreadsheets/d/1fMl4LHr1kIuGHfS9jyhLrv5vAyJMBUCr2AP0sODFmJw/edit#gid=0) for purchasing premium Relay.

You can use [Stripe's test credit card details](https://stripe.com/docs/testing#cards) for payment.

## Production Environments

### Requirements

In addition to the requirements for dev, production environments should use:

- [PostgreSQL](https://www.postgresql.org/)-compatible DB

### Environment Variables

Production environments should also set some additional environment variables:

```
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>
DJANGO_SECURE_HSTS_SECONDS=15768000
DJANGO_SECURE_SSL_REDIRECT=True
```
