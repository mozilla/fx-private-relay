/* global sendGaPing */

function dismissNotification() {
	const notification = document.querySelector(".js-notification");
	notification.classList.toggle("hidden");
}


function iterateHeroSlides() {
  let activeSlideNum = 0;
  const heroSlides = document.querySelectorAll(".hero-slide");

  heroSlides[activeSlideNum].classList.add("active-slide");
  const iterateSlides = () => {
    heroSlides[activeSlideNum].classList.remove("active-slide");
    if (activeSlideNum === 4) {
      activeSlideNum = 0;
    } else {
      activeSlideNum++;
    }
    heroSlides[activeSlideNum].classList.add("active-slide");
  };

  window.setInterval(()=> {
    iterateSlides();
  }, 3500);
}


if (typeof(sendGaPing) === "undefined") {
  sendGaPing = () => {};
}

async function updateEmailForwardingPrefs(submitEvent) {
  submitEvent.preventDefault();

  const forwardingPrefForm = submitEvent.target;
  const prefToggle = forwardingPrefForm.querySelector("button");
  const toggleLabel = forwardingPrefForm.querySelector(".forwarding-label-wrapper");
  const addressId = forwardingPrefForm.querySelector("[name='relay_address_id']");
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
        wrappingEmailCard.classList.add("card-enabled");
        return prefToggle.value = "Disable";
      } else if (prefToggle.value === "Disable") {
        prefToggle.title="Enable email forwarding to this alias";
        toggleLabel.textContent = "blocking";
        wrappingEmailCard.classList.remove("card-enabled");
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

function copyToClipboardAndShowMessage(e) {
  const aliasCopyBtn = e.target;
  const aliasToCopy = aliasCopyBtn.dataset.clipboardText;
  const previouslyCopiedAlias = document.querySelector(".alias-copied");
  if (previouslyCopiedAlias) {
    previouslyCopiedAlias.classList.remove("alias-copied");
    previouslyCopiedAlias.title = "Copy alias to clipboard";
  }
  aliasCopyBtn.classList.add("alias-copied");
  aliasCopyBtn.title="Alias copied to clipboard";
  return navigator.clipboard.writeText(aliasToCopy);
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
  const confirmDeleteModal = document.querySelector(".modal-bg");
  const aliasToDeleteEls = confirmDeleteModal.querySelectorAll(".alias-to-delete");
  aliasToDeleteEls.forEach(addressEl => {
    addressEl.textContent = aliasToDelete;
  });

  confirmDeleteModal.classList.add("show-modal");
  trapFocusInModal("delete-modal", true);
  sendGaPing("Dashboard Alias Settings", "Delete Alias", "Delete Alias");
  const checkbox = confirmDeleteModal.querySelector(".checkbox");
  checkbox.focus();

  const closeModal = () => {
    checkbox.checked = false;
    confirmDeleteModal.classList.remove("show-modal");
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
    if (e.target.classList && e.target.classList.contains("show-modal")) {
      closeModal();
    }
  });

  // Enable "Delete Anyway" button once the checkbox has been clicked.
  const confirmDeleteModalActions = confirmDeleteModal.querySelectorAll("button");
  const deleteAnywayBtn = confirmDeleteModalActions[1];
  checkbox.addEventListener("change", (e) => {
    if (checkbox.checked) {
      deleteAnywayBtn.disabled = false;
      return;
    }
    deleteAnywayBtn.disabled = true;
  });

	confirmDeleteModalActions.forEach(btn => {
		if (btn.classList.contains("cancel-delete")) {
			btn.addEventListener("click", () => {
        sendGaPing("Dashboard Alias Settings", "Delete Alias", "Cancel Delete");
        closeModal();
			});
		}
		if (btn.classList.contains("confirm-delete")) {
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
	return (installationIndicator.dataset.addonInstalled === "true" || isAddonInstallInSessionStorage());
}


// Looks for previously saved installation note in sessionStorage
function isAddonInstallInSessionStorage() {
	return (sessionStorage && sessionStorage.getItem("addonInstalled", "true"));
}


async function addEmailToWaitlist(e) {
  e.preventDefault();
  const waitlistForm = e.target;
  const submitBtn = waitlistForm.querySelector(".button");
  const waitlistWrapper = document.querySelector(".invite-only-wrapper");
  waitlistWrapper.classList.add("adding-email");
  submitBtn.classList.add("loading");

  const formData = {
    "csrfmiddlewaretoken": waitlistForm[0].value,
    "email": waitlistForm[1].value,
    "fxa_uid": waitlistForm[2].value,
  };

  try {
    const response = await sendForm(waitlistForm.action, formData);
    if (response && (response.status === 200 || response.status === 201)) {
      setTimeout(()=> {
        waitlistWrapper.classList.add("user-on-waitlist");
        waitlistWrapper.classList.remove("adding-email");
      }, 500);
    } else {
      throw "Response was not 200 or 201";
    }

  }
  catch (e) {
    sendGaPing("Errors", "Join Waitlist", "Join Waitlist");
    waitlistWrapper.classList.add("show-error");
  }

	return;
}


function toggleAliasCardDetailsVisibility(aliasCard) {
  const detailsWrapper = aliasCard.querySelector(".details-wrapper");
  aliasCard.classList.toggle("show-card-details");

  const resizeAliasDetails = () => {
    if (aliasCard.classList.contains("show-card-details")) {
      aliasCard.style.paddingBottom = `${detailsWrapper.clientHeight}px`;
    }
  };

  if (aliasCard.classList.contains("show-card-details")) {
    resizeAliasDetails();
    window.addEventListener("resize", resizeAliasDetails);
    return;
  }
  aliasCard.style.paddingBottom = "0";
  window.removeEventListener("resize", resizeAliasDetails);
}


function addEventListeners() {
  document.querySelectorAll(".relay-email-card").forEach(aliasCard => {
    const toggleDetailsBtn = aliasCard.querySelector(".toggle-details-visibility");
    toggleDetailsBtn.addEventListener("click", () => {
      toggleAliasCardDetailsVisibility(aliasCard);
    });
    const deleteAliasForm = aliasCard.querySelector(".delete-email-form");
    deleteAliasForm.addEventListener("submit", deleteAliasConfirmation);
  });

  document.querySelectorAll(".relay-address.click-copy").forEach(clickToCopy => {
    clickToCopy.addEventListener("click", copyToClipboardAndShowMessage);
  });

  // Email forwarding toggles
	document.querySelectorAll(".email-forwarding-form").forEach(forwardEmailsToggleForm => {
		forwardEmailsToggleForm.addEventListener("submit", updateEmailForwardingPrefs);
  });


  if (window.outerWidth > 550) {
    document.querySelectorAll(".column-blocked").forEach(blockedStatCol => {
      const numBlocked = blockedStatCol.querySelector(".relay-stat-value.num-blocked");
      const blockedDescription = blockedStatCol.querySelector(".blocked-description");
      const blockedText = blockedStatCol.querySelector(".card-small-text");

      [numBlocked, blockedText, blockedDescription].forEach(el => {
        el.addEventListener("mouseover", (e) => {
          blockedDescription.classList.toggle("show-message", !blockedDescription.classList.contains("show-message"));
        });
      });
      blockedStatCol.addEventListener("mouseout", () => {
        blockedDescription.classList.remove("show-message");
      });
    });
  }

	document.querySelectorAll(".create-new-relay").forEach(createNewRelayBtn => {
		createNewRelayBtn.addEventListener("click", () => {
			sendGaPing("Create New Relay Alias", "Click", createNewRelayBtn.dataset.analyticsLabel);
		});
	});

  const joinWaitlistForm = document.querySelector("#join-waitlist-form");
  if (joinWaitlistForm) {
    joinWaitlistForm.addEventListener("submit", addEmailToWaitlist);
  }

  const disabledDashboardButton = document.querySelector(".btn-disabled");
  if (disabledDashboardButton) {
    disabledDashboardButton.addEventListener("click", (e) => {
      e.preventDefault();
    });
  }


  const mobileMenuWrapper = document.querySelector(".mobile-menu");
  if (mobileMenuWrapper) {
    const mobileMenuButton = document.querySelector(".mobile-menu-toggle");
    const mobileMenuLinks = document.querySelector(".mobile-menu-links");
    mobileMenuButton.addEventListener("click", () => {
      mobileMenuWrapper.classList.toggle("menu-open");
      if (mobileMenuWrapper.classList.contains("menu-open")) {
        mobileMenuLinks.style.top = mobileMenuWrapper.clientHeight + "px";
       return mobileMenuWrapper.style.minHeight = mobileMenuLinks.clientHeight + mobileMenuWrapper.clientHeight + "px";
      }
      mobileMenuLinks.style.top = "0";
      return mobileMenuWrapper.style.minHeight = "0";
    });
  }

  document.querySelectorAll(".js-dismiss").forEach(btn => {
		btn.addEventListener("click", dismissNotification, false);
  });

  // If on main landing page
  if (document.querySelector("[data-landing-page]")) {
    iterateHeroSlides();
  }
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
  labelInput.setAttribute("aria-label", `This relay address was created at ${legacyNote}`);
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

	const patrollerDuties = (mutations, mutationPatroller) => {
    for (const mutation of mutations) {
      // handle legacy addon labeling
      if (mutation.type === "childList" && mutation.target.classList.contains("relay-email-address-note")) {
        handleLegacyAddonLabels(mutation.target);
      }
      if (mutation.type === "attributes" && isRelayAddonInstalled()) {
        if (sessionStorage && !sessionStorage.getItem("addonInstalled", "true")) {
          sessionStorage.setItem("addonInstalled", "true");
        }
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
  const relayAddonIsInstalled = isRelayAddonInstalled();
  if (browserIsFirefox && relayAddonIsInstalled) {
    return;
  }

  const dashboardBanners = document.querySelector(".dashboard-banners");
  if (!dashboardBanners) {
    return;
  }

  const bg = dashboardBanners.querySelector(".banner-gradient-bg");
  const showBanner = (bannerEl) => {
    bg.style.minHeight = "101px";
    setTimeout(()=> {
      bannerEl.classList.remove("hidden");
      dashboardBanners.classList.remove("invisible");
    }, 100);
    return;
  };

  if (!browserIsFirefox) {
    const firefoxBanner = dashboardBanners.querySelector(".download-fx-banner");
    showBanner(firefoxBanner);
    return;
  }

  if (!relayAddonIsInstalled) {
    const relayAddonBanner = dashboardBanners.querySelector(".install-addon-banner");
    return showBanner(relayAddonBanner);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  watchForInstalledAddon();
  addEventListeners();

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
