"use strict";

/* exported enableDataOptOut */

// eslint-disable-next-line no-redeclare
async function enableDataOptOut() {
  const dataCollectionPrefToggle = document.querySelector(".data-collection");
  const stylePrefToggle = (userPref) => {
    if (userPref === "data-enabled") {
      dataCollectionPrefToggle.classList.remove("data-disabled");
      dataCollectionPrefToggle.title = "Disable data collection";
      dataCollectionPrefToggle.dataset.collectionPreference = "data-disabled";
      return;
    }
    dataCollectionPrefToggle.classList.add("data-disabled");
    dataCollectionPrefToggle.title = "Allow data collection";
    dataCollectionPrefToggle.dataset.collectionPreference = "data-enabled";
  };


  const { dataCollection } = await browser.storage.local.get("dataCollection");

  if (!dataCollection) {
    browser.storage.local.set({ "dataCollection": "data-enabled" });
    stylePrefToggle("data-enabled")
  } else {
    stylePrefToggle(dataCollection);
  }

  dataCollectionPrefToggle.addEventListener("click", async(e) => {
    const collectionPreference = e.target.dataset.collectionPreference;
    await browser.storage.local.set({ "dataCollection" : collectionPreference });
    stylePrefToggle(collectionPreference);
  });
}
