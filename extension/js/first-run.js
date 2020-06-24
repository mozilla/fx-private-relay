document.addEventListener("DOMContentLoaded", async () => {
  const { fxaOauthFlow } = await browser.storage.local.get("fxaOauthFlow");
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");

  // TODO Add FXA params, do metrics flow from extension?
  const openFxaFlow = new URL(fxaOauthFlow, relaySiteOrigin);

  const oauthEntryPoints = document.querySelectorAll(".open-oauth");
  oauthEntryPoints.forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      return window.open(openFxaFlow);
    });
  });
});
