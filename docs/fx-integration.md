# Firefox Integration

![Firefox integration screenshot](fx-integration-screenshot.png "Firefox integration
screenshot")

In Firefox 111, Firefox desktop started to show Relay UI to signed-in users.

In Firefox 135, Firefox desktop started to show Relay UI to ALL users.

Firefox mobile will show Relay UI to ALL users in a future version.

## Overview

When Firefox Desktop shows a sign-up form in a website, it adds an autocomplete option
to use a Relay mask. This is an **opt-in feature**, backed by a **Relay API** that
authenticates users via **Firefox Account (FxA)** OAuth tokens.

This integration:

- Offers Relay to eligible users when they are asked to give their email address to a website.
- Authenticates using a short-lived FxA token.
- Allows users to create or reuse Relay masks.
- Records interactions through Glean telemetry.

---

## Key Components

### On the Client (Firefox Desktop)

- **`FirefoxRelay.sys.mjs`**: Core integration module.
  - **`RelayFeature`**: Opt-in feature implementation with three states:
    - `RelayOffered`: User has not opted in yet.
    - `RelayEnabled`: User has opted in and can generate/reuse masks.
    - `RelayDisabled`: User has opted out.
- **`LoginHelper`**, **`FxAccounts`**, **`NimbusFeatures`**: Utilities for account checks, token acquisition, and experimentation.
- **Autocomplete UI**: Triggered during sign-up form detection (`SignUpFormScenario`), with various UX treatments.

### On the Server (Relay API)

- Validates **FXA tokens** via the FxA OAuth2 `/verify` endpoint.
- Django REST Framework backend:

  - `/api/v1/terms-accepted-user`: Accepts ToS and creates the user.
  - `/api/v1/relayaddresses`: Manages Relay masks (create, list, etc.).
  - `/api/v1/profiles`: Provides user profile info.

---

## Authentication Flow

1. **FxA OAuth Token**:

   - Firefox obtains a scoped access token via `getOAuthToken({ scope: ["https://identity.mozilla.com/apps/relay"] })`.
   - All API requests include `Authorization: Bearer <token>`. Relay validates the token with FxA and creates or reuses the user profile.

2. **Terms of Service**:

   - Firefox POSTs to `/api/v1/terms-accepted-user` with the bearer token.

3. **Mask Management**:

   - Firefox POSTs to `/api/v1/relayaddresses` to create a new Relay mask.
   - GET to the same endpoint lists reusable masks.
   - POST failures (e.g. `403` due to free-tier limits) trigger reuse UI.

---

## Feature Logic

### Eligibility Checks

- User must be in a form **sign-up scenario**.
- Must be signed into the browser
  or
  be on a website in [the **RemoteSettings allow list**][fxrelay-allowlist] that controls where we offer Relay to signed-out users.

### Offer Presentation

- Firefox uses a **Nimbus experiment variable** (`firstOfferVersion`) to decide UI treatment.
- A **notification prompt** asks the user to opt into Relay.

  - For signed-out users, the flow redirects to FxA sign-in and observes verification.

- On confirmation, Firefox:

  - Notifies the Relay backend via `terms-accepted-user`.
  - Calls `generateUsernameAsync` to get a mask.
  - Autofills it into the sign-up form.

---

## Telemetry & Logging

Firefox records events through **Glean**, with each user interaction tied to a `flowId`.

Examples:

- `relayIntegration.shownOfferRelay`
- `relayIntegration.enabledOptInPanel`
- `relayIntegration.reuseMaskReusePanel`

Server-side logging uses `glean_logger()` for mask creation, deletion, and updates.

---

## Server API Details

- **`terms_accepted_user`**:

  - Verifies bearer token.
  - Creates `SocialAccount` and `Profile` if missing.
  - Returns `201` (created) or `202` (already exists).

- **`RelayAddressViewSet`**:

  - Full CRUD for random-name Relay masks.
  - Requires `IsAuthenticated` and ownership.

---

## Additional Notes

- Relay supports **rate limits**, **feature flags**, and **RemoteSettings** allowlist for granular control.
- Autocomplete UX is localized via FTL and presented through `PopupNotifications`.

[fxrelay-allowlist]: https://github.com/mozilla/fx-private-relay/blob/main/docs/fxrelay-allowlist.md
