browser.menus.create({
  id: "fx-private-relay-make-address",
  title: "Make a relay address for this field",
  contexts: ["editable"]
});

async function makeRelayAddressForTargetElement(info, tab) {
  const apiToken = await browser.storage.local.get("apiToken");
  // TODO: get the domain from a dynamic input source for different environments
  const newRelayAddressUrl = "http://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/emails/"
  const newRelayAddressResponse = await fetch(newRelayAddressUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `api_token=${apiToken.apiToken}`
  });
  const newRelayAddress = await newRelayAddressResponse.text();
  browser.tabs.executeScript(tab.id, {
    frameId: info.frameId,
    code:`const inputElement = browser.menus.getTargetElement(${info.targetElementId});inputElement.value = "${newRelayAddress}";`,
  });
}

browser.menus.onClicked.addListener( async (info, tab) => {
  switch (info.menuItemId) {
    case "fx-private-relay-make-address":
      await makeRelayAddressForTargetElement(info, tab);
      break;
  }
});
