_Last updated: May 20 2020_
&nbsp;
&nbsp;

# Firefox Relay Analytics Plan

This is the Analytics plan for Firefox Relay. It documents our use of Google Analytics and what we do with the information we collect.

## Analysis

**Relay uses Google Analytics to collect and organize data. We do this to get a better understanding of what is working, and where we still have work to do.**

**Captured data also helps provide answers to the following questions:**

**Demographic:**

>From which country does the majority of our traffic originate?

>Which browsers are most commonly used to access the Firefox Relay website?

>Which devices are most commonly used to access the Firefox Relay website?

**User Behavior:**

>Do users delete aliases?

>Do users create aliases?

>How do users create aliases? From the Relay website dashboard? The context menu? The input icon?

>Do users open the extension panel?

>Do users change the forwarding settings for their aliases?

>Do users who have not installed the Relay add-on, choose to install the add-on?

&nbsp;

## Extension Event Collection
Events are reported using [Google Analytics Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/v1).

We collect data for the following extension events:

### Panel events:

- When the panel is opened

- A ping describing which panel was viewed (unauthenticated user panel, authenticated user panel, or the "High Five!" panel)

- When outbound links and buttons in the panel are clicked (Join the Waitlist, Leave Feedback, Manage All Aliases)

- When extension settings are changed via the settings panel

- When the settings icon is clicked

- When panel navigation arrow icons are clicked


### In-page events:

- When the Relay icon is injected into an email input

- When the Relay icon is clicked

- When "Generate new alias" is clicked

- When "Manage All Aliases" is clicked

- When the Relay icon is clicked by an unauthenticated user

- When the Relay icon is clicked by a user who has already reached the maximum number of allowed aliases


### Post-install page events:

- When the user clicks an outbound link or button


### Context Menu events:

- When an alias is generated via the context menu


### Modal events:

- When the modal opens

- When the modal is closed

- When "Manage All Aliases" is clicked



&nbsp;

## Website Event Collection

Events are reported using [Google Analytics](https://developers.google.com/analytics/devguides/collection/analyticsjs).

We collect data for the following events:

- When the page loads (or reloads)

- When a user creates an alias

- When a user deletes an alias

- When a user clicks the delete alias icon and is presented with the Confirm/Delete tooltip

- When a user clicks Cancel in the Confirm/Delete Alias tooltip

- When a user clicks Confirm in the Confirm/Delete Alias tooltip

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


### Firefox Apps menu (referred to internally as the Bento menu)

- When a user opens the Firefox Apps menu
  * `hitType` : event
  * `eventCategory` : bento
  * `eventAction` : bento-opened
  * `eventLabel` : fx-monitor

- When a user closes the Firefox Apps menu
  * `hitType` : event
  * `eventCategory` : bento
  * `eventAction` : bento-closed
  * `eventLabel` : fx-monitor

- When a user clicks on one of the Firefox Apps menu links
  * `hitType` : event
  * `eventCategory` : bento
  * `eventAction` : bento-app-link-click
  * `eventLabel` : link identifier


## Opt Out of Google Analytics Tracking

**Firefox Relay detects and respects user privacy and honors DNT headers.**

Before initializing Google Analytics, we check the user's browser settings for a **DNT** signal. If the **DNT** header is enabled, Analytics is never initialized and is not used to collect data for that session.

>[How Firefox Relay detects and respects DNT.](https://github.com/schalkneethling/dnt-helper)

>[How do I turn on the Do Not Track feature?](https://support.mozilla.org/en-US/kb/how-do-i-turn-do-not-track-feature)
