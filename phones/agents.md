# Phones App Development Guide

Guidance for working with the Relay phone masking app.

See [../.agents/agents.backend.md](../.agents/agents.backend.md) for general backend guidance.

## Phones App Overview

The `phones/` app handles phone masking business logic and Twilio integration.

**Tech:** Twilio for phone services (SMS, voice calls)

## Key Models

### RealPhone

User's verified real phone number links to user Profile.

### RelayNumber

Masked phone number provided to user.

- Twilio phone number
- Linked to user's RealPhone
- Call and SMS forwarding configuration

### InboundContact

Tracks contacts that have communicated with masked numbers.

- Maps external numbers to masked numbers
- Stores last interaction time
- Tracks blocked status

## Phone Flow

Phone masking happens **synchronously** in web requests (unlike email which is async).

### Inbound SMS Flow

1. External number sends SMS to masked number
2. Twilio receives SMS
3. Twilio webhook → Django endpoint
4. Django app looks up user's real number
5. Django app sends SMS to real number via Twilio

### Inbound Call Flow

1. External number calls masked number
2. Twilio receives call
3. Twilio webhook → Django endpoint
4. Django instructs Twilio to forward call to user's real number
5. Call connected

### Reply Flow

When users reply/call from their real number:

1. User sends SMS/call from real number to Twilio number
2. Twilio webhook → Django endpoint
3. Django identifies original contact via InboundContact
4. Django forwards to original external number via Twilio

## Twilio Integration

Twilio provides:

- Phone numbers for masking
- SMS forwarding
- Voice call forwarding
- Webhook notifications

**Configuration:** Settings in `privaterelay/settings.py` (Twilio credentials)

**Twilio library:** Uses `twilio` Python library for API interactions

## Management Commands

Utilities in `phones/management/commands/`:

- `delete_phone_data.py` - Deletes user's phone data for re-enrollment

**Note:** Phone-related management commands in `privaterelay/management/commands/`:

- `update_phone_remaining_stats` - Resets monthly phone usage limits
- `sync_phone_related_dates_on_profile` - Syncs phone subscription dates from FxA

## Premium Feature

Phone masking is a **premium feature** requiring active subscription.

- Check subscription status via user Profile
- Enforce usage limits (calls/SMS per month)
- Track remaining usage

## Further Reading

- [../.agents/agents.backend.md](../.agents/agents.backend.md) - General backend guidance
- [Twilio Documentation](https://www.twilio.com/docs)
- `phones/sequence-diagram.svg` - Visual flow diagram
