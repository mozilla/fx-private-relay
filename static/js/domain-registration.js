(function() {
	"use strict";

    const domainRegistration = {
        init: () => {
            const domainRegistrationForm = document.getElementById("domainRegistration");

            if (domainRegistrationForm) {
                domainRegistrationForm.addEventListener("submit", domainRegistration.events.onSubmit, false);  
            }
        },
        checkIfDomainIsSafeAndAvailable: async (domain)=> {
            if (!domain) {
                throw new Error("No domain submitted.");
            }
            
            const requestUrl = `/accounts/profile/subdomain?subdomain=${domain}`;

            console.log(requestUrl);
            
            const response = await fetch(requestUrl, {
                method: "get",
                mode: 'same-origin',
                credentials: 'same-origin',
            });

           if (!response.ok) {
                const message = `An error has occured: ${response.status}`;
                throw new Error(message);
            }

            const status = await response.json();
            
            return status.available;
        }, 
        canModalBeSubmitted: ()=>{
            const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");
            const modalSubmit = document.querySelector(".js-modal-domain-registration-submit");

            if (!modalConfirmCheckbox.checked) {
                modalSubmit.disabled = true;
                return false;
            }

            modalSubmit.disabled = false;
            return true;
        },
        events: {
            onSubmit: async (e) => {
                e.preventDefault();

                const requestedDomain = document.querySelector(".js-subdomain-value").value;
                const domainCanBeRegistered = await domainRegistration.checkIfDomainIsSafeAndAvailable(requestedDomain);
                
                if (domainCanBeRegistered) {
                    domainRegistration.modal.open();
                } else {
                    // If the domain cannot be registered, submit the form to init an error message.
                    const domainRegistrationForm = document.getElementById("domainRegistration");
                    domainRegistrationForm.submit();
                }
            }
        },
        modal: {
            open: () => {
                const modal = document.querySelector(".js-modal-domain-registration-confirmation");
                modal.classList.add("is-visible");

                const requestedDomain = document.querySelector(".js-subdomain-value");
                const requestedDomainPreview = document.querySelector(".js-modal-domain-registration-confirmation-domain-preview");
                // requestedDomainPreview.textContent = requestedDomain.value + "." + requestedDomain.dataset.domain;
                requestedDomainPreview.textContent = requestedDomain.value;

                const modalCancel = document.querySelector(".js-modal-domain-registration-cancel");
                modalCancel.addEventListener("click", domainRegistration.modal.close, false);

                const modalSubmit = document.querySelector(".js-modal-domain-registration-submit");
                modalSubmit.addEventListener("click", domainRegistration.modal.submit, false);

                const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");
                modalConfirmCheckbox.addEventListener("change", domainRegistration.canModalBeSubmitted, false);

                // Close the modal if the user clicks outside the modal
                modal.addEventListener("click", (e) => {
                    if (e.target.classList && e.target.classList.contains("is-visible")) {
                        domainRegistration.modal.close();
                    }
                });

                // Close modal if the user clicks the Escape key
                document.addEventListener("keydown", domainRegistration.canDomainRegistrationFormBeSubmitted, false);
            },
            close: (e) => {
                if (e && e.key && (e.key !== "Escape")) {
                    // Do nothing! 
                    return;
                }   
                
                const modal = document.querySelector(".js-modal-domain-registration-confirmation");
                modal.classList.remove("is-visible");

                document.removeEventListener("keydown", domainRegistration.modal.close, false);

            },
            submit: (e) => {
                const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");
                if (!modalConfirmCheckbox.checked) {
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
