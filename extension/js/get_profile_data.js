(async function () {
  const newestVersionOfDashboard = document.querySelector(".dashboard-greeting") !== null;
  if (!newestVersionOfDashboard) {
    return handlePreviousProfilePages();
  }
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
    const storedAliasLabel = (addonRelayAddress && addonRelayAddress.hasOwnProperty("domain")) ? addonRelayAddress.domain : "";

    const aliasLabelInput = aliasCard.querySelector('input.relay-email-address-label');
    const aliasLabelWrapper = aliasLabelInput.parentElement;
    aliasLabelWrapper.classList.add("show-label"); // Field is visible only to users who have the addon installed

    aliasLabelInput.dataset.label = storedAliasLabel;

    if (storedAliasLabel !== "") {
      aliasLabelInput.value = storedAliasLabel;
      aliasLabelWrapper.classList.add("user-created-label");
    } else {
      aliasLabelInput.placeholder = defaultAliasLabelText;
    }

    const forbiddenCharacters = `{}()=;-<>'"`;
    aliasLabelInput.addEventListener("keydown", (e) => {
      const typedChar = e.key;
      if (aliasLabelInput.classList.contains("input-has-error")) {
        if (typedChar !== "Backspace") {
          e.preventDefault();
          return;
        }
        aliasLabelInput.classList.remove("input-has-error");
        aliasLabelWrapper.classList.remove("show-input-error");
      }
      if (forbiddenCharacters.includes(typedChar)) {
        aliasLabelInput.classList.add("input-has-error");
        aliasLabelWrapper.querySelector(".forbidden-char").textContent = e.key;
        aliasLabelWrapper.classList.add("show-input-error");
      }
    })

    aliasLabelInput.addEventListener("focusout", () => {
      const newAliasLabel = aliasLabelInput.value;

      // Don't save labels containing forbidden characters
      if (aliasLabelInput.classList.contains("input-has-error")) {
        return;
      }

      // Don't show saved confirmation message if the label hasn't changed
      if (newAliasLabel === aliasLabelInput.dataset.label) {
        return;
      }

      // Save new alias label
      const updatedRelayAddress = relayAddresses.filter(address => address.id == aliasId)[0];
      updatedRelayAddress.domain = newAliasLabel;
      browser.storage.local.set({relayAddresses});

      // show placeholder text if the label is blank
      if (aliasLabelInput.value === "") {
        aliasLabelWrapper.classList.remove("user-created-label");
        aliasLabelInput.placeholder = defaultAliasLabelText;
      } else {
        aliasLabelWrapper.classList.add("user-created-label");
        aliasLabelWrapper.classList.add("show-saved-confirmation");
      }

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


async function handlePreviousProfilePages() {
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
    const storedAliasLabel = (addonRelayAddress && addonRelayAddress.hasOwnProperty("domain")) ? addonRelayAddress.domain : "";

    const aliasLabelInput = aliasCard.querySelector('input.relay-email-address-label');
    const aliasLabelWrapper = aliasLabelInput.parentElement;
    aliasLabelWrapper.classList.add("show-label"); // Field is visible only to users who have the addon installed

    aliasLabelInput.dataset.label = storedAliasLabel;

    if (storedAliasLabel !== "") {
      aliasLabelInput.value = storedAliasLabel;
      aliasLabelWrapper.classList.add("user-created-label");
    } else {
      aliasLabelInput.placeholder = defaultAliasLabelText;
    }

    const forbiddenCharacters = `{}()=;-<>'"`;
    aliasLabelInput.addEventListener("keydown", (e) => {
      const typedChar = e.key;
      if (aliasLabelInput.classList.contains("input-has-error")) {
        if (typedChar !== "Backspace") {
          e.preventDefault();
          return;
        }
        aliasLabelInput.classList.remove("input-has-error");
        aliasLabelWrapper.classList.remove("show-input-error");
      }
      if (forbiddenCharacters.includes(typedChar)) {
        aliasLabelInput.classList.add("input-has-error");
        aliasLabelWrapper.querySelector(".forbidden-char").textContent = e.key;
        aliasLabelWrapper.classList.add("show-input-error");
      }
    })

    aliasLabelInput.addEventListener("focusout", () => {
      const newAliasLabel = aliasLabelInput.value;

      // Don't save labels containing forbidden characters
      if (aliasLabelInput.classList.contains("input-has-error")) {
        return;
      }

      // Don't show saved confirmation message if the label hasn't changed
      if (newAliasLabel === aliasLabelInput.dataset.label) {
        return;
      }

      // Save new alias label
      const updatedRelayAddress = relayAddresses.filter(address => address.id == aliasId)[0];
      updatedRelayAddress.domain = newAliasLabel;
      browser.storage.local.set({relayAddresses});

      // show placeholder text if the label is blank
      if (aliasLabelInput.value === "") {
        aliasLabelWrapper.classList.remove("user-created-label");
        aliasLabelInput.placeholder = defaultAliasLabelText;
      } else {
        aliasLabelWrapper.classList.add("user-created-label");
        aliasLabelWrapper.classList.add("show-saved-confirmation");
      }

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
}
