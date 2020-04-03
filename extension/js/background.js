const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";

/**
 * Escapes any occurances of &, ", <, > or / with XML entities.
 *
 * @param {string} str
 *        The string to escape.
 * @return {string} The escaped string.
 */
function escapeXML(str) {
  const replacements = { "&": "&amp;", "\"": "&quot;", "'": "&apos;", "<": "&lt;", ">": "&gt;", "/": "&#x2F;" };
  return String(str).replace(/[&"'<>/]/g, m => replacements[m]);
}

/**
 * A tagged template function which escapes any XML metacharacters in
 * interpolated values.
 *
 * @param {Array<string>} strings
 *        An array of literal strings extracted from the templates.
 * @param {Array} values
 *        An array of interpolated values extracted from the template.
 * @returns {string}
 *        The result of the escaped values interpolated with the literal
 *        strings.
 */

function escaped(strings, ...values) {
  const result = [];

  for (const [i, string] of strings.entries()) {
    result.push(string);
    if (i < values.length)
      result.push(escapeXML(values[i]));
  }

  return result.join("");
}

async function makeRelayAddress() {
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
    return {status: 402};
  }
  return await newRelayAddressResponse.text();
}

async function makeRelayAddressForTargetElement(info, tab) {
  const newRelayAddressResponse = await makeRelayAddress();

  if (newRelayAddressResponse.status === 402) {
    browser.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      code:`alert("You already have 5 email addresses. Please upgrade.");`,
    });
    return;
  }

  browser.tabs.executeScript(tab.id, {
    frameId: info.frameId,
    code: escaped`let inputElement = browser.menus.getTargetElement(${info.targetElementId});inputElement.value = "${newRelayAddressResponse}";`,
  });
}

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

browser.runtime.onMessage.addListener(async (m) => {
  let response;

  switch (m.method) {
    case "makeRelayAddress":
      response = await makeRelayAddress();
      break;
  }

  return response;
});
