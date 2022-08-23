module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest-dom/recommended",
    "next",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "testing-library", "jest-dom"],
  rules: {
    // We export the Next.js app to static HTML,
    // whereas Next.js's <Image> depends on a server-side component:
    "@next/next/no-img-element": "off",
    // Unused vars that start with an understore are allowed to be unused:
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    // Weirdly this rule does not get set by ESLint's recommended ruleset,
    // but we try to avoid implicitly casting values (see e.g. reviews of
    // https://github.com/mozilla/fx-private-relay/pull/2315):
    eqeqeq: ["error", "always"],
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
      extends: ["plugin:testing-library/react"],
    },
  ],
};
