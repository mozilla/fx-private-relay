function dismissNotification() {
	const notification = document.querySelector(".js-notification");
	notification.classList.toggle("hidden");
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
        prefToggle.title = "Disable email forwarding for this alias";
        toggleLabel.textContent = "forwarding";
        wrappingEmailCard.classList.add("is-enabled");
        return prefToggle.value = "Disable";
      } else if (prefToggle.value === "Disable") {
        prefToggle.title="Enable email forwarding to this alias";
        toggleLabel.textContent = "blocking";
        wrappingEmailCard.classList.remove("is-enabled");
        return prefToggle.value = "Enable";
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
  triggeringEl.title="Alias copied to clipboard";

  setTimeout(() => {
    // When the fade-out animation is done (it takes four seconds),
    // reset the copy button. This avoids the animation getting replayed
    // every time the alias is being hidden and reshown (i.e. when a filter
    // is applied and removed again).
    triggeringEl.classList.remove("alias-copied", "alias-copied-fadeout");
    triggeringEl.title = "Copy alias to clipboard";
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
  const deleteAnywayBtn = confirmDeleteModalActions[1];
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

// Checks for changes made to <firefox-private-relay-addon></firefox-private-relay-add-on> by the addon.
function isRelayAddonInstalled() {
  const installationIndicator = document.querySelector("firefox-private-relay-addon");
	return (installationIndicator.dataset.addonInstalled === "true" || isAddonInstallInLocalStorage());
}


// Looks for previously saved installation note in localStorage
function isAddonInstallInLocalStorage() {
	return (localStorage && localStorage.getItem("fxRelayAddonInstalled"));
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
    document.cookie = "recruited=true; expires=" + date.toUTCString();
  });
}

function addEventListeners() {
  document.querySelectorAll(".js-alias").forEach(aliasCard => {
    const toggleDetailsBtn = aliasCard.querySelector(".js-toggle-details");
    toggleDetailsBtn.addEventListener("click", () => {
      toggleDetailsBtn.classList.toggle("is-active")
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
    });
  }

  const mobileMenuWrapper = document.querySelector(".mobile-menu");
  if (mobileMenuWrapper) {
    const mobileMenuButton = document.querySelector(".mobile-menu-toggle");
    mobileMenuButton.addEventListener("click", () => {
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

  const dashboardBanners = document.querySelector(".dashboard-banners");
  if (!dashboardBanners) {
    return;
  }

  const bg = dashboardBanners.querySelector(".banner-gradient-bg");
  const showBanner = (bannerEl) => {
    setTimeout(()=> {
      bannerEl.classList.remove("hidden");
      dashboardBanners.classList.remove("invisible");
    }, 500);
    return;
  };

  if (!browserIsFirefox) {
    const firefoxBanner = dashboardBanners.querySelector(".download-fx-banner");
    showBanner(firefoxBanner);
    return;
  }
  const relayAddonBanner = dashboardBanners.querySelector(".install-addon-banner");
  return showBanner(relayAddonBanner);
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

//Micro Survey Banner
function dismissSurvey() {
	const survey_banner = document.getElementById("micro-survey-banner");
	survey_banner.classList.toggle("is-hidden");
}

if ( document.getElementById("survey-dismiss") ) {
  document.getElementById("survey-dismiss").addEventListener("click", dismissSurvey, false);
}


