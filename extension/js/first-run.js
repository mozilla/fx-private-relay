document.addEventListener("DOMContentLoaded", async () => {
  const { fxaOauthFlow } = await browser.storage.local.get("fxaOauthFlow");
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");
  const { dataCollection } = await browser.storage.local.get("dataCollection");

  const privacyModal = document.querySelector(".privacy-modal");
  const allCTAs = document.querySelectorAll("a, button");
  const dataCollectionOptions = document.querySelectorAll(".collection-opt");

  const closeModal = () => {
    privacyModal.classList.add("hide-modal");
    document.removeEventListener("keydown", closeModalOnEscape);
    document.removeEventListener("click", closeModalOnPageClick);
    allCTAs.forEach(el => {
      if (el.classList.contains("modal-cta")) {
        el.tabIndex = -1;
      } else {
        el.tabIndex = 0;
      }
    });
  };

  const closeModalOnEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };

  const closeModalOnPageClick = (e) => {
    if (!privacyModal.classList.contains("hide-modal")) {
      if (e.target.classList.contains("privacy-modal")) {
        closeModal();
      }
    }
  };

  const openModal = () => {
    privacyModal.classList.remove("hide-modal");
    document.addEventListener("keydown", closeModalOnEscape);
    document.addEventListener("click", closeModalOnPageClick);
    allCTAs.forEach(el => {
      if (!el.classList.contains("modal-cta")) {
        el.tabIndex = -1;
      }
    });

    dataCollectionOptions.forEach( el => {
      el.addEventListener("click", async() => {
        const collectionOption = el.dataset.collectionOption;
        // "data-disabled" || "data-enabled"
        await browser.storage.local.set({ "dataCollection": collectionOption});
        closeModal();
      });
    });
  }

  if (!dataCollection) {
    setTimeout(() => {
      openModal();
    }, 500);
  }






  // TODO Add FXA params, do metrics flow from extension?
  const openFxaFlow = new URL(fxaOauthFlow, relaySiteOrigin);

  const oauthEntryPoints = document.querySelectorAll(".open-oauth");
  oauthEntryPoints.forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      sendRelayEvent("First Run", "click", e.target.dataset.eventLabel);
      return window.open(openFxaFlow);
    });
  });
});
