(function() {
	"use strict";

    const domainRegistration = {
        init: () => {
            const domainRegistrationForm = document.getElementById("domainRegistration");

            if (domainRegistrationForm) {
                domainRegistrationForm.addEventListener("submit", domainRegistration.events.onSubmit, false);  
            }
        },
        events: {
            onSubmit: (e) => {
                e.preventDefault();
                console.log("domainRegistration.events.onSubmit");
                domainRegistration.modal.open();
            }
        },
        modal: {
            open: () => {
                const modal = document.querySelector(".js-modal-domain-registration-confirmation");
                modal.classList.add("is-visible");

                const requestedDomain = document.querySelector(".js-subdomain-value");
                const requestedDomainPreview = document.querySelector(".js-modal-domain-registration-confirmation-domain-preview");
                requestedDomainPreview.textContent = requestedDomain.value + "." + requestedDomain.dataset.domain;

                const modalCancel = document.querySelector(".js-modal-domain-registration-cancel");
                modalCancel.addEventListener("click", domainRegistration.modal.close, false);

                const modalSubmit = document.querySelector(".js-modal-domain-registration-submit");
                modalSubmit.addEventListener("click", domainRegistration.modal.submit, false);

                // Close the modal if the user clicks outside the modal
                modal.addEventListener("click", (e) => {
                    if (e.target.classList && e.target.classList.contains("is-visible")) {
                        domainRegistration.modal.close();
                    }
                });

                // Close modal if the user clicks the Escape key
                document.addEventListener("keydown", domainRegistration.modal.close, false);
            },
            close: (e) => {
                if (e && e.key && (e.key !== "Escape")) {
                    console.log(e.key);
                    return;
                }   
                
                console.log("domainRegistration.modal.close()");
                const modal = document.querySelector(".js-modal-domain-registration-confirmation");
                modal.classList.remove("is-visible");

                document.removeEventListener("keydown", domainRegistration.modal.close, false);

            },
            submit: (e) => {
                console.log("domainRegistration.modal.submit()");

                const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");
                if (!modalConfirmCheckbox.checked) {
                    console.log("No checked");
                    return false;
                }

                // modalSubmit.addEventListener("click", domainRegistration.modal.submit, false);
                
                // const domainRegistrationForm = document.getElementById("domainRegistration");
                // domainRegistrationForm.submit();
                domainRegistration.modal.close();
            },
        }
    }

    document.addEventListener("DOMContentLoaded", domainRegistration.init, false);

})();
