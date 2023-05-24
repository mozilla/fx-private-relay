module.exports = {
  "extends": [
    "stylelint-config-recommended-scss",
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
    "declaration-block-no-shorthand-property-overrides": true,
    "declaration-no-important" : true,
    "font-weight-notation": "numeric",
    "function-url-quotes": "always",
    "no-descending-specificity": null,
    "selector-class-pattern": [
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$",
      {
        "message": "Expected class selector to be kebab-case",
      },
    ],
    "selector-pseudo-class-no-unknown": [
      true,
      {
        // https://github.com/webpack-contrib/css-loader#scope
        "ignorePseudoClasses": ["global"] 
      }
    ],
    "scss/at-rule-no-unknown": true,
    "scss/at-import-partial-extension": null,
    "scss/at-import-partial-extension-whitelist": "scss"
  }
};
