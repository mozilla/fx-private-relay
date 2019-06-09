(async function () {
  // Get the relay addresses from the page and store them into browser.storage.local
  const relayAddressLinks = document.querySelectorAll("li");
  const relayAddresses = [];
  for (const relayAddressLink of relayAddressLinks) {
    relayAddresses.push(relayAddressLink.textContent);
  }
  await browser.storage.local.set({relayAddresses});
})();
