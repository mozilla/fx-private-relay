_Last updated: March 24 2022_
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

>Which browser is running the Firefox Relay the add-on?  

**User Behavior:**

>Do users delete aliases?

>Do users create aliases?

>How do users create aliases? From the Relay website dashboard? The context menu? The input icon?

>Do users open the extension panel?

>Do users change the forwarding settings for their aliases?

>Do users who have not installed the Relay add-on, choose to install the add-on?

>When do users decide to upgrade to Premium?

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

**`Sign In Button`** -&nbsp;  **`Add to Firefox Button`**  -&nbsp; **`Join the Waitlist Button`**

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

### Interview recruitment

(This is only shown occasionally, when we're trying to recruit people to join in user research.)

- When the recruitment link appears on the page
  * `hitType` : event
  * `eventCategory` : Recruitment
  * `eventAction` : View
  * `eventLabel` : Recruitment text

- When the recruitment link is clicked
  * `hitType` : event
  * `eventCategory` : Recruitment
  * `eventAction` : Engage
  * `eventLabel` : Recruitment text

### Net Promoter Score (NPS)/Customer Satisfaction (CSAT) surveys

- When a CSAT survey answer is selected
  * `hitType` : event
  * `eventCategory` : CSAT Survey
  * `eventAction` : submitted
  * `eventLabel` : The given answer
  * `value` : A numeric value representing the given answer
  * `dimension3` : Whether the given answer represents satisfaction, neutral feeling, or dissatisfaction.
  * `dimension4` : The given answer
  * `metric10` : Always "1" (to count the number of answers)
  * `metric11` : A numeric value representing `dimension4`
  * `metric12` : A numeric value representing `dimension3`

- When an NPS survey answer is selected
  * `hitType` : event
  * `eventCategory` : NPS Survey
  * `eventAction` : submitted
  * `eventLabel` : A label for the category of the given answer
  * `value` : A numeric value representing the given answer
  * `dimension1` : A label for the category of the given answer
  * `metric10` : Always "1" (to count the number of answers)
  * `metric11` : The given answer
  * `metric12` : A numeric value representing the category of the given answer

### Banners

- When a user clicks the link in one of the banners
  * `hitType` : event
  * `eventCategory` : Outbound
  * `eventAction` : Click
  * `eventLabel` : link content

### Links to upgrade to Premium

- When the link appears on the page
  * `hitType` : event
  * `eventCategory` : Purchase Button
  * `eventAction` : View
  * `eventLabel` : link identifier

- When a user clicks the link
  * `hitType` : event
  * `eventCategory` : Purchase Button
  * `eventAction` : Engage
  * `eventLabel` : link identifier

### The onboarding flow for new Premium subscribers

- When a button/link to continue to the next step scrolls into view
  * `hitType` : event
  * `eventCategory` : Premium Onboarding
  * `eventAction` : View
  * `eventLabel` : link identifier

- When a user clicks a button/link to continue to the next step
  * `hitType` : event
  * `eventCategory` : Premium Onboarding
  * `eventAction` : Engage
  * `eventLabel` : link identifier

## Opt Out of Google Analytics Tracking

**Firefox Relay detects and respects user privacy and honors DNT headers.**

Before initializing Google Analytics, we check the user's browser settings for a **DNT** signal. If the **DNT** header is enabled, Analytics is never initialized and is not used to collect data for that session.

>[How do I turn on the Do Not Track feature?](https://support.mozilla.org/en-US/kb/how-do-i-turn-do-not-track-feature)
