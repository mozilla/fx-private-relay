/* eslint-env node */

module.exports = {
  env: {
    es6: true,
  },
  extends: ["eslint:recommended"],
  overrides: [
    {
      files: ["extension/**/*.js"],
      env: {
        "browser": true,
        "webextensions": true,
      },
      globals: {
        areInputIconsEnabled: "writable",
        enableDataOptOut: "writable",
        fillInputWithAlias: "writable",
        sendRelayEvent: "readonly"
      }
    },
    {
      files: ["static/**/*.js"],
      env: {
        browser: true,
      },
      globals: {
        ga: "readonly",
        sendGaPing: "writable",
        ClipboardJS: "readonly"
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 2018,
  },
  root: true,
  rules: {
    indent: ["off", 2, { SwitchCase: 1 }],
    "linebreak-style": ["error", "unix"],
    "no-prototype-builtins": "off",
    "no-unused-vars": ["warn", { vars: "all", args: "none", ignoreRestSiblings: false }],
    quotes: ["error", "double", { avoidEscape: true }],
    semi: ["off", "always"],
  },
};
