(async function () {
  // Get the relay addresses from the page and store them into browser.storage.local
  const relayAddressCopyButtons = document.querySelectorAll("button.js-copy");
  const relayAddresses = [];
  for (const relayAddressCopyButton of relayAddressCopyButtons) {
    relayAddresses.push(relayAddressCopyButton.dataset.clipboardText);
  }
  chrome.storage.local.set({relayAddresses}, () => {
    console.log("Set the relayAddresses.");
  });
})();
