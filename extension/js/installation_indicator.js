// This looks for <firefox-private-relay-addon></firefox-private-relay-addon> and
// updates the dataset. The Private Relay website watches for this change, and
// makes content changes if the addon has been installed.

(() => {
  localStorage.setItem("fxRelayAddonInstalled", "true");
  document.querySelectorAll("firefox-private-relay-addon").forEach(el => {
    el.dataset.addonInstalled = "true";
  });
})();
