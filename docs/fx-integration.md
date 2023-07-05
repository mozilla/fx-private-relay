# Firefox Integration

As of Firefox 111, Relay has been integrated into the Firefox browser credential
manager. This document describes the technical implementation.

## Overview

1. Firefox users sign into their browser with their FXA.
2. Firefox requests an FXA access token with Relay scope for the user.
3. Firefox sends HTTPS requests to the Relay REST API with the access token.

## Firefox users sign into their browsers with their FXA

Relay has to forward emails to someone's existing email address. So, to use Relay, users
create a [Firefox Account][sumo-fxa], which requires and verifies an existing email address.

TODO: Link to tech doc for Firefox/FXA integration.

## Firefox requests an FXA access token with Relay scope for the user

Firefox uses [`FxAccounts.getOAuthToken`][fxa-getOAuthToken], which `POST`s to [the FXA
`/oauth/token` endpoint][fxa-oauth-token] to get an access token with these scopes:

- `profile`
- `https://identity.mozilla.com/apps/relay`

By default, these access tokens expire in 24 hours. When they expire, Firefox
automatically requests a new access token for the user.

## Firefox sends HTTPS requests to the Relay REST API with the access token

Firefox sends the FXA access token to the Relay REST API as described in
[the FXA OAuth Token Authentication section of the Relay API auth doc][relay-api-doc-auth].

Firefox uses [Relay's REST API][relay-rest-api]. In particular, it uses these endpoints:

- `POST /api/v1/terms-accepted-user/` when the user opts into Relay integration.
- `GET /api/v1/profiles/` to get the user's Relay profile data.
- `GET|POST /api/v1/relayaddresses/` to get and make relay addresses for the user.

[sumo-fxa]: https://support.mozilla.org/kb/access-mozilla-services-firefox-account
[fxa-getOAuthToken]: https://searchfox.org/mozilla-central/search?q=symbol:FxAccounts%23getOAuthToken&redirect=false
[fxa-oauth-token]: https://mozilla.github.io/ecosystem-platform/api#tag/Oauth/operation/postOauthToken
[relay-rest-api]: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/docs/
[relay-api-doc-auth]: api_auth.md#fxa-oauth-token-authentication
