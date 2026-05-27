import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jestDomPlugin from "eslint-plugin-jest-dom";
import testingLibraryPlugin from "eslint-plugin-testing-library";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "out/**",
      "public/**",
      "node_modules/**",
      "next.config.js",
      "jest.config.js",
      "babel.config.js",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      react: fixupPluginRules(reactPlugin),
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      // Unused vars that start with an underscore are allowed to be unused:
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // We try to avoid implicitly casting values (see e.g. reviews of
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
            {
              // react-aria's <VisuallyHidden> component adds inline styles to
              // visually hide its children, but our Content Security Policy
              // disallows inline styles. By adding the equivalent styles to a CSS
              // file, which automatically gets added to our Content Security
              // Policy, our own <VisuallyHidden> component avoids this
              // restriction.
              name: "react-aria",
              importNames: ["VisuallyHidden"],
              message:
                "Please use the <VisuallyHidden> component from `/components/VisuallyHidden.tsx` instead of the one from react-aria, since the latter's (inline) styles will be stripped by our Content Security Policy.",
            },
          ],
        },
      ],
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: reactHooksPlugin.configs.recommended.rules,
  },
  {
    files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
    plugins: {
      "jest-dom": fixupPluginRules(jestDomPlugin),
    },
    rules: jestDomPlugin.configs["flat/recommended"].rules,
  },
  {
    files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
    ...testingLibraryPlugin.configs["flat/react"],
  },
);
