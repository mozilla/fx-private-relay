# Core Django Development Guide

Guidance for working with the Relay core Django app.

See [../.agents/agents.backend.md](../.agents/agents.backend.md) for general backend guidance.

## Core App Overview

The `privaterelay/` app contains core Django configuration, settings, middleware, shared models, and utilities.

## Key Files

### settings.py

Central Django configuration including:

- Database configuration (PostgreSQL)
- Redis caching configuration
- AWS credentials and configuration
- Twilio credentials
- Mozilla Accounts OAuth settings
- DRF authentication classes
- Middleware pipeline
- Feature flags configuration
- Metrics configuration (StatsD)

### models.py

Core models:

- `Profile` - User profile extending Django User
  - Subscription status
  - API tokens
  - Phone numbers
  - Settings and preferences

## Management Commands

System-wide utilities in `privaterelay/management/commands/`:

### User Management

- `deactivate_user.py` - Deactivates user by API key, email, or FXA UID
- `add_user_to_group.py` - Adds user to Django group by email
- `update_user_group.py` - Updates groups for users with specific email domain
- `get_or_create_user_group.py` - Creates or fetches Django group by name

### Data Management

- `cleanup_data.py` - Detects and optionally cleans data issues
  - Server storage problems
  - Missing profiles
  - Orphaned records
- `aggregate_generated_for.py` - Aggregates mask usage statistics

### Phone Subscription Management

- `update_phone_remaining_stats.py` - Resets monthly phone usage limits for subscribers
- `sync_phone_related_dates_on_profile.py` - Syncs phone subscription dates from FxA to Profile

### Feature Flags

- `waffle_flag_by_fxa_uid.py` - Manages waffle flags by FxA UID (extends django-waffle)

### Remote Settings

- `update_fxrelay_allowlist_collection.py` - Updates Firefox Relay allowlist in Remote Settings

## Mozilla Accounts OAuth

Integration with Mozilla Accounts (FxA) for authentication.

### OAuth Flow

1. User clicks login → redirect to FxA OAuth page
2. User authenticates with FxA
3. FxA redirects back to `/accounts/login/fxa/callback/`
4. Django exchanges code for access token
5. Session established via django-allauth

**Implementation:** `privaterelay/allauth.py` - Custom FxA provider configuration

### FxA Utilities

`privaterelay/fxa_utils.py` provides:

- Token introspection
- User profile fetching
- Subscription status checking
- FxA API integration

## Feature Flags (django-waffle)

Feature flags control feature rollout.

## Subscription Plans

`privaterelay/plans.py` defines subscription tiers:

- Free tier (limited masks)
- Premium tier (unlimited masks, phone masking, custom domain)
- Bundle tiers (with VPN)

**Plan configuration includes:**

- Feature availability
- Usage limits
- Pricing information

## Common Tasks

### Adding Feature Flag

1. Create flag in Django admin or via management command
2. Use `flag_is_active` in backend code
3. Expose in runtime_data for frontend (see [../api/agents.md](../api/agents.md))
4. Add tests for both flag states

## Further Reading

- [../.agents/agents.backend.md](../.agents/agents.backend.md) - General backend guidance
- [../api/agents.md](../api/agents.md) - API authentication details
- [../emails/agents.md](../emails/agents.md) - Email metrics utilities
- [django-waffle documentation](https://waffle.readthedocs.io/)
- [django-allauth documentation](https://django-allauth.readthedocs.io/)
