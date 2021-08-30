(function() {
	"use strict";
    
	const filterEmailAddresses = [];
	const filterAliasLabels = [];
	const aliasesWithLabelsCollection = [];
    const aliasCollection = [];
    
    const aliases = document.querySelectorAll(".c-alias");
    let currentFilteredByCategoryAliases;
    let currentFilteredBySearchAliases;

    const filterLabelTotalCases = document.querySelector(".js-filter-case-total");
    const filterLabelVisibleCases = document.querySelector(".js-filter-case-visible");

    const filterResetButton = document.querySelector(".js-filter-reset")

    const filterInput = document.querySelector(".js-filter-search-input");

    const filterToggleSearchInput = document.querySelector(".js-filter-mobile-search-toggle");
    const filterForm = document.querySelector(".js-filter-search-form");
    const filterContainer = document.querySelector(".js-filter-container");

    const filterToggleCategoryInput = document.querySelector(".js-filter-category-toggle");
    const filterCategoryWrapper = document.querySelector(".c-filter-category");

    function toggleAliasSearchBar() {
        filterToggleSearchInput.classList.toggle("is-enabled");
        filterContainer.classList.toggle("is-search-visible");
    }

    filterToggleSearchInput.addEventListener("click", toggleAliasSearchBar, false);

	function filterInputWatcher(input) {

        let query = input;
        
        if (input.target) {
            query = input.target.value.toLowerCase();
        }

        filterInput.removeEventListener("focus", buildSearchQueryArrays, false);

        // Reset filter if the input is empty, however, do not steal focus to input
        if (query === "") resetFilter();

        // Add class to keep the reset button visible while a query has been entered
        filterInput.classList.add("is-filtered");

        const isCategoryFilterActive = (filterContainer.classList.contains("is-filtered-by-category"));

        currentFilteredByCategoryAliases = aliases;

        if (isCategoryFilterActive) {
            currentFilteredByCategoryAliases = document.querySelectorAll(".c-alias:not(.is-hidden)");
        } else {
            filterContainer.classList.add("is-filtered-by-search");
        }

        // Hide all items eligible for search filter
        currentFilteredByCategoryAliases.forEach(alias => {
            alias.classList.add("is-hidden");
        });

        // Fix GitHub/#966: Create temporary array of objects containing labels and their parent `.js-alias` DOM element
        const searchIndexWithLabels = [];

        for (const [index, alias] of aliasesWithLabelsCollection.entries()) {
            const searchEntryObject = {
                "alias": alias,
                "label": filterAliasLabels[index]
            }
            searchIndexWithLabels.push(searchEntryObject);
        }

		// Filter each collection based on the search query
        const matchListEmailAddresses = filterEmailAddresses.filter(s => s.includes(query));
        const matchListAliasLabels = searchIndexWithLabels.filter(item => item.label.includes(query));

        // Set the current number of "found" results
        if ( (matchListEmailAddresses.length + matchListAliasLabels.length) <= currentFilteredByCategoryAliases.length ) {
            filterLabelVisibleCases.textContent = matchListEmailAddresses.length + matchListAliasLabels.length;
        }

        // Show email addresses that match the search query
        for (const alias of matchListEmailAddresses) {
            let index = filterEmailAddresses.indexOf(alias);
            if (index >= 0) {
                aliasCollection[index].classList.remove("is-hidden");
            }
        }

        // Show aliases with labels that match the search query
        for (const result of matchListAliasLabels) {        
            result.alias.classList.remove("is-hidden");
        }

	}

    // This function catches any label updates from the user and updates the search array to display them.
    function updateAliasLabel(event){
        const alias = event.target.closest(".js-alias");
        const prevLabel = event.target.dataset.label;
        const prevLabelLowercased = prevLabel.toString().toLowerCase();
        const newLabel = event.target.value;
        const newLabelLowercased = newLabel.toString().toLowerCase();
        const AliasWithLabelsArrayIndex = aliasesWithLabelsCollection.indexOf(alias);
        const labelArrayIndex = filterAliasLabels.indexOf(prevLabelLowercased);


        // Case: User did not enter any label, nor was one previously set
        if (prevLabel === "" && newLabel === "") {
            return;
        }

        // Case: User deleted/cleared an existing label
        if (newLabel === "") {
            filterAliasLabels.splice(labelArrayIndex, 1);
            aliasesWithLabelsCollection.splice(AliasWithLabelsArrayIndex, 1);
            return;
        }

        // Case: User updated an existing label to a new string
        if (labelArrayIndex > -1) {
            filterAliasLabels.splice(labelArrayIndex, 1, newLabelLowercased);
            return;
        }

        // Case: User created a label for an alias
        aliasesWithLabelsCollection.push(alias);
        filterAliasLabels.push(newLabelLowercased);

    }

    function isAddOnDetected() {
        const addNotes = document.querySelector(".additional-notes");
        if (!addNotes) return false;
        return (addNotes.offsetWidth > 0 && addNotes.offsetHeight > 0);
    }

    function buildSearchQueryArrays() {
        const addOnDetected = isAddOnDetected();
        
        // Build two arrays, one for case IDs and one for case title text. 
        const isCategoryFilterActive = (filterContainer.classList.contains("is-filtered-by-category"));

        let availableAliasesForSearchFilter = aliases;

        if (isCategoryFilterActive) {
            availableAliasesForSearchFilter = document.querySelectorAll(".c-alias:not(.is-hidden)");
        }

        // Reset all search query arrays
        aliasCollection.length = 0;
        filterEmailAddresses.length = 0;
        filterAliasLabels.length = 0;
        aliasesWithLabelsCollection.length = 0;
        
		availableAliasesForSearchFilter.forEach( alias => {
            aliasCollection.push(alias);
            if (alias.dataset.relayAddress) {
                filterEmailAddresses.push( alias.dataset.relayAddress.toString().toLowerCase() );
            }

            const aliasLabel = alias.querySelector(".relay-email-address-label");

            if (addOnDetected) {
                aliasLabel.addEventListener("blur", updateAliasLabel);
            }

            if (aliasLabel.dataset.label) {
                aliasesWithLabelsCollection.push(alias);
                filterAliasLabels.push( aliasLabel.dataset.label.toString().toLowerCase() );
            }
		});

		// Set ##/## in filter input field to show how many aliases have been filtered.
        filterLabelVisibleCases.textContent = availableAliasesForSearchFilter.length;
        filterLabelTotalCases.textContent = availableAliasesForSearchFilter.length;
    }

	function filterInit() {

        // Hide the search function and end early if the user has no aliases created. 
        if (aliases.length < 1) {
            filterForm.classList.add("is-hidden");
            return;
        }

        buildSearchQueryArrays();

        // Filter aliases on page load if the search already has a query in it. 
        if (filterInput.value) {
            toggleAliasSearchBar(); 
            filterInputWatcher(filterInput.value);
        }

		filterInput.addEventListener("input", filterInputWatcher, false);
		filterInput.addEventListener("focus", buildSearchQueryArrays, false);
        
        filterInput.addEventListener("keydown", e => {
          if(e.keyIdentifier=="U+000A"||e.keyIdentifier=="Enter"||e.keyCode==13){
            e.preventDefault();
            return false;
          }
        });

        // TODO: Add esc key listener
        filterResetButton.addEventListener("click", ()=> {
            resetFilter();
        }, false);
	}

    function resetFilter() {
        filterInput.classList.remove("is-filtered");
        filterInput.value = "";

        filterInput.addEventListener("focus", buildSearchQueryArrays, false);

        filterContainer.classList.remove("is-filtered-by-search");

        const isCategoryFilterActive = (filterContainer.classList.contains("is-filtered-by-category"));

        let availableAliasesForSearchFilter = aliases;

        if (isCategoryFilterActive && currentFilteredByCategoryAliases && currentFilteredByCategoryAliases.length > 0) {
            availableAliasesForSearchFilter = currentFilteredByCategoryAliases;
        }

        filterLabelVisibleCases.textContent = availableAliasesForSearchFilter.length;
        filterLabelTotalCases.textContent = availableAliasesForSearchFilter.length;

        availableAliasesForSearchFilter.forEach(alias => {
            alias.classList.remove("is-hidden");
        });
    }

    // TODO: Remove timeout and watch for event to detect if add-on is enabled (checking if labels exist)
    setTimeout(filterInit, 500);

    const filterCategoryCheckboxes = document.querySelectorAll(".js-filter-category-checkbox");
    const filterToggleCategoryButtonReset = document.querySelector(".js-filter-category-reset");
    const filterToggleCategoryButtonApply = document.querySelector(".js-filter-category-apply");

    function toggleAliasCategoryBar() {
        filterToggleCategoryInput.classList.toggle("is-enabled");
        filterCategoryWrapper.classList.toggle("is-menu-open");

        if (filterToggleCategoryInput.classList.contains("is-enabled")) {
            filterCategory.open();
        }
    }

    const filterCategory = {
        init: () => {
            filterToggleCategoryButtonApply.addEventListener("click", filterCategory.apply, false);
            filterToggleCategoryButtonReset.addEventListener("click", filterCategory.reset, false);
            filterCategoryCheckboxes.forEach(checkbox => {
                checkbox.addEventListener("change", filterCategory.oppositeCheck, false);
            });

            // TODO: Add "f" key listener to toggle category filter
        },
        categoryMenuOpenListener: (e) => {
            if (!e.target.closest(".c-filter-category") && filterCategoryWrapper.classList.contains("is-menu-open")) {
                filterCategory.close();
                document.removeEventListener("click", filterCategory.categoryMenuOpenListener, false);
            }
        },
        categoryMenuEscListener: (e) => {
            if (e.key === "Escape") {
                filterCategory.close();
                document.removeEventListener("keydown", filterCategory.categoryMenuEscListener, false);
            }
        },
        reset: (e) => {
            e.preventDefault();
            filterCategoryCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });

            filterContainer.classList.remove("is-filtered-by-category");
            filterCategory.close();
            
            const isSearchActive = (filterContainer.classList.contains("is-filtered-by-search"));

            // Reset back to current search query, rather than clearing all filters
            if (isSearchActive && currentFilteredBySearchAliases && (currentFilteredBySearchAliases.length > 0) ) {
                
                currentFilteredBySearchAliases.forEach(alias => {
                    alias.classList.remove("is-hidden");
                });

                return;
            }
            
            // Full reset
            aliases.forEach(alias => {
                alias.classList.remove("is-hidden");
            });
        },
        apply: (e) => {
            e.preventDefault();

            const options = [];

            filterCategoryCheckboxes.forEach(checkbox => {
                if (!checkbox.checked) {
                    return;
                }

                options.push(checkbox.dataset.categoryType);
            });

            const isSearchActive = (filterContainer.classList.contains("is-filtered-by-search"));

            if (!isSearchActive) {
                filterContainer.classList.add("is-filtered-by-category");
            }

            filterCategory.filter(options)
            filterCategory.close();
        },
        close: () => {
            toggleAliasCategoryBar();
        },
        oppositeCheck: (e) => {
            const currentCategory = e.target;

            if (!currentCategory.checked) {
                return;
            }
            
            const currentParentCategory = currentCategory.dataset.parentCategory;
            
            filterCategoryCheckboxes.forEach(checkbox => {
                if ( (currentCategory !== checkbox) && (checkbox.dataset.parentCategory === currentParentCategory) && checkbox.checked) {
                    checkbox.checked = !checkbox.checked;
                }
            });

        },
        open: () => {
            filterCategoryCheckboxes[0].focus();
            document.addEventListener("click", filterCategory.categoryMenuOpenListener, false);
            document.addEventListener("keydown", filterCategory.categoryMenuEscListener, false);
        },
        filter: (options) => {
            if (options.length < 1) {
                return;
            }

            const isSearchActive = (filterContainer.classList.contains("is-filtered-by-search"));
            const multipleOptions = (options.length > 1);

            // Hide all aliases by default unless search is already active
            if (!isSearchActive) {
                aliases.forEach(alias => {
                    alias.classList.add("is-hidden");
                });
            }

            // Based on which category(s) the user selected, show that specific aliases
            // Possible Cases: 
            // "active-aliases" – Only show the aliases that are enabled
            // "disabled-aliases"– Only show the aliases that are disabled
            // "relay-aliases"– Only show aliases that have been generated from the dashboard/add-on 
            // "domain-aliases"– Only show aliases that were created with a unique subdomain. 

            options.forEach( (option, index) => {

                let filteredAliases = aliases;

                // Only filter visible aliases, rather than the entire set
                if (multipleOptions && (index > 0) || isSearchActive) {
                    filteredAliases = document.querySelectorAll(".c-alias:not(.is-hidden)");
                }

                // Cache current filter results before filtering further to revert on reset()
                if (isSearchActive) {
                    currentFilteredBySearchAliases = Array.from(filteredAliases)
                }

                switch (option) {
                    case "active-aliases":
                        filteredAliases.forEach(alias => {
                            if (alias.classList.contains("is-enabled")) {
                                alias.classList.remove("is-hidden");
                            } else {
                                alias.classList.add("is-hidden");
                            }
                        });
                        break;
                    case "disabled-aliases":
                        filteredAliases.forEach(alias => {
                            if (!alias.classList.contains("is-enabled")) {
                                alias.classList.remove("is-hidden");
                            } else {
                                alias.classList.add("is-hidden");
                            }
                        });
                        break;
                    case "relay-aliases":
                        filteredAliases.forEach(alias => {
                            if (alias.classList.contains("is-relay-alias")) {
                                alias.classList.remove("is-hidden");
                            } else {
                                alias.classList.add("is-hidden");
                            }
                        });
                        break;
                    case "domain-aliases":
                        filteredAliases.forEach(alias => {
                            if (alias.classList.contains("is-domain-alias")) {
                                alias.classList.remove("is-hidden");
                            } else {
                                alias.classList.add("is-hidden");
                            }
                        });
                        break;
                }
            });
        }
    }

    if (filterToggleCategoryInput) {
        filterToggleCategoryInput.addEventListener("click", toggleAliasCategoryBar, false);
        filterCategory.init();
    }
})();
