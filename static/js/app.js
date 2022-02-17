/* global patchProfile */

function dismissNotification() {
	const notification = document.querySelector(".js-notification");
	notification.classList.add("is-hidden");
}

if (typeof(sendGaPing) === "undefined") {
  sendGaPing = () => {};
}

async function updateEmailForwardingPrefs(submitEvent) {
  submitEvent.preventDefault();

  const forwardingPrefForm = submitEvent.target;
  const prefToggle = forwardingPrefForm.querySelector("button");
  const toggleLabel = forwardingPrefForm.querySelector(".forwarding-label-wrapper");
  const addressId = forwardingPrefForm.querySelector("[name='relay_address_id']") || forwardingPrefForm.querySelector("[name='domain_address_id']");
  const wrappingEmailCard = document.querySelector(`[data-relay-address-id='${addressId.value}']`);

  const analyticsLabel = (prefToggle.value === "Disable") ? "User disabled forwarding" : "User enabled forwarding";
  sendGaPing("Dashboard Alias Settings", "Toggle Forwarding", analyticsLabel);

  const formData = {};
  Array.from(forwardingPrefForm.elements).forEach(elem => {
    formData[elem.name] = elem.value;
  });

  try {
    const response = await sendForm(forwardingPrefForm.action, formData);
    if (response && response.status === 200) {
      prefToggle.classList.toggle("forwarding-disabled");
      if (prefToggle.value === "Enable") {
        prefToggle.title = prefToggle.dataset.defaultBlockingTitle;
        toggleLabel.textContent = toggleLabel.dataset.defaultForwardingLabel;
        wrappingEmailCard.classList.add("is-enabled");
        prefToggle.value = "Disable";
        return;
      } else if (prefToggle.value === "Disable") {
        prefToggle.title = prefToggle.dataset.defaultForwardingTitle;
        toggleLabel.textContent = toggleLabel.dataset.defaultBlockingLabel;
        wrappingEmailCard.classList.remove("is-enabled");
        prefToggle.value = "Enable";
        return;
      }
    }
  } catch(e) {
    const siteOrigin = document.body.dataset.siteOrigin;
    const signInUrl = new URL("/accounts/fxa/login/?process=login", siteOrigin);
    return window.location = signInUrl.href;
  }
}

async function sendForm(formAction, formData) {
  // eslint-disable-next-line no-useless-catch
  try {
    return fetch(formAction, {
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": formData.csrfmiddlewaretoken,
      },
      credentials: "include",
      mode: "same-origin",
      method: "POST",
      body: JSON.stringify(formData),
    });
  } catch(e) {
    throw e;
	}
}

function copyToClipboardAndShowMessage(triggeringEl) {
  triggeringEl.classList.add("alias-copied", "alias-copied-fadeout");
  triggeringEl.title = triggeringEl.dataset.ftlCopyConfirmation;

  setTimeout(() => {
    // When the fade-out animation is done (it takes four seconds),
    // reset the copy button. This avoids the animation getting replayed
    // every time the alias is being hidden and reshown (i.e. when a filter
    // is applied and removed again).
    triggeringEl.classList.remove("alias-copied", "alias-copied-fadeout");
    triggeringEl.title = triggeringEl.dataset.ftlClickToCopy;
  }, 4 * 1000);
  
  

  return;
}


function trapFocusInModal(modalElemClass, restrictFocusToModal=true) {
  if (!restrictFocusToModal) {
    return document.querySelectorAll("[tabindex='-1']").forEach(elem => {
      elem.tabIndex = "0";
    });
  }
  document.querySelectorAll("input, a, button, [tabindex]").forEach(elem => {
    if (!elem.classList.contains(modalElemClass)) {
      elem.tabIndex = "-1";
    }
  });
}

function deleteAliasConfirmation(submitEvent) {
	submitEvent.preventDefault();
	const deleteAliasForm = submitEvent.target;
  const aliasToDelete = deleteAliasForm.dataset.deleteRelay;
  const confirmDeleteModal = document.querySelector(".js-modal-delete-alias");
  const aliasToDeleteEls = confirmDeleteModal.querySelectorAll(".js-alias-to-delete");
  const relayWarning = document.querySelector(".js-relay-address-warning");
  const domainWarning = document.querySelector(".js-domain-address-warning");
  if (deleteAliasForm.dataset.type === "domain") {
    relayWarning.classList.add("is-hidden");
    domainWarning.classList.remove("is-hidden");
  } else {
    relayWarning.classList.remove("is-hidden");
    domainWarning.classList.add("is-hidden");
  }
  aliasToDeleteEls.forEach(addressEl => {
    addressEl.textContent = aliasToDelete;
  });

  // Show alias email address in delete warning modal
  const aliasToDeleteLabel = confirmDeleteModal.querySelector(".modal-message strong");
  aliasToDeleteLabel.textContent = aliasToDelete;

  confirmDeleteModal.classList.add("is-visible");
  trapFocusInModal("delete-modal", true);
  sendGaPing("Dashboard Alias Settings", "Delete Alias", "Delete Alias");
  const checkbox = confirmDeleteModal.querySelector(".js-modal-delete-alias-checkbox");
  checkbox.focus();

  const closeModal = () => {
    const deleteAnywayBtn = confirmDeleteModal.querySelector(".js-modal-delete-confirm-delete");
    deleteAnywayBtn.disabled = true;
    checkbox.checked = false;
    confirmDeleteModal.classList.remove("is-visible");
    trapFocusInModal("delete-modal", false);
  };

  // Close modal if the user clicks the Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key && e.key === "Escape") {
      closeModal();
    }
  });

  // Close the modal if the user clicks outside the modal
  confirmDeleteModal.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("is-visible")) {
      closeModal();
    }
  });

  // Enable "Delete Anyway" button once the checkbox has been clicked.
  const confirmDeleteModalActions = confirmDeleteModal.querySelectorAll("button");
  const deleteAnywayBtn = confirmDeleteModal.querySelector(".js-modal-delete-confirm-delete");
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      deleteAnywayBtn.disabled = false;
      return;
    }
    deleteAnywayBtn.disabled = true;
  });

	confirmDeleteModalActions.forEach(btn => {
		if (btn.classList.contains("js-modal-delete-cancel")) {
			btn.addEventListener("click", () => {
        sendGaPing("Dashboard Alias Settings", "Delete Alias", "Cancel Delete");
        closeModal();
			});
		}
		if (btn.classList.contains("js-modal-delete-confirm-delete")) {
			btn.addEventListener("click", () => {
				sendGaPing("Dashboard Alias Settings", "Delete Alias", "Confirm Delete");
				deleteAliasForm.submit();
			});
		}
	});
}

function toggleAliasCardDetailsVisibility(aliasCard) {
  const detailsWrapper = aliasCard.querySelector(".js-alias-details");
  detailsWrapper.classList.toggle("is-visible");
}

function recruitmentLogic() {
  const recruitmentBannerLink = document.querySelector("#recruitment-banner");
  if (!recruitmentBannerLink) {
    return;
  }

  const recruited = document.cookie.split("; ").some((item) => item.trim().startsWith("recruited="));
  if (recruited) {
    recruitmentBannerLink.parentElement.remove();
    return;
  }

  recruitmentBannerLink.addEventListener("click", () => {
    const date = new Date();
    date.setTime(date.getTime() + 30*24*60*60*1000)
    document.cookie = "recruited=true; expires=" + date.toUTCString() + "; path=/";
  });

  const recruitmentDismissButton = document.querySelector("#recruitment-dismiss");
  recruitmentDismissButton.addEventListener("click", () => {
    recruitmentBannerLink.parentElement.remove();
    const date = new Date();
    date.setTime(date.getTime() + 30*24*60*60*1000)
    document.cookie = "recruited=true; expires=" + date.toUTCString() + "; path=/";
  });
}


function addEventListeners() {
  document.querySelectorAll(".js-alias").forEach(aliasCard => {
    const toggleDetailsBtn = aliasCard.querySelector(".js-toggle-details");

    toggleDetailsBtn.addEventListener("click", () => {
      toggleDetailsBtn.classList.toggle("is-active");
      toggleAliasCardDetailsVisibility(aliasCard);
    });

    const deleteAliasForm = aliasCard.querySelector(".delete-email-form");
    deleteAliasForm.addEventListener("submit", deleteAliasConfirmation);
  });

  // Email forwarding toggles
	document.querySelectorAll(".email-forwarding-form").forEach(forwardEmailsToggleForm => {
		forwardEmailsToggleForm.addEventListener("submit", updateEmailForwardingPrefs);
  });

  const generateAliasForm = document.querySelector(".dash-create");


  if (generateAliasForm) {

    generateAliasForm.addEventListener("submit", (e) => {

      e.preventDefault();
      const submitBtn = generateAliasForm.querySelector("button[type='submit']");
      if (submitBtn.classList.contains("btn-disabled")) {
        sendGaPing("Generate New Alias", "Engage", "btn-disabled");
        return;
      }

      sendGaPing("Generate New Alias", "Engage", "btn-enabled");
    
      e.target.submit();
      localStorage.setItem("generateBtn", "True");
    });

    const checkGenerateBtnState = localStorage.getItem("generateBtn");

    if (checkGenerateBtnState === "True") {
      const aliasCard = document.querySelector(".js-alias");
      const toggleDetailsBtn = aliasCard.querySelector(".js-toggle-details");
      toggleAliasCardDetailsVisibility(aliasCard);
      toggleDetailsBtn.classList.toggle("is-active");
      localStorage.removeItem("generateBtn");
    }

  }

  const generateAliasMenuTrigger = document.querySelector(".js-dash-create-new-alias-menu-trigger ");
  const generateAliasMenuPopup = document.querySelector(".js-dash-create-new-alias-menu-popup ");

  generateAliasMenuTrigger?.addEventListener("click", (e) => {
    e.preventDefault();
    generateAliasMenuPopup.classList.toggle("is-hidden");
  });

  function moveDownMainContainer(setMenuLinksHeightVal) {
    const mainWrapper = document.querySelector("main");
    const moveDownBy = parseInt(setMenuLinksHeightVal, 10);

    if (!mainWrapper.style.marginTop || mainWrapper.style.marginTop === "0px") {
      mainWrapper.style.marginTop = moveDownBy + "px";
    }

    else {
      mainWrapper.style.marginTop = 0;
    }
  }

  const mobileMenuWrapper = document.querySelector(".mobile-menu");
  if (mobileMenuWrapper) {

    const mobileMenuWrapperLinks = document.querySelector(".mobile-menu-links");
    const mobileMenuButton = document.querySelector(".mobile-menu-toggle");
   
    mobileMenuButton.addEventListener("click", () => {
      // mobileMenuWrapper.classList.toggle("menu-open");
  
      setTimeout(() => {
        const mobileMenuWrapperLinksHeight = mobileMenuWrapperLinks.offsetHeight;
        moveDownMainContainer(mobileMenuWrapperLinksHeight);
      }, 100);

      mobileMenuWrapper.classList.toggle("menu-open");
     });

  }

  document.querySelectorAll(".js-dismiss").forEach(btn => {
		btn.addEventListener("click", dismissNotification, false);
  });
}

function hasParent(el, selector) {
  while (el.parentElement) {
    el = el.parentElement;
    if (el.classList.contains(selector)) {
      return el;
    }
  }
  return null;
}


function handleLegacyAddonLabels(legacyNoteElem) {
  const legacyNote = legacyNoteElem.textContent;
  const parentRelayAddressEl = hasParent(legacyNoteElem, "relay-email");
  const labelWrapper = parentRelayAddressEl.querySelector(".additional-notes");
  labelWrapper.classList.add("legacy-addon-show-label");

  const labelInput = labelWrapper.querySelector(".relay-email-address-label");
  labelInput.value = legacyNote;
  labelInput.setAttribute("aria-label", `This Relay alias was created at ${legacyNote}`);
  labelInput.setAttribute("readonly", "readonly");
  return;
}

// Watch for the addon to update the dataset of <firefox-private-relay-addon></firefox-private-relay-addon>
// and watch for older versions of the addon populating alias labels into .relay-email-address note els
function watchForInstalledAddon() {
  const watchedEls = document.querySelectorAll("firefox-private-relay-addon, .relay-email-address-note");
  const observerConfig = {
    attributes: true,
    childList: true, // catches legacy addons modifying .relay-email-address-note els
	};

  const patrollerDuties = (mutations) => {
    for (const mutation of mutations) {
      // handle legacy addon labeling
      if (mutation.type === "childList" && mutation.target.classList.contains("relay-email-address-note")) {
        handleLegacyAddonLabels(mutation.target);
      }
    }
	};

  const mutationPatroller = new MutationObserver(patrollerDuties);
  watchedEls.forEach(watchedEl => {
    mutationPatroller.observe(watchedEl, observerConfig);
  });
}


function showBannersIfNecessary() {
  if (window.clientWidth < 750) {
    return;
  }

  const browserIsFirefox = /firefox|FxiOS/i.test(navigator.userAgent);

  if (!browserIsFirefox) {
    const firefoxBanner = document.querySelector(".download-fx-banner");
    firefoxBanner.classList.remove("hidden");
    // Used to show/hide add-on download prompts in onboarding
    document.getElementById("profile-main").classList.add("is-not-addon-compatible")

    return;
  }
  if (browserIsFirefox) {
    const addonBanner = document.querySelector(".install-addon-banner");
    addonBanner.classList.remove("hidden");
  }
}

function setTranslatedStringLinks() {
  const links = document.querySelectorAll(".js-set-href a");

  for (const link of links) {
    const url = link.dataset.url;
    link.href = url;
    link.classList.add("text-link");
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }

}

document.addEventListener("DOMContentLoaded", () => {
  watchForInstalledAddon();
  addEventListeners();
  vpnBannerLogic();
  setTranslatedStringLinks();
  premiumOnboardingLogic();
  privacyNoticeUpdateBannerLogic();
  dataCollectionBannerLogic();
  scrollToSubdomainRegistrationAndShowErrorState();
  premiumOnboarding.init();

  // TODO: Set up language gate once l10n is active.
  // const preferredLanguages = navigator.languages;
  // // Only display if primary preferred language is English
  // if (preferredLanguages[0].includes("en")) {
  //   vpnBannerLogic();
  // }

  const win = window;
  const header = document.querySelector("header");

  const setHeader = (yOffset) => {
    if (yOffset > 300) {
      header.classList.add("fix-header");
      return;
    }
    header.classList.remove("fix-header");
  };

  setHeader(win.pageYOffset);
  win.onscroll = () => {
    if (win.pageYOffset > 400) {
      return;
    }
    setHeader(win.pageYOffset);
  };
  showBannersIfNecessary();

  recruitmentLogic();
});

class GlocalMenu extends HTMLElement {
	constructor() {
		super();
	}

	async connectedCallback() {
		this._avatar = this.querySelector(".avatar-wrapper");
		this._avatar.addEventListener("click", this);
		this._active = false;
		this._menu = this.querySelector(".glocal-menu-wrapper");

		document.addEventListener("bento-was-opened", this);
		const fxBento = document.querySelector("firefox-apps");

		this.closeBentoIfOpen = () => {
			if (fxBento._active) {
				const closeBentoEvent = new Event("close-bento-menu");
				fxBento.dispatchEvent(closeBentoEvent);
			}
		};

		this.closeGlocalMenu = () => {
			this._active = false;
			this._menu.classList.remove("glocal-menu-open");
			this._menu.classList.add("fx-bento-fade-out");
			window.removeEventListener("click", this.closeGlocalMenu);
			setTimeout(() => {
				this._menu.classList.remove("fx-bento-fade-out");
			}, 500);
			return;
		};

		this.openGlocalMenu = (evt) => {
			this._active = true;
			this.closeBentoIfOpen();
			evt.stopImmediatePropagation();
			this._menu.classList.add("glocal-menu-open");
			window.addEventListener("click", this.closeGlocalMenu);

      return;
		};
	}

	handleEvent(event) {
		const bentoIsOpening = event.type === "bento-was-opened";
		// Close the Glocal Menu if the Bento Menu is opening
		if (bentoIsOpening && this._active) {
			return this.closeGlocalMenu();
		}
		if (bentoIsOpening) {
			return;
		}

		if (this._active) {
			return this.closeGlocalMenu(event);
		}
		this.openGlocalMenu(event);
	}
}

customElements.define("glocal-menu", GlocalMenu);
const copyAliasBtn = new ClipboardJS(".relay-address");


copyAliasBtn.on("success", (e) => {
  copyToClipboardAndShowMessage(e.trigger);
});

function vpnBannerLogic() {

  // Check if element exists at all
  const vpnPromoBanner = document.getElementById("vpnPromoBanner");

  if (!vpnPromoBanner) {
    return;
  }

  // Check for dismissal cookie
  const vpnBannerDismissedCookie = document.cookie.split("; ").some((item) => item.trim().startsWith("vpnBannerDismissed="));

  if (vpnBannerDismissedCookie) {
    return;
  }

  // Init: Show banner, set close button listener
  const vpnPromoCloseButton = document.getElementById("vpnPromoCloseButton");
  const vpnPromoCtaButton = document.querySelector(".vpn-promo-cta");

  const vpnPromoFunctions = {
    hide: function() {
      vpnPromoFunctions.setCookie();
      vpnPromoBanner.classList.add("closed");
      document.body.classList.remove("vpn-banner-visible");
      sendGaPing("VPN Promo Banner", "Dismiss Banner", "Dismiss Banner");
    },
    init: function() {
      vpnPromoCloseButton.addEventListener("click", vpnPromoFunctions.hide);
      vpnPromoCtaButton.addEventListener("click", ()=>{
        sendGaPing("VPN Promo Banner", "CTA Click", "CTA Click");
      });
      vpnPromoFunctions.show();
    },
    setCookie: function() {
      const date = new Date();
      date.setTime(date.getTime() + 30*24*60*60*1000);
      document.cookie = "vpnBannerDismissed=true; expires=" + date.toUTCString() + "; path=/";
    },
    show: function() {
      vpnPromoBanner.classList.remove("closed");
      document.body.classList.add("vpn-banner-visible");
      sendGaPing("VPN Promo Banner", "Show Banner", "Show Banner");
    },
  };

  vpnPromoFunctions.init();
}

function premiumOnboardingLogic() {
  // Check if element exists at all
  const premiumOnboardingContent = document.getElementById("premiumOnboarding");

  if (!premiumOnboardingContent) {
    return;
  }

  // Check for dismissal cookie
  const premiumOnboardingDismissedCookie = document.cookie
    .split("; ")
    .some((item) => item.trim().startsWith("premiumOnboarding="));

  if (premiumOnboardingDismissedCookie) {
    return;
  }

  // Init: Show banner, set close button listener
  const premiumOnboardingCloseButton = document.querySelector(
    ".js-premium-onboarding-dismiss"
  );

  const premiumOnboardingFunctions = {
    hide: function () {
      premiumOnboardingFunctions.setCookie();
      premiumOnboardingContent.classList.add("is-hidden");
    },
    init: function () {
      premiumOnboardingCloseButton.addEventListener(
        "click",
        premiumOnboardingFunctions.hide
      );
      premiumOnboardingFunctions.show();
    },
    setCookie: function () {
      const date = new Date();
      date.setTime(date.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie =
        "premiumOnboarding=true; expires=" + date.toUTCString() + "; path=/";
    },
    show: function () {
      premiumOnboardingContent.classList.remove("is-hidden");
    },
  };

  premiumOnboardingFunctions.init();
}

function privacyNoticeUpdateBannerLogic() {
  // Check if element exists at all
  const privacyNoticeUpdateBanner = document.getElementById("privacy-notice-update");

  if (!privacyNoticeUpdateBanner) {
    return;
  }

  // Check for dismissal cookie
  const privacyNoticeUpdateBannerDismissedCookie = document.cookie
    .split(";")
    .some((item) => item.trim().startsWith("privacyNoticeUpdateBanner="));

  if (privacyNoticeUpdateBannerDismissedCookie) {
    return;
  }

  // Init: Show banner, set close button listener
  const privacyNoticeUpdateBannerCloseButton = document.querySelector(
    ".js-privacy-notice-update-dismiss"
  );

  const privacyNoticeUpdateBannerFunctions = {
    hide: function () {
      privacyNoticeUpdateBannerFunctions.setCookie();
      privacyNoticeUpdateBanner.classList.add("is-hidden");
    },
    init: function () {
      privacyNoticeUpdateBannerCloseButton.addEventListener(
        "click",
        privacyNoticeUpdateBannerFunctions.hide
      );
      privacyNoticeUpdateBannerFunctions.show();
    },
    setCookie: function () {
      const date = new Date();
      date.setTime(date.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie =
        "privacyNoticeUpdateBanner=true; expires=" + date.toUTCString() + "; path=/";
    },
    show: function () {
      privacyNoticeUpdateBanner.classList.remove("is-hidden");
    },
  };

  privacyNoticeUpdateBannerFunctions.init();
}

function dataCollectionBannerLogic() {
  
  // Check if element exists at all
  const dataCollectionBanner = document.getElementById("sync-labels");

  if (!dataCollectionBanner) {
    return;
  }

  // Check for dismissal cookie
  const dataCollectionBannerDismissedCookie = document.cookie
    .split("; ")
    .some((item) => item.trim().startsWith("syncLabelsBanner="));

  if (dataCollectionBannerDismissedCookie) {
    return;
  }

  // Init: Show banner, set close button listener
  const dataCollectionCloseButton = document.querySelector(
    ".js-data-collection-dismiss"
  );

  const dataCollectionBannerFunctions = {
    hide: function () {
      dataCollectionBannerFunctions.setCookie();
      dataCollectionBanner.classList.add("is-hidden");
    },
    init: function () {
      dataCollectionCloseButton.addEventListener(
        "click",
        dataCollectionBannerFunctions.hide
      );
      dataCollectionBannerFunctions.show();
    },
    setCookie: function () {
      const date = new Date();
      date.setTime(date.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie =
        "syncLabelsBanner=true; expires=" + date.toUTCString() + "; path=/";
    },
    show: function () {
      dataCollectionBanner.classList.remove("is-hidden");
    },
  };

  dataCollectionBannerFunctions.init();
}

//Micro Survey Banner
function dismissSurvey() {
	const survey_banner = document.getElementById("micro-survey-banner");
	survey_banner.classList.toggle("is-hidden");
  const date = new Date();
  date.setTime(date.getTime() + 30*24*60*60*1000)
  document.cookie = "surveyed=true; expires=" + date.toUTCString() + "; path=/";
}

if ( document.getElementById("survey-dismiss") ) {
  document.getElementById("survey-dismiss").addEventListener("click", dismissSurvey, false);
}


//Landing page use case accordion
const useCaseSection = document.getElementById("use-cases");
const useCaseTitle = document.querySelectorAll(".use-case-title");

function toggleClass(elem) {
   useCaseTitle.forEach( item => {
      item.classList.remove("is-active");
  });
  useCaseSection.scrollIntoView();
  elem.target.classList.add("is-active");
  window.location.hash = "#use-cases" + "/" + elem.target.dataset.useCase;
}

function resetAccordianAndSetActiveSection(useCaseName) {
  const urlHash = location.hash;
    if (urlHash.includes(useCaseName)){
      useCaseTitle.forEach( item => {
        item.classList.remove("is-active");
      });
      document.querySelector(".use-case-" + useCaseName).classList.add("is-active");
    }
}

function hashChangeAccordion(){
  const urlHash = location.hash;

  if (urlHash.includes("#use-cases")){
    useCaseSection.scrollIntoView();

    resetAccordianAndSetActiveSection("shopping");
    resetAccordianAndSetActiveSection("social-networks");
    resetAccordianAndSetActiveSection("offline");
    resetAccordianAndSetActiveSection("access-content");
    resetAccordianAndSetActiveSection("gaming");
  }
}

hashChangeAccordion();

window.onhashchange = hashChangeAccordion;

useCaseTitle.forEach( item => {
    item.addEventListener("click", toggleClass, false);
});

//Landing page accordion remove box shadow
function removeBoxShadow(elem) {
  useCaseTitle.forEach( item => {
     item.classList.remove("remove-box-shadow");
 });
 elem.target.classList.add("remove-box-shadow");
}

useCaseTitle.forEach( item => {
   item.addEventListener("click", removeBoxShadow, false);
});

function scrollToSubdomainRegistrationAndShowErrorState() {
  if (!document.querySelector(".message-wrapper.error")) {
    return;
  }
  
  const subdomainRegistrationBannerForm = document.getElementById("domainRegistration");
  subdomainRegistrationBannerForm.classList.add("mzp-is-error");
  // const subdomainRegistrationBanner = document.getElementById("mpp-choose-subdomain");
  // subdomainRegistrationBanner.scrollIntoView({ block: "center" });
}
//FAQ Accordion 
const faqQuestion = document.querySelectorAll(".c-faq-question");

function showFAQAnswer(elem) {
  const expandButton = elem.querySelector("button");
  if (expandButton.getAttribute("aria-expanded") === "true") {
    expandButton.setAttribute("aria-expanded", "false");
    document.getElementById(expandButton.getAttribute("aria-controls")).hidden = true;
    return;
  }

  faqQuestion.forEach(item => {
    const expandButton = item.querySelector("button");
    expandButton.setAttribute("aria-expanded", "false");
    document.getElementById(expandButton.getAttribute("aria-controls")).hidden = true;
  });

  expandButton.setAttribute("aria-expanded", "true");
  document.getElementById(expandButton.getAttribute("aria-controls")).hidden = false;
}

faqQuestion.forEach(item => {
  const expandButton = item.querySelector("button");
  expandButton.addEventListener("click", () => showFAQAnswer(item), false);
});

// Multi-part Premium Onboarding
const premiumOnboarding = {
  init: ()=> {
    
    const profileMain = document.getElementById("profile-main");

    if (!profileMain || !profileMain.classList.contains("is-premium-onboarding")) {
      return;
    }
    
    const mppoNextButtons = document.querySelectorAll(
      ".js-premium-onboarding-next-step"
    );

    mppoNextButtons.forEach((button) => {
      button.addEventListener("click", premiumOnboarding.next, false);
    });

    const mppoQuitButtons = document.querySelectorAll(
      ".js-premium-onboarding-quit-step"
    );

    mppoQuitButtons.forEach((button) => {
      button.addEventListener("click", premiumOnboarding.quit, false);
    });

    const mppoSkipButton = document.querySelector(".js-premium-onboarding-skip-step");
    mppoSkipButton.addEventListener("click", premiumOnboarding.quit, false);
    
  },
  next: async ()=> {   

    // Grab data necessary to update settings:onboarding_state value
    const onboardingContainer = document.querySelector(".c-multipart-premium-onboarding");
    const mainContainer = document.getElementById("profile-main");
    const profileId = mainContainer.dataset.profileId;
    let currentOnboardingState = parseInt(onboardingContainer.dataset.onboardingCompletedStep, 10);
    
    // Bump onboarding to next interger
    currentOnboardingState++

    const profileData = {
      onboarding_state: currentOnboardingState,
    };

    // Show next step content
    const activeOnboardingSlide = document.querySelector(".c-premium-onboarding-step.is-visible");
    activeOnboardingSlide.classList.remove("is-visible");
    activeOnboardingSlide.nextElementSibling.classList.add("is-visible");
    
    // Show next step buttons
    const activeOnboardingActions = document.querySelector(".c-premium-onboarding-actions.is-visible");
    activeOnboardingActions.classList.remove("is-visible");
    activeOnboardingActions.nextElementSibling.classList.add("is-visible");
        
    // Update progress bar
    const activeOnboardingProgressSlides = document.querySelectorAll(".c-premium-onboarding-progress-bar-item.is-completed");
    // Get most recent "completed" progress bar section
    const activeOnboardingProgressSlide = activeOnboardingProgressSlides[activeOnboardingProgressSlides.length - 1];
    activeOnboardingProgressSlide.nextElementSibling.classList.add(
      "is-completed"
    );

    try {
        const response = await patchProfile(profileId, profileData);
        if (!response.ok) {
            throw new Error("Immediately catch'd to show an error message.");
        }
        
        // Update DOM data-set for future usage
        onboardingContainer.dataset.onboardingCompletedStep = currentOnboardingState;
        
    } catch (e) {
        // saveError.classList.remove("hidden");
    }

  },
  quit: async (e)=> {
     
    if (e.target.classList.contains("js-premium-onboarding-skip-step")) {
      const onboardingContainer = document.querySelector(".c-multipart-premium-onboarding");
      const onboardingCurrentStep = parseInt(onboardingContainer.dataset.onboardingCompletedStep, 10) + 1;
      sendGaPing("Premium Onboarding", "Engage", "onboarding-skip", onboardingCurrentStep);
    }

    const onboardingContainer = document.querySelector(".c-multipart-premium-onboarding");
    let maxOnboardingState = parseInt(onboardingContainer.dataset.maxOnboardingAvailable, 10);
    
    const mainContainer = document.getElementById("profile-main");
    mainContainer.classList.remove("is-premium-onboarding");
    
    const profileId = mainContainer.dataset.profileId;
    const profileData = {
      onboarding_state: maxOnboardingState,
    };

    try {
        const response = await patchProfile(profileId, profileData);
        if (!response.ok) {
            throw new Error("Immediately catch'd to show an error message.");
        }
    } catch (e) {
        // saveError.classList.remove("hidden");
    }
    
  },
}
