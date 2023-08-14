# Use the Relay mask address as From: address for forwarded emails

- Status: Proposed
- Deciders: Luke Crouch, Doris Deng
- Date: 2023-08-11

Technical Story: [MPP-2117](https://mozilla-hub.atlassian.net/browse/MPP-2117)

## Context and Problem Statement

A Relay user provides an email mask to a service instead of their real address.
When that service sends an email to the mask address, it is forwarded to the
user's real address. When a Relay user replies to a forwarded email (a feature
of a premium subscription), it is sent to Relay's reply address
(`replies@relay.firefox.com`), and then forwarded to the service as if it came
from the email mask.

The user's email client reads the email headers to decide how to handle the
email, such as delivering to the inbox, to a spam folder, or to another folder.
It also chooses if the new email is part of an existing conversation. Many
mail clients primarily use the `From:` header to make this decision.

Currently, Relay's reply address is used for the `From:` header and the
`Reply-To` header. This makes it challenging for the user's email client to
distinguish between forwarded emails from different senders and services. This
ADR proposes changing the `From:` address to allow richer client processing of
forwarded emails.

## Decision Drivers

- Forwarded emails should be delivered to users, unless they have blocked them
  in the Relay dashboard.
- Legitimate forwarded emails should not be marked as spam.
- Users want to distinguish between services. Our ideal user has many email
  masks, and uses one per service.

## Considered Options

1. Keep the Relay reply address as the `From:` address
2. Use the service's sender address as the `From:` address
3. Use the Relay mask as the `From:` address
4. Use the Relay mask plus derived prefix as the `From:` address

## Decision Outcome

Proceeding with testing and deployment of option 3, use the Relay mask as the
`From:` address. Testing will focus on delivery issues, and quantifying the
risk of categorization as spam.

### Positive Consequences

Two frequent customer experience issues are fixed:

- Gmail is able to create targeted filter rules based on the mask address.
- Proton Mail groups messages from a mask address, rather than grouping all
  Relay messages together.

### Negative Consequences

- For one tested service, changing the `From:` address caused the email to be
  delivered to spam
- Filter rules for the current `From:` address will be broken by this change.

## Pros and Cons of the Options

### Option 1: Keep the Relay Reply Address as the `From:` address

If the sender's email headers are:

```
Subject: A special offer for you
From: "Your friends at service X" <offers@servicex.example.com>
To: r4nd0m@mozmail.com
```

Relay forwards with:

```
Subject: A special offer for you
From: "offers@servicex.example.com [via Relay]" replies@relay.firefox.com
To: users-real-email@mail.example.com
Reply-To: replies@relay.firefox.com
```

- Good, because the sender's email is visible in the mail client (the "display name").
- Bad, because all Relay emails come from the same address, reducing the information
  for filtering and processing.
- Bad, because Proton Mail groups all Relay emails together when in conversation mode.

### Option 2: Use the Service's Sender Address as the `From:` Address

If the sender's email headers are:

```
Subject: A special offer for you
From: "Your friends at service X" <offers@servicex.example.com>
To: r4nd0m@mozmail.com
```

Relay forwards with:

```
Subject: A special offer for you
From: "offers@servicex.example.com [via Relay]" offers@servicex.example.com
To: users-real-email@mail.example.com
Reply-To: replies@relay.firefox.com
Resent-From: r4nd0m@mozmail.com
Resent-Sender: replies@relay.firefox.com
```

This format was inspired by the
[ReSender example](https://datatracker.ietf.org/doc/html/rfc5598#section-5.2) from
[RFC 5598: Internet Mail Architecture](https://datatracker.ietf.org/doc/html/rfc5598).
It used standards-based headers to make it clear who sent the message and who
resent it.

- Good, because the sender's email address is available for filtering.
- Bad, because [DKIM](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail)
  verification caused messages to be marked as spam or dropped entirely.

### Option 3: Use the Relay Mask as the `From:` Address

If the sender's email headers are:

```
Subject: A special offer for you
From: "Your friends at service X" <offers@servicex.example.com>
To: r4nd0m@mozmail.com
```

Relay forwards with:

```
Subject: A special offer for you
From: "offers@servicex.example.com [via Relay]" r4nd0m@mozmail.com
To: users-real-email@mail.example.com
Reply-To: replies@relay.firefox.com
Resent-From: offers@servicex.example.com
```

- Good, because the original sender is visible in the display name.
- Good, because the email mask is available for filtering.
- Good, because Proton Mail organizes by mask in conversation mode.
- Good, because it rewards usage of a mask on a single service, which is better
  for user privacy.
- Bad, because of a small increased probability of delivery to spam, due to the
  reputation of `mozmail.com` versus `firefox.com`.

In QA testing in August 2023, over 100 services had no delivery
change with the new `From:` address. For one service, the email went
to spam instead of the inbox.

### Option 4: Use the Relay Mask Plus Derived Prefix as the `From:` Address

If the sender's email headers are:

```
Subject: A special offer for you
From: "Your friends at service X" <offers@servicex.example.com>
To: r4nd0m@mozmail.com
```

Relay forwards with:

```
Subject: A special offer for you
From: "offers@servicex.example.com [via Relay]" r4nd0m+offers_at_servicex.example.com@mozmail.com
To: users-real-email@mail.example.com
Reply-To: replies@relay.firefox.com
Resent-From: offers@servicex.example.com
```

- Good, because the original sender is visible in the display name.
- Good, because the email mask plus original email is available for filtering.
- Good, because Proton Mail organizes by mask in conversation mode.
- Bad, because of a small increased probability of delivery to spam, due to the
  reputation of `mozmail.com` versus `firefox.com`.
- Bad, because it encourages reuse of masks, which is worse for user privacy.

## Links

- [RFC 5598: Internet Mail Architecture](https://datatracker.ietf.org/doc/html/rfc5598) -
  An informational document describing the actors in transmitting Internet Mail.
  - [5. Mediators](https://datatracker.ietf.org/doc/html/rfc5598#section-5) -
    Examples of forwarding a message via re-posting, which describes the Relay
    service
  - [5.2. ReSender](https://datatracker.ietf.org/doc/html/rfc5598#section-5.2) -
    A Mediator pattern that allows follow-on direct communication, inspiring option 2.
- [DomainKeys Identified Mail](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail) -
  An overview of DKIM, which prevented option 2 from being adopted.
- Related issues:
  - [Issue 532: Sender's email](https://github.com/mozilla/fx-private-relay/issues/532) -
    An early complaint (July 2020) about the sender `noreply@relay.firefox.com`. This
    address was used before replies were implemented, and for free users until 2023.
  - [Issue 690: Find a different way to display actual From](https://github.com/mozilla/fx-private-relay/issues/690) -
    Identifies issues with [Proton Mail](https://proton.me/mail) removing the
    sender's address from the display name portion of the `From:` address, filed in
  - [Issue 1492: Emails by Relay group into single conversation on Proton Mail](https://github.com/mozilla/fx-private-relay/issues/1492) -
    Customer support reported this user issue in January 2022
