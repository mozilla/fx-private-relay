function dismissNotification(){
	const notification = document.querySelector(".js-notification");
	notification.classList.toggle("hidden");
}

function checkForNotifications() {
	const btn = document.querySelector(".js-dismiss");
	if (btn) {
		btn.addEventListener("click", dismissNotification, false);
	}
}

checkForNotifications();
