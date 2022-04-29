module.exports = {
  "extends": [
    "stylelint-config-recommended-scss",
    "stylelint-config-prettier-scss"
  ],
  "plugins": [
    "stylelint-scss"
  ],
  "ignoreFiles": [
    "src/styles/fonts/**",
    // This file uses some Next.js-specific syntax to make SCSS variables
    // available to JS. See
    // https://nextjs.org/docs/basic-features/built-in-css-support#sass-variables
    "src/hooks/mediaQuery.module.scss",
  ],
  "rules": {
    "at-rule-empty-line-before": [
      "always",
      {
        "except": ["after-same-name", "first-nested"],
        "ignore": ["after-comment"]
      }
    ],
    "at-rule-no-unknown": null,
    "block-opening-brace-newline-after": "always",
    "block-closing-brace-newline-after": "always",
    "declaration-block-no-shorthand-property-overrides": true,
    "declaration-block-semicolon-newline-after": "always",
    "declaration-colon-space-after": "always-single-line",
    "declaration-colon-space-before": "never",
    "font-weight-notation": "numeric",
    "function-url-quotes": "always",
    "no-descending-specificity": null,
    "no-missing-end-of-source-newline": true,
    "selector-class-pattern": [
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$",
      {
        "message": "Expected class selector to be kebab-case",
      },
    ],
    "scss/at-rule-no-unknown": true,
    "scss/at-import-partial-extension": null,
    "scss/at-import-partial-extension-whitelist": "scss"
  }
};
