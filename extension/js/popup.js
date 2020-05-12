/* global browser */

function showSignUpPanel() {
  const signUpOrInPanel = document.querySelector(".sign-up-panel");
  document.body.classList.add("sign-up");
  return signUpOrInPanel.classList.remove("hidden");
}


function showRelayPanel() {
  document.body.classList.add("relay-panel");
  const relayPanel = document.querySelector(".signed-in-panel");
  return relayPanel.classList.remove("hidden");
}


async function getAllAliases() {
  return await browser.storage.local.get("relayAddresses");
}


async function makeNewAlias() {
  const newRelayAddressResponse = await browser.runtime.sendMessage({
    method: "makeRelayAddress",
  });

  return newRelayAddressResponse;
}


function copyAliasToClipboard(copyBtn) {
  document.querySelectorAll(".alias-copied").forEach(previouslyCopiedAlias => {
    previouslyCopiedAlias.classList.remove("alias-copied");
    previouslyCopiedAlias.title = "Copy alias to clipboard";
  });
  copyBtn.classList.add("alias-copied");
  copyBtn.title = "Alias copied to your clipboard";
  window.navigator.clipboard.writeText(copyBtn.dataset.relayAddress);
}


async function updatePanelValues() {
  const { relayAddresses } = await getAllAliases();
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
  const aliasListHeader = document.querySelector("alias-list-header");

  const remainingAliasMessage = document.querySelector(".aliases-remaining");
  const numRemainingEl = remainingAliasMessage.querySelector(".num-aliases-remaining");
  const aliasCreationEl = document.querySelector("alias-creation");
  const createAliasBtn = aliasCreationEl.querySelector(".create-new-alias");
  const numRemaining = maxNumAliases - relayAddresses.length;

  const noAliases = (relayAddresses && relayAddresses.length === 0);
  const manageAliasesText = "Manage Aliases";
  const footerButton = document.querySelector(".footer-button");
  footerButton.textContent = noAliases ? "View Dashboard" : manageAliasesText;

  numRemainingEl.textContent = numRemaining;

  if (numRemaining === 5) {
    aliasListHeader.classList.add("hidden");
    createAliasBtn.disabled = true;

  }

  if (numRemaining === 0) {
    aliasCreationEl.classList.add("disabled");
    return;
  }

  // adjust plural/singular form of the word "alias" if there is 1 remaining alias
  if (numRemaining === 1) {
    const aliasText = remainingAliasMessage.querySelector(".alias-text");
    aliasText.textContent = "alias";
  }
}


async function popup() {
  const userApiToken = await browser.storage.local.get("apiToken");
  if (!userApiToken.hasOwnProperty("apiToken")) {
    return showSignUpPanel();
  }

  showRelayPanel();

  const { relayAddresses } = await getAllAliases();

  const aliasListWrapper = document.querySelector("alias-list");
  const aliasListHeader = aliasListWrapper.querySelector("alias-list-header");

  const createAliasListItem = (alias) => {
    const aliasEl = document.createElement("alias");
    const aliasAddress = document.createElement("alias-list-address");
    aliasAddress.textContent = alias.address;
    aliasEl.appendChild(aliasAddress);

    const aliasDomainEl = document.createElement("alias-list-domain");
    aliasDomainEl.textContent = (!alias.domain || alias.domain === "") ? "" : alias.domain;
    aliasEl.appendChild(aliasDomainEl);

    const copyToClipboard = document.createElement("button");
    copyToClipboard.classList = ["copy-to-clipboard"];
    copyToClipboard.title = "Copy alias to clipboard";
    copyToClipboard.dataset.relayAddress = alias.address;

    copyToClipboard.addEventListener("click", (e) => {
      const copyBtn  = e.target;
      copyAliasToClipboard(copyBtn);
    });
    aliasEl.appendChild(copyToClipboard);
    return aliasListWrapper.appendChild(aliasEl);
  };

  relayAddresses.forEach(relayAddress => {
    createAliasListItem(relayAddress);
  });

  updatePanelValues();

  document.querySelectorAll(".create-new-alias").forEach(generateAliasBtn => {
    generateAliasBtn.addEventListener("click", async() => {
      const newRelayAddressResponse =  await makeNewAlias();
      if (!newRelayAddressResponse) {
        return;
      }

      if (newRelayAddressResponse.status === 402) {
        return updatePanelValues();
      }

      if (aliasListHeader.classList.contains("hidden")) {
        aliasListHeader.classList.remove("hidden");
      }

      updatePanelValues();

      // Add newly created alias to alias list
      createAliasListItem(newRelayAddressResponse);
      const newlyCreatedAlias = document.querySelector(`button[data-relay-address="${newRelayAddressResponse.address}"]`);
      copyAliasToClipboard(newlyCreatedAlias);
      newlyCreatedAlias.focus();
    });
  });

  document.querySelectorAll(".close-popup-after-click").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await browser.tabs.create({ url: el.href });
      window.close();
    });
  });
}

document.addEventListener("DOMContentLoaded", popup);
