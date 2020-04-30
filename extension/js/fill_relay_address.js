function showModal(modalContentString, modalType) {
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

    if (modalType === "new-alias") {
        const modalAlias = document.createElement("span");
        modalAlias.textContent = modalContentString;
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
    document.body.appendChild(modalWrapper)

    window.navigator.clipboard.writeText(modalContentString);
    return;
}


browser.runtime.onMessage.addListener((message, sender, response) => {
    if (message.type === "fillTargetWithRelayAddress") {

        // attempt to find the email input
        let emailInput = browser.menus.getTargetElement(message.targetElementId);

        // find email inputs in frame
        if (!emailInput && message.options.iframeSrc) {
            const parentIframe = document.querySelector(`iframe[src^="${message.options.iframeSrc}"]`);
            // Later: Do better detecting of iframe input
            const foundEmailInputs = parentIframe.contentWindow.document.body.querySelectorAll("input[type='email'], input[name='email']");
            emailInput = (foundEmailInputs.length > 0) ? foundEmailInputs[0] : emailInput;
        }

        // default to showing the new alias in a modal if the input still hasn't been found
        if (!emailInput) {
            return showModal(message.relayAddress, "new-alias");
        }

        emailInput.value = message.relayAddress;
    }
});
