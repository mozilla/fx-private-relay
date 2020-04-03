(function () {
  for (const emailInput of document.querySelectorAll("input[type='email']")) {
    const divEl = document.createElement("div");
    divEl.classList.add("relay-icon");

    const buttonEl = document.createElement("button");
    buttonEl.id = "relay-button";
    buttonEl.type = "button";
    buttonEl.addEventListener("click", async (e) => {
      const newRelayAddressResponse = await browser.runtime.sendMessage({
          method: "makeRelayAddress",
        });

        if (newRelayAddressResponse.status === 402) {
          emailInput.value = "Too many email aliases.";
          return;
        }

        navigator.clipboard.writeText(newRelayAddressResponse);
        emailInput.value = newRelayAddressResponse;
    });

    divEl.appendChild(buttonEl);
    emailInput.insertAdjacentElement("afterend", divEl); 
  }
})();
