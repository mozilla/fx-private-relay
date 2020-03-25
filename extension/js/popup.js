function popup() {
  document.querySelector("#generate-alias").addEventListener("click", async (e) => {
    const newRelayAddressResponse = await browser.runtime.sendMessage({
      method: "makeRelayAddress",
    });

    if (!newRelayAddressResponse) {
      // background.js opened a tab to sign in
      return;
    }

    document.querySelector("#display-alias").textContent = newRelayAddressResponse + " copied.";
    navigator.clipboard.writeText(newRelayAddressResponse);
  });
}

document.addEventListener("DOMContentLoaded", popup);
