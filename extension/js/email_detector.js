const {ruleset, rule, dom, type, score, out, utils} = fathom;
const {isVisible} = utils;

/**
 * Return the number of occurrences of a string or regex in another
 * string.
 */
function numRegexMatches(regex, string) {
    if (string === null) {
        return 0;
    }
    return (string.match(regex) || []).length;  // Optimization: split() benchmarks faster.
}

/**
 * Returns true if at least one attribute of `element` (from a given list of
 * attributes `attrs`) match `regex`. Use a regex that matches the entire line
 * to test only exact matches.
 */
function attrsMatch(element, attrs, regex) {
    let result = false;
    for (const attr of attrs) {
        result = result || regex.test(element.getAttribute(attr));
    }
    return result;
}

/**
 * Tries to find a <label> element in the form containing `element` and return
 * the number of matches for the given regex in its inner text.
 */
function labelForInputMatches(element, regex) {
    // First check for labels correctly associated with the <input> element
    for (const label of Array.from(element.labels)) {
        const numFound = numRegexMatches(regex, label.innerText);
        if (numFound > 0) return true;
    }

    // Then check for a common mistake found in the training set: using the
    // <input>'s `name` attribute instead of its `id` to associate with a label
    const form = element.form;
    if (element.name.length > 0 && form !== null) { // look at nearby elements in general, not just in parent form?
        for (const label of Array.from(form.getElementsByTagName("label"))) {
            if (label.htmlFor.length > 0 && (label.htmlFor === element.name)) {
                const numFound = numRegexMatches(regex, label.innerText);
                if (numFound > 0) return true;
            }
        }
    }

    return false;
}

const emailRegex = /email|e-mail/gi;
const emailRegexMatchLine = /^(email|e-mail)$/i;

const email_detector_ruleset = ruleset([
        // Inputs that could be email fields:
        rule(dom("input[type=text],input[type=\"\"],input:not([type])").when(isVisible), type("email")),

        // Look for exact matches of "email"-like keywords in some attributes of the <input>
        rule(
            type("email"),
            score(fnode => attrsMatch(fnode.element, ["id", "name", "autocomplete"], emailRegexMatchLine)),
            {name: "inputAttrsMatchEmailExactly"}
        ),

        // Count matches of "email"-like keywords in some attributes of the <input>
        rule(
            type("email"),
            score(fnode => attrsMatch(fnode.element, ["placeholder", "aria-label"], emailRegex)),
            {name: "inputPlaceholderMatchesEmail"}
        ),

        // If there's a corresponding <label> for this input, count its inner text matches for "email"-like keywords
        rule(
            type("email"),
            score(fnode => labelForInputMatches(fnode.element, emailRegex)),
            {name: "labelForInputMatchesEmail"}
        ),

        rule(type("email"), out("email")),
    ],
    new Map([
        ["inputAttrsMatchEmailExactly", 9.416913986206055],
        ["inputPlaceholderMatchesEmail", 6.740292072296143],
        ["labelForInputMatchesEmail", 10.197700500488281],
    ]),
    [["email", -3.907843589782715]]
);

function *detectEmailInputs(domRoot) {
    // First return <input type='email'>
    const typeEmailInputs = Array.from(domRoot.querySelectorAll("input[type='email']"));
    for (const input of typeEmailInputs) {
        yield input;
    }

    // Then run ruleset and return detected fields
    const detectedInputs = email_detector_ruleset.against(domRoot).get("email");
    for (const input of detectedInputs) {
        if (input.scoreFor("email") > 0.5) {
            yield input.element;
        }
    }
}
