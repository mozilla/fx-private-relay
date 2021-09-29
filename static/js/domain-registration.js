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

            const response = await fetch(requestUrl, {
                method: "get",
                mode: "same-origin",
                credentials: "same-origin",
            });

            // Catch Redirect Failure
            // If the endpoint returns false on a queried subdomain, it means one of two things: 
            //      1. The domain is already registered
            //      2. The domain is on the emails/badwords.txt 
            // 
            // If we know their request is going to fail, we stop trying to catch the submission and let it fail. 
            // This will add a messages cookie with the "Domain Not Available" error and reload the page. 
            if (response.redirected) {
                return false;
            }

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
                const requestedDomainPreviews = document.querySelectorAll(".js-modal-domain-registration-confirmation-domain-preview");
                const requestedDomainPreviewEnding = document.querySelector(".js-modal-domain-registration-confirmation-domain-ending")
                
                // Preview the domain the user requested
                requestedDomainPreviews.forEach(requestedDomainPreview => {
                    requestedDomainPreview.textContent = requestedDomain.value;
                });
                
                // .mozmail.com
                requestedDomainPreviewEnding.textContent = `.${requestedDomain.dataset.domain}`;

                requestedDomainPreviewEnding.parentElement.classList.remove("has-long-domain", "has-very-long-domain");
                if (requestedDomain.value.length > 10) {
                    // The domain is so long that it won't fit side-by side with the suffix
                    // on small screens:
                    requestedDomainPreviewEnding.parentElement.classList.add("has-long-domain");
                }
                if (requestedDomain.value.length > 25) {
                    // The domain name is so long that the name itself won't fit in the modal on small screens
                    requestedDomainPreviewEnding.parentElement.classList.add("has-very-long-domain");
                }

                const modalCancel = document.querySelector(".js-modal-domain-registration-cancel");
                modalCancel.addEventListener("click", domainRegistration.modal.close, false);

                const modalSubmit = document.querySelector(".js-modal-domain-registration-submit");
                modalSubmit.disabled = true;
                modalSubmit.addEventListener("click", domainRegistration.modal.formSubmit, false);

                const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");
                modalConfirmCheckbox.checked = false;
                modalConfirmCheckbox.addEventListener("change", domainRegistration.canModalBeSubmitted, false);

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
                    // Do nothing! 
                    return;
                }   
                
                const modal = document.querySelector(".js-modal-domain-registration-confirmation");
                modal.classList.remove("is-visible");

                document.removeEventListener("keydown", domainRegistration.modal.close, false);

            },
            formSubmit: async () => {
                const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");

                if (!modalConfirmCheckbox.checked) {
                    return false;
                }
               
                const domainRegistrationForm = document.getElementById("domainRegistration");
                domainRegistrationForm.removeEventListener("submit", domainRegistration.events.onSubmit, false);  
                domainRegistrationForm.submit();
                domainRegistration.modal.close();
            },
        }
    }

    document.addEventListener("DOMContentLoaded", domainRegistration.init, false);

})();
