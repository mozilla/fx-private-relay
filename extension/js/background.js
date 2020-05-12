const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";

browser.storage.local.set({ "maxNumAliases": 5 });

async function makeRelayAddress(domain=null) {
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
    // FIXME: can this just return newRelayAddressResponse ?
    return {status: 402};
  }
  newRelayAddressJson = await newRelayAddressResponse.json();
  if (domain) {
    newRelayAddressJson.domain = domain;
  }
  // TODO: put this into an updateLocalAddresses() function
  const localStorageRelayAddresses = await browser.storage.local.get("relayAddresses");
  const localRelayAddresses = (Object.keys(localStorageRelayAddresses).length === 0) ? {relayAddresses: []} : localStorageRelayAddresses;
  const updatedLocalRelayAddresses = localRelayAddresses.relayAddresses.concat([newRelayAddressJson]);
  browser.storage.local.set({relayAddresses: updatedLocalRelayAddresses});
  return newRelayAddressJson;
}

async function makeRelayAddressForTargetElement(info, tab) {
  const pageUrl = new URL(info.pageUrl);
  const newRelayAddress = await makeRelayAddress(pageUrl.hostname);

  if (newRelayAddress.status === 402) {
    browser.tabs.sendMessage(
      tab.id,
      {
        type: "showMaxNumAliasesMessage",
      });
    return;
  }

  browser.tabs.sendMessage(
      tab.id,
      {
        type: "fillTargetWithRelayAddress",
        targetElementId : info.targetElementId,
        relayAddress: newRelayAddress,
      },
      {
        frameId: info.frameId,
    },
  );
}

if (browser.menus) {
  browser.menus.create({
    id: "fx-private-relay-generate-alias",
    title: "Generate Email Alias",
    contexts: ["editable"]
  });

  browser.menus.onClicked.addListener( async (info, tab) => {
    switch (info.menuItemId) {
      case "fx-private-relay-generate-alias":
        await makeRelayAddressForTargetElement(info, tab);
        break;
    }
  });
}

browser.runtime.onMessage.addListener(async (m) => {
  let response;

  switch (m.method) {
    case "makeRelayAddress":
      response = await makeRelayAddress(m.domain);
      break;
  }

  return response;
});
