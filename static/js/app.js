function dismissNotification(){
	const notification = document.querySelector(".js-notification");
	notification.classList.toggle("hidden");
}

function toggleEmailForwardingPreferences(submitEvent) {
	submitEvent.preventDefault();
	const toggleForm = submitEvent.target;
	const toggleButton = toggleForm.querySelector("button");

	// The default style of the email forwading toggles is an enabled state.
	// Adding the "forwarding-enabled" class will change them to red and move the toggle to the left.
	toggleButton.classList.toggle("forwarding-disabled");
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
	})
}

document.addEventListener("DOMContentLoaded", () => {
	addEventListeners();
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
