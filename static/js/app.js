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

function checkForEventTriggeringElements() {
	const btn = document.querySelector(".js-dismiss");
	if (btn) {
		btn.addEventListener("click", dismissNotification, false);
	}

	// Email forwarding toggles
	document.querySelectorAll(".email-forwarding-form").forEach(forwardEmailsToggleForm => {
		forwardEmailsToggleForm.addEventListener("submit", toggleEmailForwardingPreferences);
	});
}

checkForEventTriggeringElements();

new ClipboardJS('.js-copy');
