(async function () {
  // Get the api token from the account profile page
  const profileMainElement = document.querySelector("#profile-main");
  const apiToken = profileMainElement.dataset.apiToken;
  browser.storage.local.set({apiToken});

  // Get the relay address objects from the addon storage
  const addonStorageRelayAddresses = await browser.storage.local.get("relayAddresses");
  const addonRelayAddresses = (Object.keys(addonStorageRelayAddresses).length === 0) ? {relayAddresses: []} : addonStorageRelayAddresses;

  // Loop over the addresses on the page
  const dashboardRelayAliasCards = document.querySelectorAll("[data-relay-address]");
  const relayAddresses = [];

  for (const aliasCard of dashboardRelayAliasCards) {
    // Add the domain note from the addon storage to the page
    const aliasCardData = aliasCard.dataset;
    const aliasId = aliasCardData.relayAddressId;
    const addonRelayAddress = addonRelayAddresses.relayAddresses.filter(address => address.id == aliasId)[0];


    const aliasLabel = (addonRelayAddress && addonRelayAddress.hasOwnProperty("domain")) ? addonRelayAddress.domain : "";
    const aliasLabelElem = aliasCard.querySelector('.relay-email-address-note');
    aliasLabelElem.textContent = aliasLabel;

    // Get and store the relay addresses from the account profile page,
    // so they can be used later, even if the API endpoint is down

    const relayAddress = {
      "id": aliasId,
      "address": aliasCardData.relayAddress,
      "domain": aliasLabel,
    };
    relayAddresses.push(relayAddress);
  }
  browser.storage.local.set({relayAddresses});
})();
