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
* [SocketLabs Server](https://www.socketlabs.com/signup/)

### Install and Run the Site Locally
1. Clone and change to the directory:

    ```sh
    git clone https://github.com/mozilla/fx-private-relay.git
    cd fx-private-relay
    ```

2. Create and activate a virtual environment:

    ubuntu: 
    ```sh
    virtualenv env
    source env/bin/activate
    ```
    centos:
    ```sh
    python3 -m venv python3-virtualenv
    source python3-virtualenv/bin/activate
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

#### Enable Firefox Accounts Auth
To enable Firefox Accounts authentication on your local server, you can use the
"private-relay (local)" OAuth app on oauth-stable.dev.lcip.org.

To do so:

1. Set `ADMIN_ENABLED=True` in your `.env` file. 
```sh
sudo nano .env
```

2. Go to [the django admin page to change the default
   site](http://127.0.0.1:8000/admin/sites/site/1/change/).

3. Change `example.com` to `127.0.0.1:8000` and click Save.

4. [Go to the django-allauth social app admin
page](http://127.0.0.1:8000/admin/socialaccount/socialapp/), sign in with the
superuser account you created above, and add a social app for Firefox Accounts:

   * Provider: Firefox Accounts
   * Name: oauth-stable.dev.lcip.org
   * Client id: 7477974d5019bdaf
   * Secret key: ping groovecoder for this
   * Sites: 127.0.0.1:8000 -> Chosen sites

Now you can sign into [http://127.0.0.1:8000/](http://127.0.0.1:8000/) with an
FxA. Remember: you'll need to use an account on oauth-stable.dev.lcip.org, not
the production accounts.firefox.com.

#### Enable SocketLabs Inbound API

If you want to enable [SocketLabs Inbound
API](https://inbound.docs.socketlabs.com/v1/documentation/introduction) to
deliver email messages to your local server, you will need a domain where you
can set MX records, and something like [ngrok](https://ngrok.com/) to forward
public URLs to your local server.

1. In your DNS, add an MX record
   * Priority: 10
   * Value: mx.socketlabs.com

2. In your SocketLabs account, add a new server. ("Free" includes 500 messages
   per month.)

3. Under "Injection API", copy the Injection API Key into your
   `SOCKETLABS_API_KEY` env var

4. Under "For Developers", choose "Inbound API", and enable Inbound Parsing.

5. Copy the Secret Key into your `SOCKETLABS_SECRET_KEY` env var

6. Copy the Validation Key into your `SOCKETLABS_VALIDATION_KEY` env var

7. Restart your `runserver` process

8. With your server running on `127.0.0.1:8000`, use `ngrok` to forward a
   public domain to it:
   * ngrok http 127.0.0.1:8000
     * You should see output like `Forwarding https://bec216e2.ngrok.io -> http://127.0.0.1:8000`

9. On the Inbound API screen, set the Endpoint URL to your ngrok domain,
   followed by `/emails/inbound`
   (e.g., https://bec216e2.ngrok.io/emails/inbound), and click "Validate".
   * It should say "Your Endpoint URL is valid"

10. At the "Add Address/Domains" prompt, enter your domain where you set the MX
    records.
    * @domain should show up under "Current Entries"

11. Click "Update"

12. Test sending an email to test@domain
    * You should see SocketLabs send the request to your local `runserver`
    process thru your public ngrok URL.


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
