(function() {
	"use strict";
    
	const filterEmailAddresses = [];
	const filterAliasLabels = [];
	const aliasesWithLabelsCollection = [];
    const aliasCollection = [];
    const aliases = document.querySelectorAll(".c-alias");

    const filterLabelTotalCases = document.querySelector(".js-filter-case-total");
    const filterLabelVisibleCases = document.querySelector(".js-filter-case-visible");

    const filterInput = document.querySelector(".js-filter-search-input");

	function filterInputWatcher(e) {
		const query = e.target.value.toLowerCase();
                
		// Hide all cases
		aliases.forEach(alias => {
            alias.style.display = "none";
        });

		// Loop through both arrays, making that alias visible if it is a match.
        const matchListEmailAddresses = filterEmailAddresses.filter(s => s.includes(query));
        const matchListAliasLabels = filterAliasLabels.filter(s => s.includes(query));

        // Set the current number of "found" results
        // TODO: Reset this number back to `aliases.length` when the search field is empty
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

	function filterInit() {

        // Build two arrays, one for case IDs and one for case title text. 
		aliases.forEach( alias => {
            aliasCollection.push(alias);
            if (alias.dataset.relayAddress) {
                filterEmailAddresses.push( alias.dataset.relayAddress.toString().toLowerCase() );
            }

            const aliasLabel = alias.querySelector(".relay-email-address-label");

            if (aliasLabel) {
                aliasesWithLabelsCollection.push(alias);
                filterAliasLabels.push( aliasLabel.dataset.label.toString().toLowerCase() );
            }

		});

		// // Set ##/## in filter input field to show how many aliases have been filtered.
        filterLabelVisibleCases.textContent = aliases.length;
        filterLabelTotalCases.textContent = aliases.length;

		filterInput.addEventListener("input", filterInputWatcher, false);
	}

    // TODO: Remove timeout and watch for event to detect if add-on is enabled (checking if labels exist)
    setTimeout(filterInit, 250);

})();
