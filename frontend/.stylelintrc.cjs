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
    "no-descending-specificity": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        // https://github.com/webpack-contrib/css-loader#scope
        "ignorePseudoClasses": ["global"] 
      }
    ],
  }
};
