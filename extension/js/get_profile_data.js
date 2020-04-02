(async function () {
  // Get the api token from the account profile page
  const profileMainElement = document.querySelector("#profile-main");
  const apiToken = profileMainElement.dataset.apiToken;
  chrome.storage.local.set({apiToken}, () => {
    console.log("Set the API token.");
  });

  // Hide the "Get Private Relay" button because the user already has it
  document.querySelector("#download-addon").remove();

  // Get and store the relay addresses from the account profile page,
  // so they can be used later, even if the API endpoint is down
  const relayAddressElements = document.querySelectorAll(".relay-address");
  const relayAddresses = [];
  for (const relayAddressEl of relayAddressElements) {
    relayAddresses.push(relayAddressEl.dataset.clipboardText);
  }
  chrome.storage.local.set({relayAddresses}, () => {
    console.log("Set the relayAddresses.");
  });
})();
