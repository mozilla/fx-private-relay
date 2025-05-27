# Relay API Authentication

## Firefox Integration and Sign-In Flow

Firefox Relay integrates with Firefox browsers to offer users email masking features. When a user encounters a sign-up form on a website, Firefox may offer to use a Relay mask. This is an opt-in feature, backed by the Relay API, which authenticates users via Firefox Account (FxA) OAuth tokens.

- Relay is offered to eligible users when they are asked to provide an email address to a website.
- Authentication uses a short-lived FxA access token.
- Users can create or reuse Relay masks.
- Interactions are recorded through Glean telemetry.

To use Relay, users must have a [Mozilla Account][sumo-fxa], which requires and verifies an existing email address. Relay forwards emails to this address.

## API Authentication Methods

The Relay API is built on [Django REST Framework][drf] and authenticates requests with any of 3 methods:

- [FXA OAuth Token Authentication](#fxa-oauth-token-authentication): Used by Firefox browsers
- [`SessionAuthentication`][sessionauthentication]: Used by the add-on "first run" to fetch a token
- [`TokenAuthentication`][tokenauthentication]: Used by the add-on and React website

## FXA OAuth Token Authentication

Firefox and other clients perform an OAuth2 flow with [the FXA OAuth service][fxa-oauth] to receive a 24-hour relay-scoped FxA access token and a long-living FxA refresh token. For example:

- Add-ons can use [`identity.launchWebAuthFlow` API][mdn-webauthflow].
- Firefox Desktop can use [`getOAuthToken`][searchfox-getoauthtoken] and [`accessTokenWithSessionToken`][searchfox-accesstokenwithsessiontoken].

### Token Scopes and Expiry

Firefox requests an access token with these scopes:

- `profile`: Allows Relay to access the user's profile data (primary email, profile pic, etc.). See [FxA doc](https://mozilla.github.io/ecosystem-platform/reference/oauth-details#profile-data).
- `https://identity.mozilla.com/apps/relay`: Restricts the token to be used only by Relay as a [resource server](https://www.oauth.com/oauth2-servers/the-resource-server/). See [resource server scoped access key](https://mozilla.github.io/ecosystem-platform/relying-parties/tutorials/integration-with-fxa#development).

By default, these access tokens expire in 24 hours. When they expire, Firefox automatically requests a new access token for the user. Clients should request `scope: ["https://identity.mozilla.com/apps/relay"]` to get a relay-scoped access token.

After the OAuth flow is complete, the client authenticates all requests to the Relay server by including an `Authorization: Bearer {fxa-access-token}` header in all API requests. The Relay server checks the token against [the FXA OAuth `/verify` endpoint][fxa-oauth-token-verify].

Note: It is up to the client to use the long-living refresh token to obtain a new access token when an old access token expires.

```mermaid
sequenceDiagram
    participant Extension
    participant FXA
    participant Relay

    rect rgba(34, 0, 51, .09)
    note right of Extension: OAuth2 Flow
    Extension->>FXA: GET /v1/authorization?...
    FXA->>Extension: 301 Moved https://{extension-id}.extensions.allizom.org/?...
    Extension->>FXA: POST /v1/oauth/token/
    FXA->>Extension: JSON: {token}
    end
    Extension->>Relay: GET /api/v1/relayaddresses Authorization: Token {token}
    Relay->>FXA: POST /v1/oauth/verify {token}
    FXA->>Relay: 200 OK
    Relay->>Extension: [{id:, address:, etc.}, {id:, address:, etc.}]
```

### Accepting Terms of Service

Firefox browsers must first `POST` to the Relay `/api/v1/terms-accepted-user` endpoint to state that the user accepted the Terms of Service. This `POST` will also create the new user and profile records in Relay.

```mermaid
sequenceDiagram
    participant Firefox
    participant FXA
    participant Relay

    rect rgba(204, 153, 255, .09)
    note right of Firefox: OAuth2 Flow
    Firefox->>FXA: POST /oauth/token/
    FXA->>Firefox: JSON: {Relay access token valid for 24 hrs}
    end
    rect rgba(153, 204, 255, .09)
    note right of Firefox: Firefox User Accepts ToS
    Firefox->>Relay: POST /api/v1/terms-accepted-user Authorization: Token {token}
    Relay->>FXA: POST /v1/introspect {token}
    FXA->>Relay: 200 OK
    Relay->>Relay: Create new user on DB if Fxa user DNE
    Relay->>Firefox: 201 Created or 202 User already exists
    end
    rect rgba(255, 255, 153, .09)
    note right of Firefox: Request new Relay Address
    Firefox->>Relay: POST /api/v1/relayaddresses Authorization: Token {token}
    Note over Relay,FXA: FxaTokenAuthentication
    Relay->>FXA: POST /v1/introspect {token}
    FXA->>Relay: 200 OK
    Relay->>Relay: Verify user exists on our DB
    Relay->>Firefox: 201 Created {"id":, "address":, ...} or 401 Unauthorized
    end
```

#### API Endpoints Used by Firefox

Firefox uses [Relay's REST API][relay-rest-api]. In particular, it uses these endpoints:

- `POST /api/v1/terms-accepted-user/` when the user opts into Relay integration.
- `GET /api/v1/profiles/` to get the user's Relay profile data.
- `GET|POST /api/v1/relayaddresses/` to get and make relay addresses for the user.

### Debugging tip

To spot-check the Relay API endpoint with an FXA OAuth token, use a tool like the [Firefox desktop browser toolbox][browser-toolbox] [Network Monitor][network-monitor] to inspect requests to `relay.firefox.com/api/v1/`, and copy the value of the `Authorization` header.

## Testing Firefox Integration with Local, Dev, or Stage Relay

To test the Firefox integration outside of the production environment, configure a Firefox profile to use non-production Relay and FxA servers:

1. Create a new Firefox profile
2. Go to `about:config`
3. Change values per the table below
4. Restart Firefox with the profile

|             | `identity.fxaccounts.autoconfig.uri` | `signon.firefoxRelay.base_url`                                     | `signon.firefoxRelay.manage_url`                           |
| ----------- | ------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Local Relay | `https://accounts.stage.mozaws.net`  | `http://127.0.0.1:8000/api/v1/`                                    | `http://127.0.0.1:8000`                                    |
| Dev Relay   | `https://accounts.stage.mozaws.net`  | `https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/`   | `https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net`   |
| Stage Relay | `https://accounts.stage.mozaws.net`  | `https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/` | `https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net` |

[drf]: https://www.django-rest-framework.org/
[sessionauthentication]: https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication
[tokenauthentication]: https://www.django-rest-framework.org/api-guide/authentication/#tokenauthentication
[mdn-webauthflow]: https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow
[fxa-oauth]: https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview
[fxa-pkce]: https://github.com/mozilla/fxa/blob/main/packages/fxa-auth-server/docs/oauth/pkce.md
[fxa-oauth-token-verify]: https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview/operation/postVerify
[searchfox-getoauthtoken]: https://searchfox.org/mozilla-central/search?q=symbol:%23getOAuthToken&redirect=false
[searchfox-accesstokenwithsessiontoken]: https://searchfox.org/mozilla-central/search?q=symbol:%23accessTokenWithSessionToken&redirect=false
[browser-toolbox]: https://firefox-source-docs.mozilla.org/devtools-user/browser_toolbox/index.html
[network-monitor]: https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/index.html
[sumo-fxa]: https://support.mozilla.org/kb/access-mozilla-services-firefox-account
[relay-rest-api]: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/api/v1/docs/
