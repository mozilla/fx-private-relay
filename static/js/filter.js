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

	function filterInputWatcher(input) {

        let query = input;
        
        if (input.target) {
            query = input.target.value.toLowerCase();
        }   

        // Reset filter if the input is empty, however, do not steal focus to input
        if (query === "") resetFilter();

        // Add class to keep the reset button visible while a query has been entered
        filterInput.classList.add("is-filtered");

		// Hide all cases
		aliases.forEach(alias => {
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
        if ( (matchListEmailAddresses.length + matchListAliasLabels.length) <= aliases.length ) {
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

	function filterInit() {

        // Hide the search function and end early if the user has no aliases created. 
        if (aliases.length < 1) {
            filterForm.classList.add("is-hidden");
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
            }

            if (aliasLabel.dataset.label) {
                aliasesWithLabelsCollection.push(alias);
                filterAliasLabels.push( aliasLabel.dataset.label.toString().toLowerCase() );
            }
		});

		// // Set ##/## in filter input field to show how many aliases have been filtered.
        filterLabelVisibleCases.textContent = aliases.length;
        filterLabelTotalCases.textContent = aliases.length;

        // Filter aliases on page load if the search already has a query in it. 
        if (filterInput.value) {
            toggleAliasSearchBar(); 
            filterInputWatcher(filterInput.value);
        }

		filterInput.addEventListener("input", filterInputWatcher, false);
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
        filterLabelVisibleCases.textContent = aliases.length;
        filterLabelTotalCases.textContent = aliases.length;
        filterInput.classList.remove("is-filtered");
        filterInput.value = "";

        aliases.forEach(alias => {
            alias.classList.remove("is-hidden");
        });
    }

    // TODO: Remove timeout and watch for event to detect if add-on is enabled (checking if labels exist)
    setTimeout(filterInit, 500);

})();
