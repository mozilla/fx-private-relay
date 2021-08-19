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
                const modal = document.querySelector(".js-modal-domain-registration-confirmaiton");
                modal.classList.add("is-visible");

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
                const modal = document.querySelector(".js-modal-domain-registration-confirmaiton");
                modal.classList.remove("is-visible");

                document.removeEventListener("keydown", domainRegistration.modal.close, false);

            },
        }
    }

    document.addEventListener("DOMContentLoaded", domainRegistration.init, false);

})();
