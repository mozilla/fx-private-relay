"use strict";

/* exported sendRelayEvent */

// eslint-disable-next-line no-redeclare
async function sendRelayEvent(eventCategory, eventAction, eventLabel) {
  return await browser.runtime.sendMessage({
    method: "sendMetricsEvent",
    eventData: {
      category: `Extension: ${eventCategory}`,
      action: eventAction,
      label: eventLabel,
    },
  });
}
