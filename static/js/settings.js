/* global patchProfile */

(function() {
	"use strict";

    const settingsForm = document.querySelector(".js-settings-form");
    const labelCollectionCheckbox = document.querySelector(".js-label-collection");
    const labelCollectionOffWarning = document.querySelector(".js-label-collection-off-warning");
    const saveError = document.querySelector(".js-save-error");

    settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const profileId = settingsForm.dataset.profileId;

        const settings = {
            server_storage: labelCollectionCheckbox.checked,
        };

        try {
            const response = await patchProfile(profileId, settings);
            if (!response.ok) {
                throw new Error("Immediately catch'd to show an error message.");
            }
            // Re-render the page on the server, to make sure all {% if %} statements in the template are rendered correctly:
            document.location = "/accounts/profile/settings_update";
        } catch (e) {
            saveError.classList.remove("hidden");
        }

    });

    labelCollectionCheckbox.addEventListener("change", (event) => {
        if (!event.target.checked) {
            labelCollectionOffWarning.classList.remove("hidden");
        } else {
            labelCollectionOffWarning.classList.add("hidden");
        }
    });
})();
