(function() {
	"use strict";

    // TODO Find a way to make this reusable across the app?
    function apiRequest(path, options) {
        const cookieString = typeof document.cookie === "string" ? document.cookie : "";
        const cookieStringArray = cookieString
            .split(";")
            .map(individualCookieString => individualCookieString.split("="))
            .map(([cookieKey, cookieValue]) => [cookieKey.trim(), cookieValue.trim()]);
        // Looks like the `argsIgnorePattern` option for ESLint doesn't like array destructuring:
        // eslint-disable-next-line no-unused-vars
        const [_csrfCookieKey, csrfCookieValue] = cookieStringArray.find(([cookieKey, _cookieValue]) => cookieKey === "csrftoken");
        const headers = new Headers(options ? options.headers : undefined);
        headers.set("X-CSRFToken", csrfCookieValue);
        headers.set("Content-Type", "application/json");
        headers.set("Accept", "application/json");
        return fetch(
            `/api/v1${path}`,
            {
                mode: "same-origin",
                ...options,
                headers: headers,
            },
        );
    }

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

        const response = await apiRequest(
            `/profiles/${profileId}/`,
            {
                method: "PATCH",
                body: JSON.stringify(settings),
            },
        );
        if (response.ok) {
            // Re-render the page on the server, to make sure all {% if %} statements in the template are rendered correctly:
            document.location = "/accounts/profile/settings_update";
            return;
        }

        saveError.classList.remove("hidden");
    });

    labelCollectionCheckbox.addEventListener("change", (event) => {
        if (!event.target.checked) {
            labelCollectionOffWarning.classList.remove("hidden");
        } else {
            labelCollectionOffWarning.classList.add("hidden");
        }
    });
})();
