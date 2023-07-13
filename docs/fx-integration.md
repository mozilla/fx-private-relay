# Firefox Integration

![Firefox integration screenshot](fx-integration-screenshot.png "Firefox integration
screenshot")

As of Firefox 111, Relay has been integrated into the Firefox browser credential
manager. It will show up for Firefox users who are signed into the browser with their
FxA. This document describes the technical implementation.

As of 2023-07-13, Relay integration is only enabled for Nightly users, so to test
reliably you'll need to use Nightly. By 2023-08-29, it should be available for all
Firefox users signed into the browser with their FxA.

## Overview

1. Firefox users sign into their browser with their FxA.
2. Firefox requests an FxA access token with Relay scope for the user.
3. Firefox sends HTTPS requests to the Relay REST API with the access token.

## Firefox users sign into their browsers with their FxA

Relay has to forward emails to someone's existing email address. So, to use Relay, users
create a [Firefox Account][sumo-fxa], which requires and verifies an existing email address.

TODO: Link to tech doc for Firefox/FxA integration.

## Firefox requests an FxA access token with Relay scope for the user

Firefox uses [`FxAccounts.getOAuthToken`][fxa-getOAuthToken], which `POST`s to [the FxA
`/oauth/token` endpoint][fxa-oauth-token] to get an access token with these scopes:

- `profile`: allows Relay to access the user's profile data which contains the user's primary email, profile pic, and more. See more information about the `profile` scope at [FxA doc](https://mozilla.github.io/ecosystem-platform/reference/oauth-details#profile-data)
- `https://identity.mozilla.com/apps/relay`: enforces the token to be only used by Relay as a [resource server](https://www.oauth.com/oauth2-servers/the-resource-server/)
  - Read more about resource server scoped access key on [FxA's development](https://mozilla.github.io/ecosystem-platform/relying-parties/tutorials/integration-with-fxa#development) doc part 8.

By default, these access tokens expire in 24 hours. When they expire, Firefox
automatically requests a new access token for the user.

## Firefox sends HTTPS requests to the Relay REST API with the access token

Firefox sends the FxA access token to the Relay REST API as described in
[the FxA OAuth Token Authentication section of the Relay API auth doc][relay-api-doc-auth].

Firefox uses [Relay's REST API][relay-rest-api]. In particular, it uses these endpoints:

- `POST /api/v1/terms-accepted-user/` when the user opts into Relay integration.
- `GET /api/v1/profiles/` to get the user's Relay profile data.
- `GET|POST /api/v1/relayaddresses/` to get and make relay addresses for the user.

## Testing with local, dev, or stage Relay

As of 2023-07-13, Relay integration is only enabled for Nightly users, so to test
reliably you'll need to use Nightly. By 2023-08-29, it should be available for all
Firefox users signed into the browser with their FxA.

To test the Firefox integration outside of the production environment, you need to
configure a Firefox profile to use non-production Relay and FxA servers.

1. Create a new Firefox profile
2. Go to `about:config`
3. Change values per the table below
4. Restart Firefox with the profile

|             | `identity.fxaccounts.autoconfig.uri` | `signon.firefoxRelay.base_url`                                     | `signon.firefoxRelay.manage_url`                           |
| ----------- | ------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Local Relay | `https://accounts.stage.mozaws.net`  | `http://127.0.0.1:8000/api/v1/`                                    | `http://127.0.0.1:8000`                                    |
| Dev Relay   | `https://accounts.stage.mozaws.net`  | `https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/`   | `https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net`   |
| Stage Relay | `https://accounts.stage.mozaws.net`  | `https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/` | `https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net` |

[sumo-fxa]: https://support.mozilla.org/kb/access-mozilla-services-firefox-account
[fxa-getOAuthToken]: https://searchfox.org/mozilla-central/search?q=symbol:FxAccounts%23getOAuthToken&redirect=false
[fxa-oauth-token]: https://mozilla.github.io/ecosystem-platform/api#tag/Oauth/operation/postOauthToken
[relay-rest-api]: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/docs/
[relay-api-doc-auth]: api_auth.md#fxa-oauth-token-authentication
