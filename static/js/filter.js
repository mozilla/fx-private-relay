(function() {
	"use strict";
    
	const filterEmailAddresses = [];
	const filterAliasLabels = [];
	const aliasesWithLabelsCollection = [];
    const aliasCollection = [];
    const aliases = document.querySelectorAll(".c-alias");

    const filterLabelTotalCases = document.querySelector(".js-filter-case-total");
    const filterLabelVisibleCases = document.querySelector(".js-filter-case-visible");

    const filterResetButton = document.querySelector(".js-filter-reset")

    const filterInput = document.querySelector(".js-filter-search-input");

    const filterToggleSearchInput = document.querySelector(".js-filter-mobile-search-toggle");
    const filterForm = document.querySelector(".js-filter-search-form");
    const filterContainer = document.querySelector(".js-filter-container");

    function toggleAliasSearchBar() {
        filterToggleSearchInput.classList.toggle("is-enabled");
        filterContainer.classList.toggle("is-search-active")       
    }

    filterToggleSearchInput.addEventListener("click", toggleAliasSearchBar, false);

	function filterInputWatcher(e) {
		const query = e.target.value.toLowerCase();

        if (query === "") resetFilter();

		// Hide all cases
		aliases.forEach(alias => {
            alias.style.display = "none";
        });

        // BUG: If more than one labels are named the same thing (identical), 
        // the filter only counts/shows the first result.
		// Loop through both arrays, making that alias visible if it is a match.
        const matchListEmailAddresses = filterEmailAddresses.filter(s => s.includes(query));
        const matchListAliasLabels = filterAliasLabels.filter(s => s.includes(query));

        // Set the current number of "found" results
        if ( (matchListEmailAddresses.length + matchListAliasLabels.length) <= aliases.length ) {
            filterLabelVisibleCases.textContent = matchListEmailAddresses.length + matchListAliasLabels.length;
        }

        for (const alias of matchListEmailAddresses) {
            let index = filterEmailAddresses.indexOf(alias);
            if (index >= 0) {
                aliasCollection[index].style.display = "block";
            }
        }

        // TODO: Map the entire list of aliases better so we dont have two seperate DOM collection arrays to loop through.
        for (const alias of matchListAliasLabels) {
            let index = filterAliasLabels.indexOf(alias);
            if (index >= 0) {
                aliasesWithLabelsCollection[index].style.display = "block";
            }
        }

	}

    // This function catches any label updates from the user and updates the search array to display them.
    function updateAliasLabel(event){
        const prevLabel = event.target.dataset.label;
        const newLabel = event.target.value.toString().toLowerCase();
        const labelArrayIndex = filterAliasLabels.indexOf(prevLabel);

        if (labelArrayIndex > -1) {
            filterAliasLabels.splice(labelArrayIndex, 1, newLabel);
        }
    }

    function isAddOnDetected() {
        const addNotes = document.querySelector('.additional-notes');
        if (!addNotes) return false;
        return (addNotes.offsetWidth > 0 && addNotes.offsetHeight > 0);
    }

	function filterInit() {

        // Hide the search function and end early if the user has no aliases created. 
        if (aliases.length < 1) {
            filterForm.style.display = "none";
            return;
        }

        const addOnDetected = isAddOnDetected();
        
        // Build two arrays, one for case IDs and one for case title text. 
		aliases.forEach( alias => {
            aliasCollection.push(alias);
            if (alias.dataset.relayAddress) {
                filterEmailAddresses.push( alias.dataset.relayAddress.toString().toLowerCase() );
            }

            const aliasLabel = alias.querySelector(".relay-email-address-label");

            if (addOnDetected) {
                aliasLabel.addEventListener("blur", updateAliasLabel);
                aliasesWithLabelsCollection.push(alias);
                filterAliasLabels.push( aliasLabel.dataset.label.toString().toLowerCase() );
            }

		});

		// // Set ##/## in filter input field to show how many aliases have been filtered.
        filterLabelVisibleCases.textContent = aliases.length;
        filterLabelTotalCases.textContent = aliases.length;

		filterInput.addEventListener("input", filterInputWatcher, false);

        filterResetButton.addEventListener("click", resetFilter, false);
	}

    function resetFilter() {
        filterLabelVisibleCases.textContent = aliases.length;
        filterLabelTotalCases.textContent = aliases.length;
        aliases.forEach(alias => {
            alias.style.display = "block";
        });
    }

    // TODO: Remove timeout and watch for event to detect if add-on is enabled (checking if labels exist)
    setTimeout(filterInit, 250);

})();
