"use strict";

/* global enableDataOptOut */

document.addEventListener("DOMContentLoaded", async () => {
  const { fxaOauthFlow } = await browser.storage.local.get("fxaOauthFlow");
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");


  setTimeout(() => {
    openModal();
  }, 500);

  const privacyModal = document.querySelector(".privacy-modal");

  const closeModal = () => {
    privacyModal.classList.add("hide-modal");
    document.removeEventListener("keydown", closeModalOnEscape);
    document.removeEventListener("click", closeModalOnPageClick);
  };

  const closeModalOnPageClick = (e) => {
    const evtTarget = e.target;
    const classListString = Array.from(evtTarget.classList).join();
    if (!classListString.includes("modal")) {
      closeModal();
    }
  };

  const closeModalOnEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };

  document.addEventListener("focus", () => {
    if (!privacyModal.classList.contains("hide-modal"));
    enableDataOptOut();
  });

  const openModal = () => {
    privacyModal.classList.remove("hide-modal");
    document.addEventListener("keydown", closeModalOnEscape);
    enableDataOptOut();
    document.addEventListener("click", closeModalOnPageClick);
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
