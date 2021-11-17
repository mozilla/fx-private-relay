/* global postProfileSubdomain */

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
        events: {
            onSubmit: async (e) => {
                e.preventDefault();

                const currentForm = e.target;
                const requestedDomain = currentForm.querySelector(".js-subdomain-value").value.toLowerCase();
                currentForm.querySelector(".js-subdomain-value").value = requestedDomain;
                const domainCanBeRegistered = await domainRegistration.checkIfDomainIsSafeAndAvailable(requestedDomain);               
                const messages = document.querySelector(".js-notification");
                const messagesHtml = document.querySelector(".js-notification-html");

                if (domainCanBeRegistered) {
                    // Dismiss error state if visible
                    messages?.classList.add("is-hidden"); 
                    messagesHtml?.classList.add("is-hidden");
                    e.target.classList.remove("mzp-is-error");
                    domainRegistration.modal.open(e.target);
                } else {
                    // If the domain cannot be registered, add error state to the form, and display an error message.
                    e.target.classList.add("mzp-is-error")
                    domainRegistration.showError(requestedDomain);
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
                modalSubmit.parentFormRequestedDomain = requestedDomain.value;
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

                const formSubmission = await postProfileSubdomain({
                    "form": e.target.parentFormHTMLElement, 
                    "domain": e.target.parentFormRequestedDomain
                });

                if (formSubmission.status !== "Accepted") {
                    throw new Error();
                }
                
                document.getElementById("mpp-choose-subdomain").classList.add("is-hidden");
                
                switch (e.target.parentFormHTMLElement.id) {
                    case "domainRegistration":
                        domainRegistration.modal.showSuccessState(e.target.parentFormRequestedDomain,{ "form": "dashboard" });
                        break;
                    case "onboardingDomainRegistration":
                        domainRegistration.modal.showSuccessState(e.target.parentFormRequestedDomain, { "form": "onboarding" });
                        break;
                }
                
            },
            showSuccessState: (domain, {form})=> {
                const modalRegistrationForm = document.querySelector(".js-domain-registration-form");
                const modalRegistrationSuccessState = document.querySelector(".js-domain-registration-success");
                modalRegistrationForm.classList.add("is-hidden");
                modalRegistrationSuccessState.classList.remove("is-hidden");

                const domainPreview = document.querySelector(".js-premium-onboarding-domain-registration-preview");
                domainPreview.textContent = domain + ".mozmail.com";

                const modalContinue = document.querySelector(".js-modal-domain-registration-continue");

                if (form === "onboarding") {
                    modalContinue.addEventListener("click", domainRegistration.modal.close, false);
                    
                    const onboardingDomainRegistration = document.querySelector(".js-premium-onboarding-domain-registration-form");
                    onboardingDomainRegistration.classList.add("is-hidden");
                    onboardingDomainRegistration.nextElementSibling.classList.add("is-visible");

                    const dashboardDomainRegistrationPrompt = document.querySelector(".mpp-dashbaord-header-action");
                    dashboardDomainRegistrationPrompt?.classList.add("is-hidden");

                    const onboardingDomainRegistrationActionButtons = document.querySelectorAll(".c-premium-onboarding-action-step-2 button");
                    onboardingDomainRegistrationActionButtons.forEach( button => {
                        button.classList.toggle("is-hidden");
                    });
                }

                if (form === "dashboard") {
                    modalContinue.addEventListener("click", ()=>{
                        location.reload();
                    }, false);
                }




 
            }
        },
        showError: (requestedDomain) => {
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
            let message = messageFluent.dataset.errorSubdomainNotAvailable;
            message = message.replace("REPLACE", requestedDomain); 
            messageWrapperSpan.textContent = message;

            const messagesDismissButton = document.querySelector(".js-dismiss-html");
            messagesDismissButton.addEventListener("click", ()=> {
                messages.classList.add("is-hidden");
            });

        },
        showSuccess: (requestedDomain) => {
            const messages = document.querySelector(".js-notification");
            const messageWrapper = messages.querySelector(".message-wrapper");
            const messageWrapperSpan = messageWrapper.querySelector("span");
            const messageFluent = messages.querySelector("fluent");
            messages.classList.remove("is-hidden");
            messageWrapper.classList.remove("error");
            messageWrapper.classList.add("success");

            // Grab the translated message, replace the domain placeholder with requested domain and post the message. 
            let message = messageFluent.dataset.successSubdomainRegistered;
            message = message.replace("REPLACE", requestedDomain); 
            messageWrapperSpan.textContent = message;

            // Reload the page
            setTimeout(()=>{
                location.reload(); 
            }, 2000);
        }
    }

    document.addEventListener("DOMContentLoaded", ()=>{
        const domainRegistrationForm = document.getElementById("domainRegistration");
        const onboardingDomainRegistrationForm = document.getElementById("onboardingDomainRegistration");

        domainRegistration.init(domainRegistrationForm)
        domainRegistration.init(onboardingDomainRegistrationForm)
    }, false);

})();
