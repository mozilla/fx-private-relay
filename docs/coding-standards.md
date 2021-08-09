# Coding Standards

### Lint styles

For JavaScript, we follow [ESLint's recommended rules](https://eslint.org/docs/rules/). 

For SCSS and CSS, we follow [the standard configuration](https://github.com/stylelint/stylelint-config-standard). 

## Protocol Integration

We leverage the Protocol [design system](https://protocol.mozilla.org/docs/glossary.html) and framework. See additional documentation on Protocol at https://protocol.mozilla.org/docs.  

### Class Naming Convention

For ease of integration and to avoid conflicts with other sites, frameworks, and libraries, most classes in Protocol are prefixed with our global namespace `.mzp-` for “Mozilla Protocol”. If the style is custom/outside of Protocol, we drop the `.mzp` prefix.

We follow a [SMACSS-based naming convention](http://smacss.com/book/categorizing) with a set of prefixes to put rules into a few different categories:

- `c-` for component names. Expect a lot of this one, e.g. `.mzp-c-card`, `.mzp-c-button`.
- `t-` for theme styles, when a component has one or more alternative styles, e.g. `.mzp-t-dark`, `.mzp-t-product-firefox`.
- `l-` for layout-related styles, e.g. `.mzp-l-content`, `.mzp-l-grid-third`. These are essentially presentational names, mostly used for container elements.
- `u-` for utility styles, which have a broad scope and can be powerful overrides, e.g. `.mzp-u-inline`, `.mzp-u-title-md`. These are presentational so should be rare. Prefer mixins in a style sheet over classes in HTML.
- `is-` to indicate a current state, e.g. `.mzp-is-active`, `.mzp-is-collapsed` (typically assigned by JS and not hard-coded).
- `has-` to indicate that a component contains some other component, when the parent gets some styling to accommodate the child, e.g. `.mzp-has-submenu`, `.mzp-has-image`.
- `js-` used as a behavior hook for JavaScript, e.g. `.mzp-js-sticky`, `.mzp-js-collapsible`, `.mzp-js-toggle`. Indicates potential for a change of state and usually shouldn’t have any styling.
- `a- `for CSS animation names, e.g. `.mzp-a-fade-in`, `.mzp-a-slide-from-right`.

Our names are all lowercase and hyphen-separated or “kebab-case,” e.g. `.mzp-c-card`, `.mzp-c-card-title`. This brings with it the potential for long kebabs of multipart, hyphenated names. Names should be as short as possible and as long as necessary. Clarity is key. If we find our names getting obscenely long and confusing we may need to revise our convention but we’re trying it this way first.

### CSS Coding Guide

We follow [Protocol's CSS coding guide](https://protocol.mozilla.org/docs/css-guide.html). See their documentation for additional details. 

- Use [simple selectors](https://protocol.mozilla.org/docs/css-guide.html#simple-selectors)
- Use [minimal nesting](https://protocol.mozilla.org/docs/css-guide.html#minimal-nesting)
- [Format](https://protocol.mozilla.org/docs/css-guide.html#format) your CSS
- Use `//` for [comments](https://protocol.mozilla.org/docs/css-guide.html#comments) in Sass instead of `/* */`
- Use the [right unit](https://protocol.mozilla.org/docs/css-guide.html#units) for the right context.