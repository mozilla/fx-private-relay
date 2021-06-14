# Private Relay
Private Relay provides generated email addresses to use in place of personal
email addresses.

Recipients will still receive emails, but Private Relay keeps their personal
email address from being [harvested](https://blog.hubspot.com/marketing/what-is-a-landing-page-ht), 
and then [bought, sold, traded, or combined](https://www.bookyourdata.com/) 
with  other data to personally identify, track, and/or [target
them](https://www.facebook.com/business/help/606443329504150?helpref=faq_content).

## Development
### Requirements
* python 3.7 (suggest using
  [virtualenv](https://docs.python-guide.org/dev/virtualenvs/))
* Postgres - even if you are using sqlite for development, requirements.txt installs
  psycopg2 which [requires libpq](https://www.psycopg.org/docs/install.html#build-prerequisites). The 
  following should work:
    * On Ubuntu: `sudo apt install postgresql libpq-dev`
    * On OSX: `brew install postgresql libpq`
* [SES](https://aws.amazon.com/ses/) if you want to send real emails
* [NPM](https://www.npmjs.com/) and [Gulp](https://gulpjs.com/) to compile SCSS

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

3. Install Pyhton and Node requirements:

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

Next you'll need to enable Firefox Accounts auth ...

#### Enable Firefox Accounts Auth
To enable Firefox Accounts authentication on your local server, you can use the
"private-relay (local)" OAuth app on oauth-stable.dev.lcip.org.

To do so:

1. Set `ADMIN_ENABLED=True` in your `.env` file

2. Go to [the django admin page to change the default
   site](http://127.0.0.1:8000/admin/sites/site/1/change/).

3. Change `example.com` to `127.0.0.1:8000` and click Save.

4. [Go to the django-allauth social app admin
page](http://127.0.0.1:8000/admin/socialaccount/socialapp/), sign in with the
superuser account you created above, and add a social app for Firefox Accounts:

   * Provider: Firefox Accounts
   * Name: oauth-stable.dev.lcip.org
   * Client id: 9ebfe2c2f9ea3c58
   * Secret key: ping groovecoder for this
   * Sites: 127.0.0.1:8000 -> Chosen sites

Now you can sign into [http://127.0.0.1:8000/](http://127.0.0.1:8000/) with an
FxA. Remember: you'll need to use an account on oauth-stable.dev.lcip.org, not
the production accounts.firefox.com.

#### Enable SES
TODO


### Install and run the add-on locally

The add-on adds Firefox UI to generate and auto-fill email addresses. You may
want to build the add-on so that it communicates with your `127.0.0.1:8000`
server instead of the production `relay.firefox.com` server:

1. In the `extension/` directory, run `npm install` and then `npm run build`

2. Use `about:debugging` to install the resulting `static/downloads/addon/latest/private_relay.zip` file.
   * Note: A link to the `.zip` is also available at http://127.0.0.1:8000/accounts/profile/


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
