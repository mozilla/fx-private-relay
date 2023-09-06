# Relay API Authentication

The Relay API is built on [Django REST Framework][drf] and authenticates
requests with any of 3 methods:

- [FXA OAuth Token Authentication](#fxa-oauth-token-authentication)
- [`SessionAuthentication`][sessionauthentication]
- [`TokenAuthentication`][tokenauthentication]

## FXA OAuth Token Authentication

Add-ons can use the [`identity.launchWebAuthFlow` API][mdn-webauthflow]
to perform an OAuth2 flow with [the FXA OAuth service][fxa-oauth], including
[PKCE][fxa-pkce].

After the OAuth flow is complete, the add-on has an FXA access token and a
long-living FXA refresh token, and authenticates all requests to the Relay
server by including an `Authorization: Bearer {fxa-access-token}` header in all
API requests. The Relay server checks the token against
[the FXA OAuth `/verify` endpoint][fxa-oauth-token-verify].

This auth scheme can be used by other clients too. E.g., Firefox browser has a
[`getOAuthToken`][searchfox-getoauthtoken] function which can be used to
perform the same API authentication as the add-on.

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

## Firefox OAuth Token Authentication and Accept Terms of Service

Similarly to the add-on, Firefox uses the [the FXA OAuth service][fxa-oauth] `/oauth/token` endpoint with `scope: ["https://identity.mozilla.com/apps/relay"]` to get the scoped access token that expires every 24 hours (see which calls [`getOAuthToken`][searchfox-getoauthtoken] [`accessTokenWithSessionToken`][searchfox-accesstokenwithsessiontoken]).

Like the add-on, Firefox uses this token to authenticate all requests to Relay. Firefox includes an `Authorization: Bearer {fxa-access-token}` header in all API requests. Unlike the add-on, Firefox must first `POST` to the Relay `/api/v1/terms-accepted-user` endpoint to state that the user accepted the Terms of Service. This `POST` will also create the new user and profile records in Relay.

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

[drf]: https://www.django-rest-framework.org/
[sessionauthentication]: https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication
[tokenauthentication]: https://www.django-rest-framework.org/api-guide/authentication/#tokenauthentication
[mdn-webauthflow]: https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow
[fxa-oauth]: https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview
[fxa-pkce]: https://github.com/mozilla/fxa/blob/main/packages/fxa-auth-server/docs/oauth/pkce.md
[fxa-oauth-token-verify]: https://mozilla.github.io/ecosystem-platform/api#tag/OAuth-Server-API-Overview/operation/postVerify
[searchfox-getoauthtoken]: https://searchfox.org/mozilla-central/search?q=symbol:%23getOAuthToken&redirect=false
[searchfox-accesstokenwithsessiontoken]: https://searchfox.org/mozilla-central/search?q=symbol:%23accessTokenWithSessionToken&redirect=false
