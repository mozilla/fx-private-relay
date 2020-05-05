function showModal(modalType, newAlias=null) {
  const modalWrapper = document.createElement("div");
  modalWrapper.classList = ["relay-modal-wrapper"];

  const modalContent = document.createElement("div");
  modalContent.classList = ["relay-modal-content"];

  const logoWrapper = document.createElement("logo-wrapper");
  const logoMark = document.createElement("logomark");
  const logoType = document.createElement("logotype");

  [logoMark, logoType].forEach(customEl => {
    logoWrapper.appendChild(customEl);
  });

  modalContent.appendChild(logoWrapper);

  const modalAliasWrapper = document.createElement("div");
  modalAliasWrapper.classList = ["relay-modal-message-alias-wrapper"];

  if (modalType === "new-alias") { // New alias was created, but input wasn't found.
    const modalAlias = document.createElement("span");
    modalAlias.textContent = newAlias;
    modalAlias.classList = ["relay-modal-alias"];

    const purpleCopiedBlurb = document.createElement("span");
    purpleCopiedBlurb.textContent = "Copied!";
    purpleCopiedBlurb.classList = ["relay-message-copied"];

    [modalAlias, purpleCopiedBlurb].forEach(textEl => {
      modalAliasWrapper.appendChild(textEl);
    });

    const modalMessage = document.createElement("span");
    modalMessage.textContent = "You just created a new alias!";
    modalMessage.classList = ["relay-modal-message relay-modal-headline"];

    [modalAliasWrapper, modalMessage].forEach(textEl => {
      modalContent.appendChild(textEl);
    });
    window.navigator.clipboard.writeText(newAlias);
  }

  if (modalType === "max-num-aliases") { // User has maxed out the number of allowed free aliases.
    const modalMessage = document.createElement("span");
    modalMessage.textContent = "You have reached the maximum number of aliases allowed during the beta phase of Private Relay.";
    modalMessage.classList = ["relay-modal-message relay-modal-headline"];
    modalContent.appendChild(modalMessage);

    const manageAliasesLink = document.createElement("a");
    manageAliasesLink.textContent = "Manage Aliases";
    manageAliasesLink.classList = ["new-tab"];
    manageAliasesLink["href"] = "http://127.0.0.1:8000/accounts/profile";
    modalContent.appendChild(manageAliasesLink);
  }

  const modalCloseButton = document.createElement("button");
  modalCloseButton.classList = ["relay-modal-close-button"];
  modalCloseButton.textContent = "Got it!";

  // Remove relay modal on button click
  modalCloseButton.addEventListener("click", () => {
    modalWrapper.remove();
  });

  // Remove relay modal on clicks outside of modal.
  modalWrapper.addEventListener("click", (e) => {
    const originalTarget = e.explicitOriginalTarget;
    if (originalTarget.classList.contains("relay-modal-wrapper")) {
      modalWrapper.remove();
    }
  });

  modalContent.appendChild(modalCloseButton);
  modalWrapper.appendChild(modalContent);
  document.body.appendChild(modalWrapper);
  return;
}


browser.runtime.onMessage.addListener((message, sender, response) => {
  if (message.type === "fillTargetWithRelayAddress") {
    // attempt to find the email input
    const emailInput = browser.menus.getTargetElement(message.targetElementId);
    if (!emailInput) {
      return showModal("new-alias", message.relayAddress);
    }
    return emailInput.value = message.relayAddress;
  }

  if (message.type === "showMaxNumAliasesMessage") {
    return showModal("max-num-aliases");
  }
});
