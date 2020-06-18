document.addEventListener("DOMContentLoaded", async () => {
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");
  const { fxaOauthFlow } = await browser.storage.local.get("fxaOauthFlow");

  const signInBtn = document.getElementById("first-run-sign-in");
  const joinWaitlistLink = document.getElementById("first-run-join-waitlist-link");

  const appendParams = (url, params) => {
    for (const utmKey in params) {
      url.searchParams.append(utmKey, params[utmKey]);
    }
    return url;
  };

  joinWaitlistLink.addEventListener("click", (e) => {
    e.preventDefault();
    const utms = {
      "utm_source": "fx-relay-addon",
      "utm_medium": "first-run-landing-page",
      "utm_campaign": "beta",
      "utm_content": "join-waitlist",
    };

    let relayUrl = new URL(relaySiteOrigin);
    relayUrl = appendParams(relayUrl, utms);
    return window.open(relayUrl.href);
  });

  // TODO Add FXA params, do metrics flow from extension?
  const openFxaFlow = new URL(fxaOauthFlow, relaySiteOrigin);
  signInBtn.addEventListener("click", () => {
   return window.open(openFxaFlow);
  });
});
