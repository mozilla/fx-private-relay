<!-- ADR template, source: https://github.com/adr/madr -->

# Decouple welcome email from new user flow

- Status: Proposed
- Deciders: Luke Crouch, Tony Cinotto
- Date: 2023-09-05

Technical Story: [MPP-3328](https://mozilla-hub.atlassian.net/browse/MPP-3328)

## Context and Problem Statement

To reduce the response time from when the user interacts with the UI on Firefox for [MPP-3257](https://mozilla-hub.atlassian.net/browse/MPP-3257),
Relay added a welcome email for new users that gets processed via `send_first_email` receiver that looks for the `user_signed_up` signal. For Phase 2 of Relay integration to Firefox, we added a `/api/v1/terms-accepted-user/` endpoint to create new users with the [resource flow](OAUTH_RESOURCE_SERVER) instead of relying party flow. A typical response from POST request to `/api/v1/terms-accepted-user/`` ranges from 1000-1200ms. The response with the welcome email processing removed is 700-900ms. The maximum time saved from separating the welcome email could be as high as 300ms. Meanwhile we need to ensure that a new user who joins Relay gets welcome email.

To improve response time for `/api/v1/terms-accepted-user/` and provide reliable welcome email to new users joining Relay, how should the welcome email be processed?

[OAUTH_RESOURCE_SERVER]: https://www.oauth.com/oauth2-servers/the-resource-server/

## Decision Drivers

- Reduce response time for `/api/v1/terms-accepted-user/`
- Send welcome emails to new Relay users
- Quickest implementation

## Considered Options

1. Implement [Redis Queue](REDIS_QUEUE) to send welcome email
2. Utilize [Basket API](BASKET) to send welcome email
3. Implement cron job to send welcome email

## Decision Outcome

Proceeded with **Option 3. Implement cron job to send welcome email** because it had the quickest implementation and possibility for reuse for Option 1. Implemented on PR [#3750](https://github.com/mozilla/fx-private-relay/pull/3750).

### Positive Consequences

- Welcome email is sent more reliably
- Faster new user created on both the normal Relay flow and the Firefox Integration flow

### Negative Consequences

- Potential longer welcome email processing time for new users if Relay suddenly gets too many new users.

## Pros and Cons of the Options

### Option 1: Implement Redis Queue to send welcome email

[Redis Queue](REDIS_QUEUE) would be a new addition to our infrastructure but can be used to more quickly send the welcome email for new users who join Relay.

- Good, because it reduces the overhead of signal/receiver and delay in responding to Firefox during the `/api/v1/terms-accepted-user` endpoint call.
- Good, because marketing team has worked on converting their service, Basket, to using this so we could reuse some setup. Example code snippet using the `@rq_task` decorator [here](https://github.com/mozmeao/basket/blob/main/basket/news/tasks.py) and the command for running the workers [here](https://github.com/mozmeao/basket/blob/main/basket/base/management/commands/rqworker.py).
- Bad, because [Redis persistence](https://redis.io/docs/management/persistence/) adjacent problems which require infrastructure work.

### Option 2: Utilize Basket API to send welcome email

[Basket API](BASKET), Mozilla's newsletter service for the marketing team, would be a reuse and expansion of Relay's marketing email for users signed up for premium email, phone, and bundle waitlist. Basket handles both transactional and marketing emails. Examples of transactional email is processing primary email address change (transaction) which results in email about the address update. Examples of marketing emails is sending a user about premium subscription being available in their region.

- Good, because Relay has used Basket for waitlists before and this expands on the existing use of Basket.
- Good, because it is less complex since the problem is handled external to Relay--less code and no new infrastracture needed in Relay to support Option 1.
- Bad, because Basket is mainly used for marketing purposes and it currently does not have a way to distinguish between transactional and marketing emails.
- Bad, because it is recommended that the services own their transactional emails.

### Option 3: Implement cron job to send welcome email

Relay already has [many scheduled jobs](https://dashboard.heroku.com/apps/fx-private-relay/scheduler) setup to handle asynchronous work ranging from maintainig old data to renewing monthly phone limits for users.

- Good, because code created to send welcome email can be reused if or when we move to Option 1 using Redis Queue
- Good, because lowest implementation complexity due to previous use of scheduled jobs
- Bad, because unlike Redis Queue where more workers can be added to deal with the thundering herd problem, current cron job infrastructure uses set resources.

## Links

[BASKET]: https://basket.readthedocs.io/

- See [Basket PR 1069](https://github.com/mozmeao/basket/pull/1069) for transitioning tasks to use rq
  [REDIS_QUEUE]: https://python-rq.org/
- For more reliable Redis queue processesing consider [Redis persistence](https://redis.io/docs/management/persistence/)
