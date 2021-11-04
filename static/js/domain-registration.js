(function() {
	"use strict";

    // Note: The form in which this function is init on is passed across multiple subfunctions (via event.target and 
    // custom event params). Additionally, based on which form is passed, additional logic/functionality is applied.
    // The two different forms are:
    //  1. Multi-step Onboarding (Step 2) / id: "onboardingDomainRegistration"
    //  2. Dashboard Page (Banner) / id: "domainRegistrationForm"
    
    const domainRegistration = {
        init: (form) => {
            if (form) {
                form.addEventListener("submit", domainRegistration.events.onSubmit, false);  
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
            // if (response.redirected) {
            //     return false;
            // }

            if (!response.ok) {
                return false;
                // const message = `An error has occured: ${response.status}`;
                // throw new Error(message);
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
        fetchPostSubmit: async ({ domain }) => {

            const requestUrl = "/accounts/profile/subdomain";

            const cookieString = typeof document.cookie === "string" ? document.cookie : "";
            const cookieStringArray = cookieString
                .split(";")
                .map(individualCookieString => individualCookieString.split("="))
                .map(([cookieKey, cookieValue]) => [cookieKey.trim(), cookieValue.trim()]);
                
            // Looks like the `argsIgnorePattern` option for ESLint doesn't like array destructuring:
            // eslint-disable-next-line no-unused-vars
            const [_csrfCookieKey, csrfCookieValue] = cookieStringArray.find(([cookieKey, _cookieValue]) => cookieKey === "csrftoken");
            const headers = new Headers();
            headers.set("X-CSRFToken", csrfCookieValue);
            headers.set("Content-Type", " application/x-www-form-urlencoded");
            headers.set("Accept", "application/json");

            const response = await fetch(requestUrl, {
                method: "post",
                headers: headers,
                body: `subdomain=${domain}`
            });

            const status = await response.json();


            return status;
        },

        events: {
            onSubmit: async (e) => {
                e.preventDefault();

                

                const currentForm = e.target;
                const requestedDomain = currentForm.querySelector(".js-subdomain-value").value;
                const domainCanBeRegistered = await domainRegistration.checkIfDomainIsSafeAndAvailable(requestedDomain);               


                if (domainCanBeRegistered) {
                    domainRegistration.modal.open(e.target);
                } else {
                    // If the domain cannot be registered, submit the form to init an error message.
                    const formSubmission = await domainRegistration.fetchPostSubmit({
                        "form": e.target, 
                        "domain": requestedDomain
                    });

                    // e.target.submit();
                }
            }
        },
        modal: {
            open: (form) => {
                const modal = document.querySelector(".js-modal-domain-registration-confirmation");
                modal.classList.add("is-visible");


                const requestedDomain = form.querySelector(".js-subdomain-value");


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
                modalSubmit.parentFormHTMLElement = form;
                modalSubmit.parentFormRequestedDomain = requestedDomain;
                modalSubmit.disabled = true;
                modalSubmit.addEventListener("click", domainRegistration.modal.formSubmitRequest, false);

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
            formSubmitRequest: async (e) => {
                
                const modalConfirmCheckbox = document.querySelector(".js-modal-domain-registration-confirmation-checkbox");

                if (!modalConfirmCheckbox.checked) {
                    return false;
                }

                e.target.parentFormHTMLElement.removeEventListener("submit", domainRegistration.events.onSubmit, false);  

                // Dashboard form: Close the modal
                if (e.target.parentFormHTMLElement.id === "domainRegistration") {
                    // e.target.parentFormHTMLElement.submit();
                    const formSubmission = await domainRegistration.fetchPostSubmit({
                        "form": e.target.parentFormHTMLElement, 
                        "domain": e.target.parentFormRequestedDomain
                    })

                    domainRegistration.modal.close();
                }

                // TODO: Submit form and catch success state changes to the modal for multi-step onboarding form

            },
        }
    }

    document.addEventListener("DOMContentLoaded", ()=>{
        const domainRegistrationForm = document.getElementById("domainRegistration");
        const onboardingDomainRegistrationForm = document.getElementById("onboardingDomainRegistration");

        domainRegistration.init(domainRegistrationForm)
        domainRegistration.init(onboardingDomainRegistrationForm)
    }, false);

})();
