(function() {
	"use strict";

    if(document.querySelectorAll(".c-alias").length === 0) {
        // If there are no aliases, there's nothing to filter:
        return;
    }

    const filterContainer = document.querySelector(".js-filter-container");
    const filterSearchForm = document.querySelector(".js-filter-search-form");
    const filterSearchInput = document.querySelector(".js-filter-search-input");
    const filterResetButton = document.querySelector(".js-filter-reset")
    const filterLabelVisibleCases = document.querySelector(".js-filter-case-visible");
    const filterLabelTotalCases = document.querySelector(".js-filter-case-total");
    const filterToggleSearchInput = document.querySelector(".js-filter-mobile-search-toggle");
    const filterToggleCategoryInput = document.querySelector(".js-filter-category-toggle");
    const filterCategoryWrapper = document.querySelector(".c-filter-category");
    const filterCategoryCheckboxes = document.querySelectorAll(".js-filter-category-checkbox");

    let activeSearchFilter = filterSearchInput.value;
    let activeCategoryFilters = Array.from(filterCategoryCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.dataset.categoryType);

    function applyFilters() {
        const aliasContainers = Array.from(document.querySelectorAll(".c-alias"));

        aliasContainers.forEach(aliasContainer => {
            const emailAddress = aliasContainer.dataset.relayAddress;
            const labelElement = aliasContainer.querySelectorAll(".relay-email-address-label")[0];
            const label = labelElement ? labelElement.dataset.label : "";
            const matchesSearchFilter = label.toLowerCase().includes(activeSearchFilter.toLowerCase()) || emailAddress.toLowerCase().includes(activeSearchFilter.toLowerCase());
            // Based on which category(s) the user selected, show that specific aliases
            // Possible Cases: 
            // "active-aliases" – Only show the aliases that are enabled
            // "critical-aliases"– Only show the aliases that are critical only
            // "disabled-aliases"– Only show the aliases that are disabled
            // "relay-aliases"– Only show aliases that have been generated from the dashboard/add-on 
            // "domain-aliases"– Only show aliases that were created with a unique subdomain. 
            const matchesCategoryFilters = (
                (!activeCategoryFilters.includes("active-aliases") || aliasContainer.classList.contains("is-forwarded")) &&
                (!activeCategoryFilters.includes("promo-blocking-aliases") || aliasContainer.classList.contains("is-promo-blocking")) &&
                (!activeCategoryFilters.includes("disabled-aliases") || aliasContainer.classList.contains("is-blocked")) &&
                (!activeCategoryFilters.includes("relay-aliases") || aliasContainer.classList.contains("is-relay-alias")) &&
                (!activeCategoryFilters.includes("domain-aliases") || aliasContainer.classList.contains("is-domain-alias"))
            );

            if (matchesSearchFilter && matchesCategoryFilters) {
                aliasContainer.classList.remove("is-hidden");
            } else {
                aliasContainer.classList.add("is-hidden");
            }
        });

        filterLabelVisibleCases.textContent = aliasContainers.filter(aliasContainer => !aliasContainer.classList.contains("is-hidden")).length;
        filterLabelTotalCases.textContent = aliasContainers.length;

        // Indicate whether the user has entered a query into the search form:
        if (activeSearchFilter.length > 0) {
            filterSearchInput.classList.add("is-filtered");
            filterContainer.classList.add("is-filtered-by-search");
        } else {
            filterSearchInput.classList.remove("is-filtered");
            filterContainer.classList.remove("is-filtered-by-search");
        }
        // Indicate whether the user has enabled one of the category filters:
        if (activeCategoryFilters.length > 0) {
            filterContainer.classList.add("is-filtered-by-category");
        } else {
            filterContainer.classList.remove("is-filtered-by-category");
        }
    }

    function setSearchFilter(query) {
        activeSearchFilter = query;

        applyFilters();
    }

    filterSearchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        filterSearchInput.blur();
    });
    filterSearchInput.addEventListener("input", (event) => {
        setSearchFilter(event.target.value);
    });

    // TODO: Add esc key listener
    filterResetButton.addEventListener("click", () => {
        setSearchFilter("");
    });

    filterToggleSearchInput.addEventListener("click", () => {
        if (filterContainer.classList.contains("is-search-visible")) {
            closeSearchForm();
        } else {
            openSearchForm();
        }
    }, false);
    function openSearchForm() {
        filterToggleSearchInput.classList.add("is-enabled");
        filterContainer.classList.add("is-search-visible");
        filterSearchInput.focus();
    }
    function closeSearchForm() {
        filterToggleSearchInput.classList.remove("is-enabled");
        filterContainer.classList.remove("is-search-visible");
    }

    const categoryMenuOpenListener = (event) => {
        if (!event.target.closest(".c-filter-category")) {
            closeCategoryMenu();
        }
    };
    const categoryMenuEscListener = (event) => {
        if (event.key === "Escape") {
            closeCategoryMenu();
        }
    };
    function openCategoryMenu() {
        filterToggleCategoryInput.classList.add("is-enabled");
        filterCategoryWrapper.classList.add("is-menu-open");
        filterCategoryCheckboxes[0].focus();
        document.addEventListener("click", categoryMenuOpenListener, false);
        document.addEventListener("keydown", categoryMenuEscListener, false);
    }
    function closeCategoryMenu() {
        filterToggleCategoryInput.classList.remove("is-enabled");
        filterCategoryWrapper.classList.remove("is-menu-open");
        document.removeEventListener("click", categoryMenuOpenListener, false);
        document.removeEventListener("keydown", categoryMenuEscListener, false);
    }
    // TODO: Add "f" key listener to toggle category filter
    // This element is only available when the user has Premium:
    if (filterToggleCategoryInput) {
        filterToggleCategoryInput.addEventListener("click", () => {
            if (filterToggleCategoryInput.classList.contains("is-enabled")) {
                closeCategoryMenu();
            } else {
                openCategoryMenu();
            }
        });
    }

    function setCategoryFilters(categories) {
        activeCategoryFilters = categories;
        applyFilters();
    }
    // This element is only available when the user has Premium:
    if (filterCategoryCheckboxes.length > 0) {
        filterCategoryCheckboxes[0].form.addEventListener("submit", (event) => {
            event.preventDefault();
            const categoriesToSet = Array.from(filterCategoryCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => checkbox.dataset.categoryType);
            setCategoryFilters(categoriesToSet);
            closeCategoryMenu();
        });
        filterCategoryCheckboxes[0].form.addEventListener("reset", () => {
            setCategoryFilters([]);
            closeCategoryMenu();
        });
    }

    filterCategoryCheckboxes.forEach(categoryCheckbox => {
        categoryCheckbox.addEventListener("change", (event) => {
            // Make sure that conflicting checkboxes are not checked at the same time,
            // e.g. "Active aliases" and "Disabled aliases" cannot both match.
            const currentCategoryCheckbox = event.target;

            if (!currentCategoryCheckbox.checked) {
                return;
            }

            const currentParentCategory = currentCategoryCheckbox.dataset.parentCategory;
            filterCategoryCheckboxes.forEach(otherCategoryCheckbox => {
                if (
                    (currentCategoryCheckbox !== otherCategoryCheckbox) &&
                    (otherCategoryCheckbox.dataset.parentCategory === currentParentCategory) &&
                    otherCategoryCheckbox.checked
                ) {
                    otherCategoryCheckbox.checked = false;
                }
            });
        }, false);
    });
    
    // TODO: Remove timeout and watch for event to detect if add-on is enabled (checking if labels exist)
    setTimeout(() => applyFilters(), 500);
})();
