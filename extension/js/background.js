const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";


browser.menus.create({
  id: "fx-private-relay-generate-alias",
  title: "Generate Email Alias",
  contexts: ["editable"]
});

async function makeRelayAddressForTargetElement(info, tab) {
  const apiToken = await browser.storage.local.get("apiToken");

  if (!apiToken.apiToken) {
    browser.tabs.create({
      url: RELAY_SITE_ORIGIN,
    });
    return;
  }

  const newRelayAddressUrl = `${RELAY_SITE_ORIGIN}/emails/`;
  const newRelayAddressResponse = await fetch(newRelayAddressUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `api_token=${apiToken.apiToken}`
  });

  if (newRelayAddressResponse.status === 402) {
    browser.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      code:`alert("You already have 5 email addresses. Please upgrade.");`,
    });
    return;
  }

  const newRelayAddress = await newRelayAddressResponse.text();
  browser.tabs.executeScript(tab.id, {
    frameId: info.frameId,
    code:`let inputElement = browser.menus.getTargetElement(${info.targetElementId});inputElement.value = "${newRelayAddress}";`,
  });
}

browser.menus.onClicked.addListener( async (info, tab) => {
  switch (info.menuItemId) {
    case "fx-private-relay-generate-alias":
      await makeRelayAddressForTargetElement(info, tab);
      break;
  }
});
