(function() {
	"use strict";

    if(document.querySelector(".js-server-storage-enabled") === null) {
        // Only store labels on the server when the user has allowed that
        return;
    }

    /** @type {NodeListOf<HTMLFormElement>} */
    const labelForms = document.querySelectorAll(".js-relay-email-address-label-form");

    // TODO: Deduplicate this and the one in settings.js when both are merged in
    /**
     * @param {string} path 
     * @param {RequestInit?} options 
     * @returns {Promise<Response>}
     */
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

    /**
     * @param {HTMLInputElement} labelInputElement 
     * @param {string} aliasId
     * @param {"relay" | "domain"} type
     */
    async function saveLabel(labelInputElement, aliasId, type) {
        const newLabel = labelInputElement.value;
        if (newLabel.trim() === labelInputElement.dataset.label.trim()) {
            // Don't save if the label didn't change
            return;
        }

        const endpoint = type === "relay" ? "/relayaddresses/" : "/domainaddresses/";

        const aliasLabelWrapper = labelInputElement.form.parentElement;
        try {
            const response = await apiRequest(
                `${endpoint}${aliasId}/`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        description: newLabel,
                    }),
                },
            );
            if (!response.ok) {
                throw new Error("Immediately catch'd to show an error message.");
            }
            aliasLabelWrapper.classList.add("show-saved-confirmation");
            labelInputElement.dataset.label = labelInputElement.value;
            setTimeout(() => {
                aliasLabelWrapper.classList.remove("show-saved-confirmation");
            }, 1000);
        } catch(e) {
            const errorMessageElement = labelInputElement.form.querySelector(".js-input-error");
            errorMessageElement.textContent = errorMessageElement.dataset.defaultMessage;
            labelInputElement.classList.add("input-has-error");
            aliasLabelWrapper.classList.add("show-input-error");
        }
    }

    labelForms.forEach(labelForm => {
        /**
         * @type {HTMLInputElement}
         */
        const labelInputElement = labelForm.querySelector(".js-relay-email-address-label");
        const aliasId = labelForm.dataset.aliasId;
        const type = labelForm.dataset.type;

        labelForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            // The label gets saved when blurring:
            labelInputElement.blur();
        });

        labelInputElement.addEventListener("focusout", async () => {
            const isValid = labelForm.reportValidity();
            if (isValid) {
                await saveLabel(labelInputElement, aliasId, type);
            }
        });
        labelInputElement.addEventListener("focus", () => {
            labelInputElement.classList.remove("input-has-error");
            labelForm.parentElement.classList.remove("show-input-error");
        });
    });
})();
