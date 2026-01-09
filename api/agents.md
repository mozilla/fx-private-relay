# API App Development Guide

Guidance for working with the Relay REST API Django app.

See [../.agents/agents.backend.md](../.agents/agents.backend.md) for general backend guidance.

## API App Overview

The `api/` app provides the REST API for Firefox Private Relay using Django REST Framework (DRF).

**Tech:** Conventional Django REST Framework urls, views, serializers; some custom API authentication (FxA OAuth, Session, API Token)

## API Authentication

The API uses three authentication methods configured in DRF settings (tried in order):

### 1. FxA OAuth Bearer Token

Firefox browsers send `Authorization: Bearer {fxa-access-token}` header.

- Validated against Mozilla Accounts OAuth server
- Token introspection at `{FXA_OAUTH_ENDPOINT}/introspect`
- Checks scope: `https://identity.mozilla.com/apps/relay`
- Maps FxA UIDs to Relay users via `SocialAccount` model
- Used by Firefox integrations

**Implementation:** `api/authentication.py` - `FxaTokenAuthentication` class

### 2. Session Authentication

Frontend uses Django session cookies after OAuth login.

- Session established via `/accounts/login/fxa/callback/`
- Standard Django session middleware
- Used by React website after user completes FxA OAuth flow

**Implementation:** Built-in DRF `SessionAuthentication`

### 3. API Token Authentication

Add-on and 3rd party integrations send `Authorization: Token {api-token}` header.

- Tokens auto-generated for all users (stored in `Profile.api_token`)
- Created via signal when Profile is created
- Used by browser add-on and external integrations

**Implementation:** Built-in DRF `TokenAuthentication`

## Special Endpoint: Terms Acceptance

Firefox browsers POST to `/api/v1/terms-accepted-user/` to create new Relay user accounts.

- Accepts FxA bearer token
- Creates user/Profile/SocialAccount if needed
- Returns 201 (created) or 202 (already exists)
- Does NOT establish session (logout is called after user creation)

**Implementation:** `api/views/privaterelay.py`

## Runtime Data Endpoint

`/api/runtime_data/` provides environment-specific configuration to the frontend.

**Why:** Frontend is built once and deployed to all environments. This endpoint provides environment-specific values at runtime.

**Implementation:** `api/views/privaterelay.py` - `runtime_data` view

**To add new runtime config:**

1. Add to `runtime_data` view in `api/views/privaterelay.py`
2. Update frontend TypeScript types in `/frontend/src/hooks/api/runtimeData.ts`

## Further Reading

- [../.agents/agents.backend.md](../.agents/agents.backend.md) - General backend guidance
- [../.agents/agents.frontend.md](../.agents/agents.frontend.md) - Frontend runtime config usage
- [DRF Documentation](https://www.django-rest-framework.org/)
