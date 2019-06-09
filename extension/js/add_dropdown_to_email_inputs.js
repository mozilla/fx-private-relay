(async function() {
  // Get relay addresses from local storage and create <datalist> element
  const {relayAddresses} = await browser.storage.local.get("relayAddresses");
  const relayAddressesDatalist = document.createElement("datalist");
  relayAddressesDatalist.setAttribute("id", "relay-addresses");
  for (const relayAddress of relayAddresses) {
    const relayAddressesDatalistOption = document.createElement("option");
    relayAddressesDatalistOption.setAttribute("value", relayAddress);
    relayAddressesDatalist.appendChild(relayAddressesDatalistOption);
  }
  document.body.appendChild(relayAddressesDatalist);

  // set the "list" attribute of all email inputs to "relay-addresses"
  const emailInputs = document.querySelectorAll("input[type='email']");
  for (const emailInput of emailInputs) {
    emailInput.setAttribute("list", "relay-addresses");
  }
})();
