_Last updated: May 20 2020_

# Firefox Private Relay Analytics Plan

This is the Analytics plan for Firefox Private Relay. It documents our use of Google Analytics and what we do with the information we collect.

## Analysis

**Private Relay uses Google Analytics to collect and organize data. We do this to get a better understanding of what is working, and where we still have work to do.**

**Captured data also helps provide answers to the following questions:**

**Demographic:**

>From which country does the majority of our traffic originate?

>Which browsers are most commonly used to access the Firefox Private Relay website?

>Which devices are most commonly used to access the Firefox Private Relay website?

**User Behavior:**

>Do users delete aliases?

>Do users create aliases?

>Do users change the forwarding settings for their aliases?

>Do users who have not installed the Private Relay add-on, choose to install the add-on?

>Do users who have not received invitations to the beta choose to join the beta waitlist?


## Collection

Events are reported using the [Google Analytics Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/v1/).

We collect data for the following events:

- When the page loads (or reloads)

- When a user creates an alias

- When a user deletes an alias

- When a user clicks the delete alias icon and is presented with the Confirm/Delete tooltip.

- When a user Cancel in the Confirm/Delete Alias tooltip

- When a user click Confirm in the Confirm/Delete Alias tooltip

- When a user changes the forwarding settings for an alias


### Sign Up Buttons & Links

**`Sign In Button`** -&nbsp;  **`Add to Firefox Button`**  &nbsp; **`Join the Waitlist Button`**  &nbsp;

- When a button appears on the page
  * `hitType` : event
  * `eventCategory` : Button ID
  * `eventAction` : View
  * `eventLabel` : Page location ID.

- When a user clicks a link or button.
  * `hitType` : event
  * `eventCategory` : Button or Link ID
  * `eventAction` : Engage
  * `eventLabel` : Page location ID.


### Bento

- When a user opens the Bento menu
  * `hitType` : event
  * `eventCategory` : bento
  * `eventAction` : bento-opened
  * `eventLabel` : fx-monitor

- When a user closes the Bento menu
  * `hitType` : event
  * `eventCategory` : bento
  * `eventAction` : bento-closed
  * `eventLabel` : fx-monitor

- When a user clicks on one of the Bento menu links
  * `hitType` : event
  * `eventCategory` : bento
  * `eventAction` : bento-app-link-click
  * `eventLabel` : link identifier


## Opt Out of Google Analytics Tracking

**Firefox Private Relay detects and respects user privacy and honors DNT headers.**

Before initializing Google Analytics, we check the user's browser settings for a **DNT** signal. If the **DNT** header is enabled, Analytics is never initialized and is not used to collect data for that session.

>[How Firefox Private Relay detects and respects DNT.](https://github.com/schalkneethling/dnt-helper)

>[How do I turn on the Do Not Track feature?](https://support.mozilla.org/en-US/kb/how-do-i-turn-do-not-track-feature)
