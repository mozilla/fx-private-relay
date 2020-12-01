async function showModal(modalType) {
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");
  const modalWrapper = document.createElement("div");
  modalWrapper.classList = ["fx-relay-modal-wrapper"];

  const modalContent = document.createElement("div");
  modalContent.classList = ["fx-relay-modal-content"];

  const logoWrapper = document.createElement("fx-relay-logo-wrapper");
  const logoMark = document.createElement("fx-relay-logomark");
  const logoType = document.createElement("fx-relay-logotype");

  [logoMark, logoType].forEach(customEl => {
    logoWrapper.appendChild(customEl);
  });

  modalContent.appendChild(logoWrapper);

  const sendModalEvent = (evtAction, evtLabel) => {
    return sendRelayEvent("Modal", evtAction, evtLabel);
  };

  sendModalEvent("viewed-modal", "modal-max-aliases");
  const modalMessage = document.createElement("span");

  modalMessage.textContent = "You've reached the alias limit.";
  modalMessage.classList = ["fx-relay-modal-message"];
  modalContent.appendChild(modalMessage);

  const manageAliasesLink = document.createElement("a");
  manageAliasesLink.textContent = "Manage All Aliases";
  manageAliasesLink.classList = ["fx-relay-new-tab fx-relay-modal-manage-aliases"];
  manageAliasesLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=context-menu-modal&utm_content=manage-relay-addresses`;

  manageAliasesLink.addEventListener("click", async(e) => {
    e.preventDefault();
    sendModalEvent("click", "modal-manage-all-aliases-btn");
    return window.open(e.target.href);
  });
  modalContent.appendChild(manageAliasesLink);
  

  const modalCloseButton = document.createElement("button");
  modalCloseButton.classList = ["fx-relay-modal-close-button"];
  modalCloseButton.textContent = "Close";

  // Remove relay modal on button click
  modalCloseButton.addEventListener("click", () => {
    sendModalEvent("closed-modal", "modal-closed-btn");
    modalWrapper.remove();
  });

  // Remove relay modal on clicks outside of modal.
  modalWrapper.addEventListener("click", (e) => {
    const originalTarget = e.explicitOriginalTarget;
    if (originalTarget.classList.contains("fx-relay-modal-wrapper")) {
      sendModalEvent("closed-modal", "modal-closed-outside-click");
      modalWrapper.remove();
    }
  });

  modalContent.appendChild(modalCloseButton);
  modalWrapper.appendChild(modalContent);
  document.body.appendChild(modalWrapper);
  return;
}


// eslint-disable-next-line no-redeclare
function fillInputWithAlias(emailInput, relayAlias) {
  emailInput.value = relayAlias.address;
  emailInput.dispatchEvent(new InputEvent("relay-address", {
    data: relayAlias.address,
  }));
}


browser.runtime.onMessage.addListener((message, sender, response) => {
  if (message.type === "fillTargetWithRelayAddress") {
    const emailInput = browser.menus.getTargetElement(message.targetElementId);
    return fillInputWithAlias(emailInput, message.relayAddress);
  }

  if (message.type === "showMaxNumAliasesMessage") {
    return showModal();
  }
});
