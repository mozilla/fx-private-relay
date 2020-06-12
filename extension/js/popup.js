/* global browser */

function getOnboardingPanels() {
  return {
    "panel1": {
      "imgSrc": "tip1-icon.svg",
      "tipHeadline": "Welcome!",
      "tipBody": "When the Firefox Relay icon appears on a website, select it to generate a new relay address."

    },
    "panel2": {
      "imgSrc": "tip2-icon.svg",
      "tipHeadline": "Don't see the icon?",
      "tipBody":"Right click (Windows) or control+click (Mac) to open the context menu easily generate a new realy from there",
    },
    "panel3": {
      "imgSrc": "tip3-icon.svg",
      "tipHeadline": "Placeholder tip headline",
      "tipBody":"Placeholder tip copy about how you can block emails by going to the dashboard and toggling the toggles.",
    },
    "maxAliasesPanel": {
      "imgSrc": "high-five.svg",
      "tipHeadline": "High five!",
      "tipBody": "Want more than 5 relay emails? Take our short survey and share your feedback!",
      "linkCopy": "Take the survey",
      "linkHref": "/",
    }
  }
}


function showSignUpPanel() {
  const signUpOrInPanel = document.querySelector(".sign-up-panel");
  document.body.classList.add("sign-up");
  return signUpOrInPanel.classList.remove("hidden");
}

function updatePanel(numRemaining, panelId) {
  const onboardingPanelWrapper = document.querySelector("onboarding-panel");
  const onboardingPanelStrings = getOnboardingPanels();
  let panelToShow = `panel${panelId}`;

  if (numRemaining === 0) {
    panelToShow = "maxAliasesPanel";
  }

  onboardingPanelWrapper.classList = [panelToShow];

  panelToShow = onboardingPanelStrings[`${panelToShow}`];

  const tipImageEl = onboardingPanelWrapper.querySelector("img");
  const tipHeadlineEl = onboardingPanelWrapper.querySelector("h1");
  const tipBodyEl = onboardingPanelWrapper.querySelector("p");
  const currentPanel = onboardingPanelWrapper.querySelector(".current-panel");

  tipImageEl.src = `/images/panel-images/${panelToShow.imgSrc}`;
  tipHeadlineEl.textContent = panelToShow.tipHeadline;
  tipBodyEl.textContent = panelToShow.tipBody;
  currentPanel.textContent = `${panelId}`;

  if (panelToShow.linkCopy) {
    const surveyLink = document.createElement("a");
    surveyLink.classList.add("survey-link");
    surveyLink.href = panelToShow.linkHref;
    surveyLink.textContent = panelToShow.linkCopy;
    onboardingPanelWrapper.appendChild(surveyLink);
  }
}


async function showRelayPanel(tipPanelToShow) {
  const { relayAddresses, maxNumAliases } = await getRemainingAliases();
  const remainingAliasMessage = document.querySelector(".aliases-remaining");
  const numRemainingEl = remainingAliasMessage.querySelector(".num-aliases-remaining");
  const numRemaining = maxNumAliases - relayAddresses.length;
  const maxNumAliasesEl = remainingAliasMessage.querySelector(".max-num-aliases");
  maxNumAliasesEl.textContent = `/${maxNumAliases}`;
  numRemainingEl.textContent = numRemaining;

  document.body.classList.add("relay-panel");
  updatePanel(numRemaining, tipPanelToShow);

  document.querySelectorAll(".panel-nav").forEach(navBtn => {
    navBtn.addEventListener("click", () => {
      // pointer events are disabled in popup CSS for the "previous" button on panel 1
      // and the "next" button on panel 3
      const nextPanel = (navBtn.dataset.direction === "-1") ? -1 : 1;
      return updatePanel(numRemaining, tipPanelToShow+=nextPanel);
    });
  });

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


async function getRemainingAliases() {
  const { relayAddresses } = await getAllAliases();
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
  return { relayAddresses, maxNumAliases };
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
  const signedInUser = (userApiToken.hasOwnProperty("apiToken"));
  if (!signedInUser) {
    showSignUpPanel();
  }

  if (signedInUser) {
    showRelayPanel(1);
    enableSettingsPanel();
    enableInputIconDisabling();
  }

  document.querySelectorAll(".close-popup-after-click").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await browser.tabs.create({ url: el.href });
      window.close();
    });
  });
}

document.addEventListener("DOMContentLoaded", popup);
