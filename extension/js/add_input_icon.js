function closeRelayInPageMenu() {
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  relayIconBtn.classList.remove("fx-relay-menu-open");
  const openMenuEl = document.querySelector(".fx-relay-menu-wrapper");
  openMenuEl.remove();
  restrictOrRestorePageTabbing(0);
  document.removeEventListener("keydown", handleKeydownEvents);
  window.removeEventListener("resize", positionRelayMenu);
  window.removeEventListener("scroll", positionRelayMenu);
  return;
}


function addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn) {
  relayMenuWrapper.appendChild(relayInPageMenu);
  document.body.appendChild(relayMenuWrapper);

  // Position menu according to the input icon's position
  positionRelayMenu();
  relayIconBtn.focus();
  return;
}


function preventDefaultBehavior(clickEvt) {
  clickEvt.stopPropagation();
  clickEvt.stopImmediatePropagation();
  clickEvt.preventDefault();
  return;
}


function getRelayMenuEl() {
  return document.querySelector(".fx-relay-menu");
}


function positionRelayMenu() {
  const relayInPageMenu = getRelayMenuEl();
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  const newIconPosition = relayIconBtn.getBoundingClientRect();
  relayInPageMenu.style.left = (newIconPosition.x - 255) + "px";
  relayInPageMenu.style.top = (newIconPosition.top + 40) + "px";
}


let activeElemIndex = -1;
function handleKeydownEvents(e) {
  const relayInPageMenu = getRelayMenuEl();
  const clickableElsInMenu = relayInPageMenu.querySelectorAll("button, a");
  const relayButton = document.querySelector(".fx-relay-button");
  const watchedKeys = ["Escape", "ArrowDown", "ArrowUp", "Tab"];
  const watchedKeyClicked = watchedKeys.includes(e.key);

  if (e.key === "Escape") {
    preventDefaultBehavior(e);
    return closeRelayInPageMenu();
  }

  if (e.key === "ArrowDown" || (e.key === "Tab" && e.shiftKey === false)) {
    preventDefaultBehavior(e);
    activeElemIndex += 1;
  }

  if (e.key === "ArrowUp"|| (e.key === "Tab" && e.shiftKey === true)) {
    preventDefaultBehavior(e);
    activeElemIndex -= 1;
  }

  if ((clickableElsInMenu[activeElemIndex] !== undefined) && watchedKeyClicked) {
    return clickableElsInMenu[activeElemIndex].focus();
  }

  if (watchedKeyClicked) {
    activeElemIndex = -1;
    relayButton.focus();
  }
}


// When restricting tabbing to Relay menu... tabIndexValue = -1
// When restoring tabbing to page elements... tabIndexValue = 0
function restrictOrRestorePageTabbing(tabIndexValue) {
  const allClickableEls = document.querySelectorAll("button, a, input, select, option, textarea, [tabindex]");
  allClickableEls.forEach(el => {
    el.tabIndex = tabIndexValue;
  });
}

function createElementWithClassList(elemType, elemClass) {
  const newElem = document.createElement(elemType);
  newElem.classList.add(elemClass);
  return newElem;
}


async function isUserSignedIn() {
  const userApiToken = await browser.storage.local.get("apiToken");
  return (userApiToken.hasOwnProperty("apiToken"));
}


async function addRelayIconToInput(emailInput) {
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");
  // remember the input's original parent element;
  const emailInputOriginalParentEl = emailInput.parentElement;

  // create new wrapping element;
  const emailInputWrapper = createElementWithClassList("div", "fx-relay-email-input-wrapper");
  emailInputOriginalParentEl.insertBefore(emailInputWrapper, emailInput);

  // add padding to the input so that input text
  // is not covered up by the Relay icon
  emailInput.style.paddingRight = "50px";
  emailInputWrapper.appendChild(emailInput);

  const computedInputStyles = getComputedStyle(emailInput);
  const inputHeight = emailInput.offsetHeight;

  const divEl = createElementWithClassList("div", "fx-relay-icon");

  const bottomMargin = parseInt(computedInputStyles.getPropertyValue("margin-bottom"), 10);
  const topMargin = parseInt(computedInputStyles.getPropertyValue("margin-top"), 10);

  divEl.style.height = computedInputStyles.height - bottomMargin - topMargin + "px"

  divEl.style.top = topMargin ;
  divEl.style.bottom = `${bottomMargin}px`;


  const relayIconBtn = createElementWithClassList("button", "fx-relay-button");
  relayIconBtn.id = "fx-relay-button";
  relayIconBtn.type = "button";
  relayIconBtn.title = "Generate new alias";

  const relayIconHeight = 30;
  if (relayIconHeight > inputHeight) {
    const smallIconSize = "24px";
    relayIconBtn.style.height = smallIconSize;
    relayIconBtn.style.width = smallIconSize;
    relayIconBtn.style.minWidth = smallIconSize;
    emailInput.style.paddingRight = "30px";
    divEl.style.right = "2px";
  }

  const sendInPageEvent = (evtAction, evtLabel) => {
    sendRelayEvent("In-page", evtAction, evtLabel);
  }


  relayIconBtn.addEventListener("click", async(e) => {

    sendInPageEvent("input-icon-clicked", "input-icon")

    preventDefaultBehavior(e);
    window.addEventListener("resize", positionRelayMenu);
    window.addEventListener("scroll", positionRelayMenu);
    document.addEventListener("keydown", handleKeydownEvents);

    const relayInPageMenu = createElementWithClassList("div", "fx-relay-menu");
    const relayMenuWrapper = createElementWithClassList("div", "fx-relay-menu-wrapper");

    // Close menu if the user clicks outside of the menu
    relayMenuWrapper.addEventListener("click", closeRelayInPageMenu);

    // Close menu if it's already open
    relayIconBtn.classList.toggle("fx-relay-menu-open");
    if (!relayIconBtn.classList.contains("fx-relay-menu-open")) {
      return closeRelayInPageMenu();
    }

    const signedInUser = await isUserSignedIn();

    if (!signedInUser) {
      const signUpMessageEl = createElementWithClassList("span", "fx-relay-menu-sign-up-message");
      signUpMessageEl.textContent = "Visit the Firefox Relay website to sign in or create an account.";

      relayInPageMenu.appendChild(signUpMessageEl);
      const signUpButton = createElementWithClassList("button", "fx-relay-menu-sign-up-btn");
      signUpButton.textContent = "Go to Firefox Relay";

      signUpButton.addEventListener("click", async(clickEvt) => {
        preventDefaultBehavior(clickEvt);
        await browser.runtime.sendMessage({
          method: "openRelayHomepage",
        });
        sendInPageEvent("click", "input-menu-sign-up-btn");
        closeRelayInPageMenu();
      });
      relayInPageMenu.appendChild(signUpButton);

      addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn);
      sendInPageEvent("viewed-menu", "unauthenticated-user-input-menu")
      return;
    }

    sendInPageEvent("viewed-menu", "authenticated-user-input-menu")
    // Create "Generate Relay Address" button
    const generateAliasBtn = createElementWithClassList("button", "fx-relay-menu-generate-alias-btn");
    generateAliasBtn.textContent = "Generate New Alias";



    // Create "You have .../.. remaining relay address" message
    const remainingAliasesSpan = createElementWithClassList("span", "fx-relay-menu-remaining-aliases");
    const { relayAddresses } = await browser.storage.local.get("relayAddresses");
    const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");

    const numAliasesRemaining = maxNumAliases - relayAddresses.length;
    const aliases = (numAliasesRemaining === 1) ? "alias" : "aliases";
    remainingAliasesSpan.textContent = `You have ${numAliasesRemaining} ${aliases} remaining`;

    const maxNumAliasesReached = numAliasesRemaining === 0;
    if (maxNumAliasesReached) {
      generateAliasBtn.disabled = true;
      sendInPageEvent("viewed-menu", "input-menu-max-aliases-message")
    }


    // Create "Manage All Aliases" link
    const relayMenuDashboardLink = createElementWithClassList("a", "fx-relay-menu-dashboard-link");
    relayMenuDashboardLink.textContent = "Manage All Aliases";
    relayMenuDashboardLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
    relayMenuDashboardLink.target = "_blank";
    relayMenuDashboardLink.addEventListener("click", () => {
      sendInPageEvent("click", "input-menu-manage-all-aliases-btn");
    });

    // Restrict tabbing to relay menu elements
    restrictOrRestorePageTabbing(-1);

    // Append menu elements to the menu
    [generateAliasBtn, remainingAliasesSpan, relayMenuDashboardLink].forEach(el => {
      relayInPageMenu.appendChild(el);
    });


    // Handle "Generate New Alias" clicks
    generateAliasBtn.addEventListener("click", async(generateClickEvt) => {
      sendInPageEvent("click", "input-menu-generate-alias");
      preventDefaultBehavior(generateClickEvt);

      // Attempt to create a new alias
      const newRelayAddressResponse = await browser.runtime.sendMessage({
        method: "makeRelayAddress",
        domain: document.location.hostname,
      });

      relayInPageMenu.classList.add("fx-relay-alias-loading");

      // Catch edge cases where the "Generate New Alias" button is still enabled,
      // but the user has already reached the max number of aliases.
      if (newRelayAddressResponse.status === 402) {
        relayInPageMenu.classList.remove("fx-relay-alias-loading");
        // preserve menu height before removing child elements
        relayInPageMenu.style.height = relayInPageMenu.clientHeight + "px";

        [generateAliasBtn, remainingAliasesSpan].forEach(el => {
          el.remove();
        });

        const errorMessage = createElementWithClassList("p", "fx-relay-error-message");
        errorMessage.textContent = `You have already created ${maxNumAliases} aliases`;

        relayInPageMenu.insertBefore(errorMessage, relayMenuDashboardLink);
        return;
      }

      setTimeout(() => {
        fillInputWithAlias(emailInput, newRelayAddressResponse);
        relayIconBtn.classList.add("user-generated-relay");
        closeRelayInPageMenu();
      }, 700);
    });

    addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn);
  });

  divEl.appendChild(relayIconBtn);
  emailInputWrapper.appendChild(divEl);
  sendInPageEvent("input-icon-injected", "input-icon");
}

function getEmailInputsAndAddIcon(domRoot) {
  const emailInputs = detectEmailInputs(domRoot);
  for (const emailInput of emailInputs) {
    if (!emailInput.parentElement.classList.contains("fx-relay-email-input-wrapper")) {
      addRelayIconToInput(emailInput);
    }
  }
}

(async function() {
  const inputIconsAreEnabled = await areInputIconsEnabled();
  if (!inputIconsAreEnabled) {
    return;
  }
  // Catch all immediately findable email inputs
  getEmailInputsAndAddIcon(document);

  // Catch email inputs that only become findable after
  // the entire page (including JS/CSS/images/etc) is fully loaded.
  window.addEventListener("load", () => {
    getEmailInputsAndAddIcon(document);
  });

  // Create a MutationObserver to watch for dynamically generated email inputs
  const mutationObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.target.tagName === "FORM") {
        getEmailInputsAndAddIcon(mutation.target);
      }
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
