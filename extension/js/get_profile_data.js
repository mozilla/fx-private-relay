(async function () {
  // Get the api token from the account profile page
  const profileMainElement = document.querySelector("#profile-main");
  const apiToken = profileMainElement.dataset.apiToken;
  browser.storage.local.set({apiToken});

  // Get the relay address objects from the addon storage
  const addonStorageRelayAddresses = await browser.storage.local.get("relayAddresses");
  const addonRelayAddresses = (Object.keys(addonStorageRelayAddresses).length === 0) ? {relayAddresses: []} : addonStorageRelayAddresses;

  // Loop over the addresses on the page
  const relayAddressElements = document.querySelectorAll(".relay-address");
  const relayAddresses = [];
  for (const relayAddressEl of relayAddressElements) {
    // Add the domain note from the addon storage to the page
    const relayAddressId = relayAddressEl.dataset.id;
    const addonRelayAddress = addonRelayAddresses.relayAddresses.filter(address => address.id == relayAddressId)[0];
    const addonRelayAddressDomain = (addonRelayAddress && addonRelayAddress.hasOwnProperty("domain")) ? addonRelayAddress.domain : "";
    relayAddressEl.parentElement.parentElement.querySelector('.relay-email-address-note').textContent = addonRelayAddressDomain

    // Get and store the relay addresses from the account profile page,
    // so they can be used later, even if the API endpoint is down
    const relayAddress = {
      "id": relayAddressEl.dataset.id,
      "address": relayAddressEl.dataset.clipboardText,
      "domain": addonRelayAddressDomain,
    };
    relayAddresses.push(relayAddress);
  }
  browser.storage.local.set({relayAddresses});
})();
