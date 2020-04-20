function dismissNotification(){
	const notification = document.querySelector(".js-notification");
	notification.classList.toggle("hidden");
}

async function toggleEmailForwardingPreferences(submitEvent) {
	submitEvent.preventDefault();
	const toggleForwardingForm = submitEvent.target;

	const formData = {};
	Array.from(toggleForwardingForm.elements).forEach(elem => {
		formData[elem.name] = elem.value;
	})

	const response = await sendForm(toggleForwardingForm.action, formData);

	if (response && response.status == "200") {
		const toggleButton = toggleForwardingForm.querySelector("button");
		toggleButton.classList.toggle("forwarding-disabled");
		if (toggleButton.value === "Enable") {
			return toggleButton.value = "Disable";
		} else if (toggleButton.value === "Disable") {
			return toggleButton.value = "Enable";
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
			},
			credentials: "include",
			mode: "same-origin",
			method: "POST",
			body: JSON.stringify(formData),
		});
	} catch(e) {
		console.log(e)
	}
}


function deleteAliasConfirmation(submitEvent) {
	submitEvent.preventDefault();
	const deleteAliasForm = submitEvent.target;

	const confirmDeleteModal = deleteAliasForm.nextElementSibling;
	confirmDeleteModal.classList.remove("hidden");

	confirmDeleteModalActions = confirmDeleteModal.querySelectorAll("button");
	confirmDeleteModalActions[0].focus();

	confirmDeleteModalActions.forEach(btn => {
		if (btn.classList.contains("cancel-delete")) {
			btn.addEventListener("click", () => {
				confirmDeleteModal.classList.add("hidden");
			});
		}
		if (btn.classList.contains("confirm-delete")) {
			btn.addEventListener("click", () => {
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
	return (sessionStorage && sessionStorage.getItem("addonInstalled", "true"))
}


function showCtas() {
	return document.querySelectorAll(".hero-sign-up-bg.invisible").forEach(buttonWrapper => {
		buttonWrapper.classList.remove("invisible");
	});
}


function hideAddToFxButtons() {
	document.querySelectorAll("a.add-to-fx").forEach(installBtn => {
		installBtn.classList.add("hidden");
	});
	showCtas();
}


function hideSecondarySignInButtons() {
	document.querySelectorAll("a.sign-in-btn").forEach(signInBtn => {
		signInBtn.classList.add("hidden");
	});
	showCtas();
}

function showSecondarySignInButtons() {
	document.querySelectorAll("a.sign-in-btn.hidden").forEach(signInBtn => {
		signInBtn.classList.remove("hidden");
	});
}


function addEventListeners() {
	document.querySelectorAll(".js-dismiss").forEach(btn => {
		btn.addEventListener("click", dismissNotification, false);
	});

	// Email forwarding toggles
	document.querySelectorAll(".email-forwarding-form").forEach(forwardEmailsToggleForm => {
		forwardEmailsToggleForm.addEventListener("submit", toggleEmailForwardingPreferences);
	});

	document.querySelectorAll(".delete-email-form").forEach(deleteForm => {
		deleteForm.addEventListener("submit", deleteAliasConfirmation);
	});
}

// Watch for the addon to update the dataset of <firefox-private-relay-addon></firefox-private-relay-addon>
function watchForInstalledAddon() {
	const installIndicator = document.querySelector("firefox-private-relay-addon");
	const observerConfig = {
		attributes: true
	};

	const patrollerDuties = (mutations, mutationPatroller) => {
		for (let mutation of mutations) {
			if (mutation.type === "attributes" && isRelayAddonInstalled()) {
				hideAddToFxButtons();
				showSecondarySignInButtons();
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
	if (isRelayAddonInstalled()) {
		hideAddToFxButtons();
	} else {
		hideSecondarySignInButtons();
	}
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
		}
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

customElements.define("glocal-menu", GlocalMenu)

new ClipboardJS('.js-copy');
