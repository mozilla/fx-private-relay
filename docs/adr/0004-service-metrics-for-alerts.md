# Service metrics to trigger alerts

- Status: Proposed
- Deciders: Emmett Lynch, Luke Crouch
- Date: 2023-11-02

Technical Story: [MPP-3488](https://mozilla-hub.atlassian.net/browse/MPP-3488)

## Context and Problem Statement

Successful Relay service operation depends on a number of disparate systems:

- Web app
- FXA
- Add-on
- Firefox code
  - Including Nimbus
- Amazon SES
- Twilio

To receive alerts when Relay is not operating at an acceptable service level, we must:

1. Define which service metrics to track
2. Define acceptable values for those metrics
3. Decide how to alert ENGRs when service metrics are at unacceptable values

## Decision Drivers

- Relay incidents are not detected until end users report degraded service experience
- Improve the status quo and make plan for future improvements too

## Considered Options

Note: These are not mutually exclusive. We're considering which option to do first and
starting our plan for the future.

- Formalize and improve status quo
- Semi-automated
- Automated

## Decision Outcome

Chosen option: "[option 1]", because [justification. e.g., only option, which meets k.o. criterion decision driver | which resolves force force | … | comes out best (see below)].

### Positive Consequences <!-- optional -->

- [e.g., improvement of quality attribute satisfaction, follow-up decisions required, …]
- …

### Negative Consequences <!-- optional -->

- [e.g., compromising quality attribute, follow-up decisions required, …]
- …

## Pros and Cons of the Options <!-- optional -->

### Formalize and improve status quo

Before we automate an alert process, we will formalize and improve the status quo.

#### Status quo

Relay ENGR are "alerted" to service issues by a few channels:

- (Manual) Post-release checks as described in the [Release ENGR
  playbook](https://github.com/mozilla/fx-private-relay/blob/main/docs/release-engineer-playbook.md).
- (Automated) Sentry and PagerDuty alerts in [#relay-alerts](https://mozilla.slack.com/archives/C02N3PHRL8P)
- (Manual) Pings in Slack channels (from most detailed to most broad):
  - CX-reported issues in [#privsec-customer-experience channel](https://mozilla.slack.com/archives/C024F598S75).
  - QA-reported issues in [#fx-private-relay-eng](https://mozilla.slack.com/archives/C013CSYEL5T)
    and [#relay-team](https://mozilla.slack.com/archives/G01CAHTUJ9L)

[example | description | pointer to more information | …] <!-- optional -->

- Good, because [argument a]
- Good, because [argument b]
- Bad, because [argument c]
- … <!-- numbers of pros and cons can vary -->

### [option 2]

[example | description | pointer to more information | …] <!-- optional -->

- Good, because [argument a]
- Good, because [argument b]
- Bad, because [argument c]
- … <!-- numbers of pros and cons can vary -->

### [option 3]

[example | description | pointer to more information | …] <!-- optional -->

- Good, because [argument a]
- Good, because [argument b]
- Bad, because [argument c]
- … <!-- numbers of pros and cons can vary -->

## Links <!-- optional -->

- [Link type] [Link to ADR] <!-- example: Refined by [ADR-0005](0005-example.md) -->
- … <!-- numbers of links can vary -->
