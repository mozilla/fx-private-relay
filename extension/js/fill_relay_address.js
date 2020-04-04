browser.runtime.onMessage((message, sender, response) => {
    if (message.type === "fillTargetWithRelayAddress") {
        let inputElement = browser.menus.getTargetElement(message.targetElementId);
        inputElement.value = message.relayAddress;
    }
});
