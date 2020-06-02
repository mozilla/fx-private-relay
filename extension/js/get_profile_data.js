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

    const defaultAliasLabelText = "Add alias label";
    const storedAliasLabel = (addonRelayAddress && addonRelayAddress.hasOwnProperty("domain")) ? addonRelayAddress.domain : defaultAliasLabelText;

    const aliasLabelInput = aliasCard.querySelector('input.relay-email-address-label');
    const aliasLabelWrapper = aliasLabelInput.parentElement;
    aliasLabelWrapper.classList.add("show-label"); // show field only when addon is installed

    aliasLabelInput.dataset.label = storedAliasLabel;
    aliasLabelInput.placeholder = storedAliasLabel;

    if (storedAliasLabel === "" || storedAliasLabel === " ") {
      aliasLabelInput.placeholder = defaultAliasLabelText;
    }

    const forbiddenCharacters = `{}()=;-<>`;
    aliasLabelInput.addEventListener("keydown", (e) => {
      const typedChar = e.key;
      if (aliasLabelInput.classList.contains("input-has-error")) {
        if (typedChar === "Backspace") {
          aliasLabelInput.classList.remove("input-has-error");
          aliasLabelWrapper.classList.remove("show-input-error");
        } else {
          e.preventDefault();
          return;
        }
      }
      if (forbiddenCharacters.includes(typedChar)) {
        aliasLabelInput.classList.add("input-has-error");
        aliasLabelWrapper.querySelector(".forbidden-char").textContent = e.key;
        aliasLabelWrapper.classList.add("show-input-error");
      }
    })

    aliasLabelInput.addEventListener("focusout", () => {
      const newAliasLabel = aliasLabelInput.value;
      if (aliasLabelInput.classList.contains("input-has-error")) {
        return;
      }
      // Don't show saved confirmation message if the label hasn't changed
      if (newAliasLabel === aliasLabelInput.dataset.label) {
        return;
      }

      aliasLabelWrapper.classList.add("show-saved-confirmation");
      const updatedRelayAddress = relayAddresses.filter(address => address.id == aliasId)[0];
      updatedRelayAddress.domain = newAliasLabel;
      browser.storage.local.set({relayAddresses});
      aliasLabelInput.dataset.label = newAliasLabel;
      setTimeout(()=> {
        aliasLabelWrapper.classList.remove("show-saved-confirmation");
      }, 1000);

    });

    // Get and store the relay addresses from the account profile page,
    // so they can be used later, even if the API endpoint is down

    const relayAddress = {
      "id": aliasId,
      "address": aliasCardData.relayAddress,
      "domain": storedAliasLabel,
    };
    relayAddresses.push(relayAddress);
  }
  browser.storage.local.set({relayAddresses});
})();
