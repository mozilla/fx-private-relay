/* exported areInputIconsEnabled */

// eslint-disable-next-line no-redeclare
async function areInputIconsEnabled() {
  const { showInputIcons } = await browser.storage.local.get("showInputIcons");
  if (!showInputIcons) {
    browser.storage.local.set({ "showInputIcons" : "show-input-icons"})
    return true;
  }
  return (showInputIcons === "show-input-icons");
}
