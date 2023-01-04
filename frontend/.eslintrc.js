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
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            // The `useL10n` hook works around the problem of the user's locale
            // not being known at build time, which could potentially cause the
            // prerendered text content to be mismatched compared to the first
            // client-side render. Hence, we should only use that hook:
            name: "@fluent/react",
            importNames: ["useLocalization", "Localized"],
            message:
              "Please use the `useL10n` hook from `/src/hooks/l10n.ts` instead of `useLocalization` from @fluent/react, and the `Localized` component from `/src/components/Localized.tsx` instead of from @fluent/react.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
      extends: ["plugin:testing-library/react"],
    },
  ],
};
