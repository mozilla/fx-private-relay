async function sendRelayEvent(categoryId, eventAction, eventLabel) {
  return await browser.runtime.sendMessage({
    method: "sendMetricsEvent",
    eventData: {
      category: `Extension: ${categoryId}`,
      action: eventAction,
      label: eventLabel,
    },
  });
}
