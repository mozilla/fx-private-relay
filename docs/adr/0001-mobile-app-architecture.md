# Build Relay Mobile App with [Mobile Web | Qt | React Native | WebView ]

- Status: proposed
- Deciders: Luke Crouch, Emmett Lynch, Maxx Crawford
- Date: pending

Technical Spike:

- [MPP-2717](https://mozilla-hub.atlassian.net/browse/MPP-2717)
- [MPP-2704](https://mozilla-hub.atlassian.net/browse/MPP-2704)

## Context and Problem Statement

Make it just as easy to use your Firefox Relay phone number as your real phone number.
See Google Voice as an example.
[Firefox Relay Mobile Problems doc](https://docs.google.com/document/d/14wYnem-oPPA4_tjp018U3SyHpcdyKodDBbreRBkDd24/edit)

## Decision Drivers

- We are concerned that the Relay Phone experience is causing churn.

## Considered Options

- 2 mobile apps in Swift (iOS) and Kotlin (Android)
- Re-use C++/Qt code-base from VPN
- Mobile Web
- React Native
- React Native WebView

## Decision Outcome

Chosen option: "[option 1]", because [justification. e.g., only option, which meets k.o. criterion decision driver | which resolves force force | … | comes out best (see below)].

### Positive Consequences <!-- optional -->

- [e.g., improvement of quality attribute satisfaction, follow-up decisions required, …]
- …

### Negative Consequences <!-- optional -->

- [e.g., compromising quality attribute, follow-up decisions required, …]
- …

## Pros and Cons of the Options <!-- optional -->

### 2 mobile apps in Swift (iOS) and Kotlin (Android)

Build and maintain 2 distinct code-bases and repos.
Example: [Signal](https://github.com/signalapp/)

- ❇️ Good, because the apps are in the app stores.
- ❇️ Good, because each platform can have the "purest" experience possible.
- ❇️ Good, because devs will build with languages and tooling that are optimized for each
  platform.
- ⛔️ Bad, because we have to maintain 2 separate code-bases.
- ⛔️ Bad, because we have to train ENGRs on 2 new tech stacks.
- ⛔️ Bad, because each code-base needs at least 2 ENGRs for it; likely we need to dedicate
  4 ENGRs.
- ⛔️ Bad, because we have to build 2 new release pipelines.

### Re-use C++/Qt code-base from VPN

Re-use the VPN C++/Qt code-base and build the code into "Relay mode" to make a Relay
app.
Example: [Mozilla VPN](https://github.com/mozilla-mobile/mozilla-vpn-client)

- ❇️ Good, because the apps are in the app stores.
- ❇️ Good, because it leverages existing mobile app and release pipeline.
- ❇️ Good, because it's a single code-base for both iOS and Android.
- ⚠️ Bad, because we have to train ENGRs on new tech stack.
- ⚠️ Bad, because the C++/Qt code-base needs significant work to do this.

### Mobile Web

Deliver Relay Phone app UX via a mobile website.
Example: https://voice.google.com

- ❇️ Good, because it leverages existing web app and release pipeline.
- ❇️ Good, because it's a single code-base for both iOS and Android.
- ❇️ Good, because ENGRs already know the tech stack.
- ⚠️ Bad, because the Relay phone app isn't in the app stores.

### React Native

Build a React Native app.
Example: [Joplin](https://github.com/laurent22/joplin/tree/dev/packages/app-mobile)
Example: [Relay prototype](https://github.com/codemist/fx-private-relay-mobile-app)

- ❇️ Good, because the apps are in the app stores.
- ❇️ Good, because it's a single code-base for both iOS and Android.
- ⚠️ Bad, because ENGRs need to learn a new tech stack.
- ⚠️ Bad, because we have to build a new release pipeline.

### React Native WebView

Build a React Native app that uses a `WebView` to embed the mobile app.
Example: [Relay prototype](https://github.com/Vinnl/fx-private-relay-webapp-wrapper/)

- ❇️ Good, because the apps are in the app stores.
- ❇️ Good, because it's a single code-base for both iOS and Android.
- ❇️ Good, because it's probably the quickest-to-market option.
- ❇️⚠️ Good-ish, because ENGRs know more of the tech stack.
- ❇️⚠️ Good-ish, because it mostly leverages existing web app and release pipeline.

## Links <!-- optional -->

- [Link type] [Link to ADR] <!-- example: Refined by [ADR-0005](0005-example.md) -->
- … <!-- numbers of links can vary -->
