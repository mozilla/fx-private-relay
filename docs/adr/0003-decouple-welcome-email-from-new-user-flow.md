<!-- ADR template, source: https://github.com/adr/madr -->

# Decouple welcome email from new user flow

- Status: Proposed
- Deciders: Luke Crouch, Tony Cinotto
- Date: 2023-09-05

Technical Story: [MPP-3328](https://mozilla-hub.atlassian.net/browse/MPP-3328)

## Context and Problem Statement

Relay sends a welcome email for new users. The `send_first_email` function in privaterelay/signals.py handles the allauth `user_signed_up` signal. `send_first_email` makes request to AWS SES API before Relay responds to clients. This adds as much as 300ms to the Relay API response time during new user creation which slows down the Firefox Relay Phase 2 integration UI. See [MPP-3257](https://mozilla-hub.atlassian.net/browse/MPP-3257) for more details.

This ADR explores options to reduce new user creation response time by separating the send the welcome email.

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

- A sudden spike of new users could delay welcome emails.

## Pros and Cons of the Options

### Option 1: Implement Redis Queue to send welcome email

[Redis Queue](REDIS_QUEUE) would be Relay's first attempt at using Redis worker outside of the Redis session and backend cache with [django-redis](https://pypi.org/project/django-redis/) but can be used to more quickly send the welcome email for new users who join Relay.

- Good, because users can immediately receive welcome email.
- Good, because Relay team can share knowledge and practice with other Mozilla teams that use Redis queue.
- Bad, because [Redis persistence](https://redis.io/docs/management/persistence/) adjacent problems which require infrastructure work.

### Option 2: Utilize Basket API to send welcome email

[Basket API](BASKET), Mozilla's newsletter service for the marketing team, would be a reuse and expansion of Relay's marketing email for users signed up for premium email, phone, and bundle waitlist. Basket handles both transactional and marketing emails. Examples of transactional email is processing primary email address change (transaction) which results in email about the address update. Examples of marketing emails is sending a user about premium subscription being available in their region.

- Good, because Relay has used Basket for waitlists before and this expands on the existing use of Basket.
- Good, because Relay does not increase in complexity since the problem is handled external to Relay.
- Bad, because Basket is mainly used for marketing purposes and it currently does not have a way to distinguish between transactional and marketing emails.
- Bad, because general recommendation is that the services own their transactional emails.

### Option 3: Implement cron job to send welcome email

Relay already has [many scheduled jobs](https://dashboard.heroku.com/apps/fx-private-relay/scheduler) setup to handle asynchronous work ranging from maintainig old data to renewing monthly phone limits for users.

- Good, because Relay can reuse code to send welcome email if or when we move to Option 1 using Redis Queue.
- Good, because this option is inline with how we used scheduled jobs and is the lowest complexity to implement.
- Bad, because unlike Redis Queue where more workers can be added to deal with the thundering herd problem, current cron job infrastructure uses set resources.

## Links

- See [Basket PR 1069](https://github.com/mozmeao/basket/pull/1069) for transitioning tasks to use rq
  - Example use of `@rq_task` decorator [here](https://github.com/mozmeao/basket/blob/main/basket/news/tasks.py) to convert code to task.
  - The command for running the workers [here](https://github.com/mozmeao/basket/blob/main/basket/base/management/commands/rqworker.py).
- For more reliable Redis queue processesing consider [Redis persistence](https://redis.io/docs/management/persistence/)

[BASKET]: https://basket.readthedocs.io/
[REDIS_QUEUE]: https://python-rq.org/
