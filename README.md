# Private Relay
Private Relay provides generated email addresses to use in place of personal
email addresses.

Recipients will still receive emails, but Private Relay keeps their personal
email address from being [harvested](https://blog.hubspot.com/marketing/what-is-a-landing-page-ht), 
and then [bought, sold, traded, or combined](https://www.bookyourdata.com/) 
with  other data to personally identify, track, and/or [target
them](https://www.facebook.com/business/help/606443329504150?helpref=faq_content).

## Development

Please refer to our [coding standards](docs/coding-standards.md) for code styles, naming conventions and other methodologies.

### Requirements
* python 3.9 (we recommend [virtualenv](https://docs.python-guide.org/dev/virtualenvs/))
* PostgreSQL - even if you are using sqlite for development, requirements.txt installs
  psycopg2 which [requires libpq](https://www.psycopg.org/docs/install.html#build-prerequisites) and Python header files.
  The following should work:
    * [On Windows](https://www.postgresql.org/download/windows/)
    * On Ubuntu: `sudo apt install postgresql libpq-dev python3-dev`
    * On OSX: `brew install postgresql libpq`
    * On Fedora: `sudo dnf install libpq-devel python3-devel`
* [SES](https://aws.amazon.com/ses/) if you want to send real emails
* [Node 14.X](https://nodejs.org/en/download/) – Needed to compile the front-end
  * [NPM](https://www.npmjs.com/)

### Install and Run the Site Locally

1. Clone and change to the directory:

    ```sh
    git clone --recurse-submodules https://github.com/mozilla/fx-private-relay.git
    cd fx-private-relay
    ```

2. Create and activate a virtual environment:

    ```sh
    virtualenv env
    source env/bin/activate
    ```

3. Install Python and Node requirements:

    ```sh
    pip install -r requirements.txt
    ```

    ```sh
    cd frontend
    npm install
    ```


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
#### Getting the latest translations
We use a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
for translated message files. The `--recurse-submodules` step of installation
should bring the message files into your working directory already, but you may
want also want to udpate the translations after install. The easiest way to do
that is:

* `git submodule update --remote`

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
tentatively add them to frontend/pendingTranslations.ftl. Strings in that file
will show up until strings with the same ID are added to the l10n repository.

#### Commit translations for release
To commit updates to the app's translations (e.g., before a release), we need
to commit this submodule update. So, if the updated translations are ready to
be committed into the app, you can `git add` the submodule just like any other
file:

* `git add privaterelay/locales`

You can then commit and push to set the app repository to the updated version
of the translations submodule:

* `git push`

### Recommended: Enable Firefox Accounts authentication
To enable Firefox Accounts authentication on your local server, you can use the
"Firefox Private Relay local dev" OAuth app on accounts.stage.mozaws.net.

To do so:

1. Set `ADMIN_ENABLED=True` in your `.env` file

2. Shutdown the server if running, and add the admin tables with:

    ```sh
    python manage.py migrate
    ```

3. Run  the server, now with `/admin` endpoints:

    ```sh
    python manage.py runserver
    ```

4. Go to [the django admin page to change the default
   site](http://127.0.0.1:8000/admin/sites/site/1/change/).

5. Change `example.com` to `127.0.0.1:8000` and click Save.

6. [Go to the django-allauth social app admin
   page](http://127.0.0.1:8000/admin/socialaccount/socialapp/), sign in with the
   superuser account you created above, and add a social app for Firefox Accounts:

| Field | Value |
|-------|-------|
| Provider | Firefox Accounts |
| Name | `accounts.stage.mozaws.net` |
| Client id | `9ebfe2c2f9ea3c58` |
| Secret key | Request this from `#fx-private-relay-eng` Slack channel |
| Sites | `127.0.0.1:8000` -> Chosen sites |

Now you can sign into [http://127.0.0.1:8000/](http://127.0.0.1:8000/) with an
FxA.

:warning: Remember that you'll need to use an account on https://accounts.stage.mozaws.net/, not
the production site, accounts.firefox.com.

<!-- #### Optional: Enable SES
TODO -->


### Optional: Install and run the add-on locally

*Note: The add-on is located in a [separate repo](https://github.com/mozilla/fx-private-relay-add-on/). See it for additional information on getting started.* 

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
Platform](https://mozilla.github.io/ecosystem-platform/docs/features/sub-plat/sub-plat-overview).
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
   * Note: each piece of this metadata must have a `product:` prefix. So, for
     example, `webIconURL` must be entered as `product:webIconURL`.

5. Add `capabilities:` metadata.
   * Note: Each piece of this metadata must have a format like
     `capabilities:<fxa oauth client ID>`, and the value is a free-form string
     to describe the "capability" that purchasing the subscription gives to the
     user. E.g., `capabilities:9ebfe2c2f9ea3c58` with value of `premium-relay`.

6. Set some env vars with values from the above steps:

| Var | Value |
|-------|-------|
| `FXA_SUBSCRIPTIONS_URL` | `https://accounts.stage.mozaws.net/subscriptions` |
| `PREMIUM_PROD_ID` | `prod_IyCWnXUbkYjDgL` (from Stripe)|
| `PREMIUM_PRICE_ID` | `price_1IMG7KKb9q6OnNsL15Hsn1HE` (from Stripe)|
| `SUBSCRIPTIONS_WITH_UNLIMITED` | `"premium-relay"` (match the `capabilities` value you used in Stripe)|

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

* [PostgreSQL](https://www.postgresql.org/)-compatible DB

### Environment Variables
Production environments should also set some additional environment variables:

```
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>
DJANGO_SECURE_HSTS_SECONDS=15768000
DJANGO_SECURE_SSL_REDIRECT=True
```
