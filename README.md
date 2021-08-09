# Private Relay
Private Relay provides generated email addresses to use in place of personal
email addresses.

Recipients will still receive emails, but Private Relay keeps their personal
email address from being [harvested](https://blog.hubspot.com/marketing/what-is-a-landing-page-ht), 
and then [bought, sold, traded, or combined](https://www.bookyourdata.com/) 
with  other data to personally identify, track, and/or [target
them](https://www.facebook.com/business/help/606443329504150?helpref=faq_content).

## Development

Please refer to our [coding standards](docs/coding-standards.md) information for code styles, naming conventions and other methodologies.

### Requirements
* python 3.7 (suggest using
  [virtualenv](https://docs.python-guide.org/dev/virtualenvs/))
* Postgres - even if you are using sqlite for development, requirements.txt installs
  psycopg2 which [requires libpq](https://www.psycopg.org/docs/install.html#build-prerequisites). The 
  following should work:
    * On Ubuntu: `sudo apt install postgresql libpq-dev`
    * On OSX: `brew install postgresql libpq`
    * On Fedora: `sudo dnf install libpq-devel`
* [SES](https://aws.amazon.com/ses/) if you want to send real emails
* [Node 12.X](https://nodejs.org/en/download/) – Needed for front-end SCSS compiling
  * [NPM](https://www.npmjs.com/)
  * [Gulp](https://gulpjs.com/) to compile SCSS

### Install and Run the Site Locally
1. Clone and change to the directory:

    ```sh
    git clone https://github.com/mozilla/fx-private-relay.git
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

8. Run it:

    ```sh
    python manage.py runserver
    ```

#### Recommended: Enable Firefox Accounts authentication
To enable Firefox Accounts authentication on your local server, you can use the
"Firefox Private Relay local dev" OAuth app on accounts.stage.mozaws.net.

To do so:

1. Set `ADMIN_ENABLED=True` in your `.env` file

2. Go to [the django admin page to change the default
   site](http://127.0.0.1:8000/admin/sites/site/1/change/).

3. Change `example.com` to `127.0.0.1:8000` and click Save.

4. [Go to the django-allauth social app admin
page](http://127.0.0.1:8000/admin/socialaccount/socialapp/), sign in with the
superuser account you created above, and add a social app for Firefox Accounts:

| Field | Value |
|-------|-------|
| Provider | Firefox Accounts |
| Name | `accounts.stage.mozaws.net` |
| Client id | `9ebfe2c2f9ea3c58 ` |
| Secret key | Request this from `#fx-private-relay-eng` Slack channel |
| Sites | `127.0.0.1:8000 ` -> Chosen sites |

Now you can sign into [http://127.0.0.1:8000/](http://127.0.0.1:8000/) with an
FxA. 

:warning: Remember that you'll need to use an account on oauth-stable.dev.lcip.org, not
the production site, accounts.firefox.com.

<!-- #### Optional: Enable SES
TODO -->


#### Optional: Install and run the add-on locally

*Note: The add-on is located in a [separate repo](https://github.com/mozilla/fx-private-relay-add-on/). See it for additional information on getting started.* 

The add-on adds Firefox UI to generate and auto-fill email addresses across the web. Running the add-on locally allows it to communicate with your local server (`127.0.0.1:8000`) instead of the production server (`relay.firefox.com`).

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
