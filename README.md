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
  [virtualenv](http://docs.python-guide.org/en/latest/dev/virtualenvs/))

### Install and Run
1. Clone and change to the directory:

    ```sh
    git clone git@github.com:mozilla/fx-private-relay.git
    cd fx-private-relay
    ```

2. Create and activate a virtual environment:

    ```sh
    virtualenv env
    source env/bin/activate
    ```

3. Install requirements:

    ```sh
    pip install -r requirements.txt
    ```

4. Copy `.env` file for
   [`decouple`](https://pypi.python.org/pypi/python-decouple) config:

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

### Enable Firefox Accounts Auth
To enable Firefox Accounts authentication on your local server, you can use the
"private-relay (local)" OAuth app on oauth-stable.dev.lcip.org.

To do so, [go to the django-allauth social app admin
page](http://127.0.0.1:8000/admin/socialaccount/socialapp/), sign in with the
superuser account you created above, and add a social app for Firefox Accounts:

* Provider: Firefox Accounts
* Name: oauth-stable.dev.lcip.org
* Client id: 7477974d5019bdaf
* Secret key: ping groovecoder for this
* Sites: example.com -> Chosen sites

Now you can sign into [http://127.0.0.1:8000/](http://127.0.0.1:8000/) with an
FxA. Remember: you'll need to use an account on oauth-stable.dev.lcip.org, not
the production accounts.firefox.com.
