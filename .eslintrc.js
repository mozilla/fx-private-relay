/* eslint-env node */

module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  globals: {
    areInputIconsEnabled: "writable",
    enableDataOptOut: "writable",
    fillInputWithAlias: "writable",
    sendRelayEvent: "readonly"
  },
  overrides: [
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
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "no-prototype-builtins": "off",
    "no-unused-vars": ["warn", { vars: "all", args: "all", ignoreRestSiblings: false }],
    quotes: ["error", "double", { avoidEscape: true }],
    semi: ["off", "always"],
  },
};
