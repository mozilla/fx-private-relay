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
  const numRemaining = maxNumAliases - relayAddresses.length;
  const maxNumAliasesEl = remainingAliasMessage.querySelector(".max-num-aliases");
  maxNumAliasesEl.textContent = `/${maxNumAliases}`;

  numRemainingEl.textContent = numRemaining;

  if (numRemaining === 5) {
    aliasListHeader.classList.add("hidden");
    createAliasBtn.disabled = false;

  }

  // adjust plural/singular form of the word "alias" if there is 1 remaining alias
  if (numRemaining === 1) {
    const aliasText = remainingAliasMessage.querySelector(".alias-text");
    aliasText.textContent = "alias";
  }
}

function enableSettingsPanel() {
  const settingsToggles = document.querySelectorAll(".settings-toggle");
  settingsToggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("show-settings");
    });
  });
}

async function enableInputIconDisabling() {
  const inputIconVisibilityToggle = document.querySelector(".toggle-icon-in-page-visibility");

  const stylePrefToggle = (inputsEnabled) => {
    if (inputsEnabled === "show-input-icons") {
      inputIconVisibilityToggle.dataset.iconVisibilityOption = "disable-input-icon";
      inputIconVisibilityToggle.classList.remove("input-icons-disabled");
      return;
    }
    inputIconVisibilityToggle.dataset.iconVisibilityOption = "enable-input-icon";
    inputIconVisibilityToggle.classList.add("input-icons-disabled");
  };


  const areInputIconsEnabled = await browser.storage.local.get("showInputIcons");
  stylePrefToggle(areInputIconsEnabled.showInputIcons);

  inputIconVisibilityToggle.addEventListener("click", async() => {
    const userIconPreference = (inputIconVisibilityToggle.dataset.iconVisibilityOption === "disable-input-icon") ? "hide-input-icons" : "show-input-icons";
    await browser.runtime.sendMessage({
      method: "updateInputIconPref",
      iconPref: userIconPreference,
    });
    return stylePrefToggle(userIconPreference);
  });

}


async function popup() {
  const userApiToken = await browser.storage.local.get("apiToken");
  if (!userApiToken.hasOwnProperty("apiToken")) {
    return showSignUpPanel();
  }

  showRelayPanel();
  enableSettingsPanel();
  enableInputIconDisabling();
  updatePanelValues();

  document.querySelectorAll(".close-popup-after-click").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await browser.tabs.create({ url: el.href });
      window.close();
    });
  });
}

document.addEventListener("DOMContentLoaded", popup);
