/* global apiRequest */

(function() {
	"use strict";

    const customAliasPicker = {
        init: () => {
            const triggerButton = document.querySelector(".js-dash-create-new-domain-alias-dialog-trigger");
            triggerButton?.addEventListener("click", customAliasPicker.modal.open, false);
        },
        canModalBeSubmitted: ()=>{
            const modalPrefixInput = document.getElementById("customAliasPrefix");
            const modalSubmit = document.querySelector(".js-modal-custom-alias-picker-submit");

            if (modalPrefixInput.value.length === 0) {
                modalSubmit.disabled = true;
                return false;
            }

            modalSubmit.disabled = false;
            return true;
        },
        modal: {
            /**
             * @param {MouseEvent} triggeringClickEvent 
             */
            open: (triggeringClickEvent) => {
                triggeringClickEvent.preventDefault();
                const modal = document.querySelector(".js-modal-custom-alias-picker");
                modal.classList.add("is-visible");


                const modalCancel = document.querySelector(".js-modal-custom-alias-picker-cancel");
                modalCancel.addEventListener("click", customAliasPicker.modal.close, false);

                const modalSubmit = document.querySelector(".js-modal-custom-alias-picker-submit");
                modalSubmit.disabled = true;
                modalSubmit.addEventListener("click", customAliasPicker.modal.formSubmitRequest, false);

                const modalPrefixInput = document.getElementById("customAliasPrefix");
                modalPrefixInput.focus();
                modalPrefixInput.value = "";
                modalPrefixInput.addEventListener("input", customAliasPicker.canModalBeSubmitted, false);

                // Close the modal if the user clicks outside the modal
                modal.addEventListener("click", (e) => {
                    if (e.target.classList && e.target.classList.contains("is-visible")) {
                        customAliasPicker.modal.close();
                    }
                });

                // Close modal if the user clicks the Escape key
                document.addEventListener("keydown", customAliasPicker.modal.close, false);
            },
            close: (e) => {
                if (e && e.key && (e.key !== "Escape")) {
                    // Do nothing! 
                    return;
                }   
                
                const modal = document.querySelector(".js-modal-custom-alias-picker");
                modal.classList.remove("is-visible");

                document.removeEventListener("keydown", customAliasPicker.modal.close, false);

            },
            formSubmitRequest: async () => {
                
                const modalPrefixInput = document.getElementById("customAliasPrefix");

                if (modalPrefixInput.value.length === 0) {
                    return false;
                }

                const response = await apiRequest("/domainaddresses/", {
                    method: "POST",
                    body: JSON.stringify({
                        enabled: true,
                        address: modalPrefixInput.value,
                    }),
                });
                if (!response.ok) {
                    customAliasPicker.showError();
                    customAliasPicker.modal.close();
                } else {
                    // Display the new alias:
                    document.location.reload();
                }
                
            },
        },
        showError: () => {
            const messagesDjango = document.querySelector(".js-notification");
            const messages = document.querySelector(".js-notification-html");
            const messageWrapper = messages.querySelector(".message-wrapper");
            const messageWrapperSpan = messageWrapper.querySelector("span");
            const messageFluent = messages.querySelector("fluent");
            
            messagesDjango?.classList.add("is-hidden");
            messages.classList.remove("is-hidden");
            messageWrapper.classList.remove("success");
            messageWrapper.classList.add("error");

            // Grab the translated message, replace the domain placeholder with requested domain and post the message. 
            let message = messageFluent.dataset.errorAliasCreation;
            messageWrapperSpan.textContent = message;

            const messagesDismissButton = document.querySelector(".js-dismiss-html");
            messagesDismissButton.addEventListener("click", ()=> {
                messages.classList.add("is-hidden");
            });

        },
    }

    document.addEventListener("DOMContentLoaded", ()=>{
        customAliasPicker.init()
    }, false);

})();
