/* global sendGaPing */

function dismissNotification(){
	const notification = document.querySelector(".js-notification");
	notification.classList.toggle("hidden");
}

if (typeof(sendGaPing) === "undefined") {
  sendGaPing = () => {};
}

async function updateEmailForwardingPrefs(submitEvent) {
	submitEvent.preventDefault();

	const forwardingPrefForm = submitEvent.target;
  const checkBox = forwardingPrefForm.querySelector("button");
  const toggleLabel = forwardingPrefForm.querySelector(".forwarding-label-wrapper");
  const addressId = forwardingPrefForm.querySelector("[name='relay_address_id']");
  const wrappingEmailCard = document.querySelector(`[data-relay-address-id='${addressId.value}'`);

	const analyticsLabel = (checkBox.value === "Disable") ? "User disabled forwarding" : "User enabled forwarding";
	sendGaPing("Dashboard Alias Settings", "Toggle Forwarding", analyticsLabel);

	const formData = {};
	Array.from(forwardingPrefForm.elements).forEach(elem => {
		formData[elem.name] = elem.value;
	});

	const response = await sendForm(forwardingPrefForm.action, formData);

	if (response && response.status === 200) {
		checkBox.classList.toggle("forwarding-disabled");
		if (checkBox.value === "Enable") {
      checkBox.title = "Disable email forwarding for this alias";
      toggleLabel.textContent = "enabled";
      wrappingEmailCard.classList.add("card-enabled");
			return checkBox.value = "Disable";
		} else if (checkBox.value === "Disable") {
      checkBox.title="Enable email forwarding to this alias";
      toggleLabel.textContent = "disabled";
      wrappingEmailCard.classList.remove("card-enabled");
			return checkBox.value = "Enable";
		}
	}
	return;
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

function deleteAliasConfirmation(submitEvent) {
	submitEvent.preventDefault();
	const deleteAliasForm = submitEvent.target;
  const aliasToDelete = deleteAliasForm.dataset.deleteRelay;
  const confirmDeleteModal = document.querySelector(".modal-bg")
  const aliasToDeleteEls = confirmDeleteModal.querySelectorAll(".alias-to-delete");
  aliasToDeleteEls.forEach(addressEl => {
    addressEl.textContent = aliasToDelete;
  })

	confirmDeleteModal.classList.add("show-modal")

	const confirmDeleteModalActions = confirmDeleteModal.querySelectorAll("button");
	confirmDeleteModalActions[0].focus();

  sendGaPing("Dashboard Alias Settings", "Delete Alias", "Delete Alias");


  // Close modal if the user clicks the Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key && e.key === "Escape") {
      confirmDeleteModal.classList.remove("show-modal");
    }
  });

  // Close the modal if the user clicks outside the modal
  confirmDeleteModal.addEventListener("click", (e) => {
    if (e.explicitOriginalTarget.classList.contains("show-modal")) {
      confirmDeleteModal.classList.remove("show-modal");
    }
  });

	confirmDeleteModalActions.forEach(btn => {
		if (btn.classList.contains("cancel-delete")) {
			btn.addEventListener("click", () => {
        sendGaPing("Dashboard Alias Settings", "Delete Alias", "Cancel Delete");
        confirmDeleteModal.classList.remove("show-modal");
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

function wasDashboardInstallationMessageDismissed() {
	return ("sessionStorage" in window && sessionStorage.getItem("hideAddonInstallMessage") === "true");
}


function showCtas() {
	return document.querySelectorAll(".hero-sign-up-bg.invisible").forEach(buttonWrapper => {
		buttonWrapper.classList.remove("invisible");
	});
}

function hideInstallCallout() {
	if ("sessionStorage" in window) {
		sessionStorage.setItem("hideAddonInstallMessage", "true");
	}
	const installCalloutWrapper = document.querySelector(".no-addon-content");
	installCalloutWrapper.classList.add("hidden");
	const createFirstAliasContent = document.querySelector(".create-first-alias");
	createFirstAliasContent.classList.remove("hidden");
}

function toggleVisibilityOfElementsIfAddonIsInstalled() {
	const elementsToShowIfAddonIsInstalled = document.querySelectorAll("a.sign-in-btn");

	if (isRelayAddonInstalled()) { // Private Relay add-on IS installed
		document.querySelectorAll("a.add-to-fx, a.add-to-fx-header").forEach(installCta => {
			installCta.classList.add("hidden");
		});
		elementsToShowIfAddonIsInstalled.forEach(elem => {
			elem.classList.remove("hidden");
		});
	} else { // Private Relay add-on is not installed
		elementsToShowIfAddonIsInstalled.forEach(elem => {
			elem.classList.add("hidden");
		});
	}
	showCtas();

	const dashboardInstallAddonMessage = document.querySelector(".no-addon-content");
	if (
			(dashboardInstallAddonMessage && isRelayAddonInstalled()) ||
			(dashboardInstallAddonMessage && wasDashboardInstallationMessageDismissed())
	) {
		return hideInstallCallout();
	}
	if (dashboardInstallAddonMessage && !wasDashboardInstallationMessageDismissed()) {
		dashboardInstallAddonMessage.classList.remove("hidden");
		const createFirstAliasContent = document.querySelector(".create-first-alias");
		createFirstAliasContent.classList.add("hidden");
		return;
	}
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
  } else {
    aliasCard.style.paddingBottom = "0";
    window.removeEventListener("resize", resizeAliasDetails);
  }
}


function addEventListeners() {
  document.querySelectorAll(".relay-email-card").forEach(aliasCard => {
    const toggleDetailsBtn = aliasCard.querySelector(".toggle-details-visibility");
    toggleDetailsBtn.addEventListener("click", () => { toggleAliasCardDetailsVisibility(aliasCard) });
    const deleteAliasForm = aliasCard.querySelector(".delete-email-form");
    deleteAliasForm.addEventListener("submit", deleteAliasConfirmation);
  });
	document.querySelectorAll(".js-dismiss").forEach(btn => {
		btn.addEventListener("click", dismissNotification, false);
	});

  document.querySelectorAll(".relay-address.click-copy").forEach(clickToCopy => {
    clickToCopy.addEventListener("click", copyToClipboardAndShowMessage);
  });
	// Email forwarding toggles
	document.querySelectorAll(".email-forwarding-form").forEach(forwardEmailsToggleForm => {
		forwardEmailsToggleForm.addEventListener("submit", updateEmailForwardingPrefs);
	});

	document.querySelectorAll(".delete-email-form").forEach(deleteForm => {
		deleteForm.addEventListener("submit", deleteAliasConfirmation);
	});

	document.querySelectorAll(".create-new-relay").forEach(createNewRelayBtn => {
		createNewRelayBtn.addEventListener("click", () => {
			sendGaPing("Create New Relay Alias", "Click", createNewRelayBtn.dataset.analyticsLabel);
		});
	});

	const continueWithoutAddonBtn = document.querySelector(".continue-without-addon");
	if (continueWithoutAddonBtn) {
		continueWithoutAddonBtn.addEventListener("click", hideInstallCallout);
  }

  const joinWaitlistForm = document.querySelector("#join-waitlist-form");
  if (joinWaitlistForm) {
    joinWaitlistForm.addEventListener("submit", addEmailToWaitlist);
  }
}

// Watch for the addon to update the dataset of <firefox-private-relay-addon></firefox-private-relay-addon>
function watchForInstalledAddon() {
	const installIndicator = document.querySelector("firefox-private-relay-addon");
	const observerConfig = {
		attributes: true,
	};

	const patrollerDuties = (mutations, mutationPatroller) => {
		for (const mutation of mutations) {
			if (mutation.type === "attributes" && isRelayAddonInstalled()) {
				toggleVisibilityOfElementsIfAddonIsInstalled();
				if (sessionStorage && !sessionStorage.getItem("addonInstalled", "true")) {
					sessionStorage.setItem("addonInstalled", "true");
				}
				mutationPatroller.disconnect();
			}
		}
	};

	const mutationPatroller = new MutationObserver(patrollerDuties);
	mutationPatroller.observe(installIndicator, observerConfig);
}


document.addEventListener("DOMContentLoaded", () => {
	watchForInstalledAddon();
	addEventListeners();
	toggleVisibilityOfElementsIfAddonIsInstalled();
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
