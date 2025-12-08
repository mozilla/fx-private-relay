import js from "@eslint/js";
import typescriptEslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/*.md",
      "**/*.py",
      "e2e-tests/**",
      "privaterelay/**",
    ],
  },
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    files: ["frontend/**/*.{js,jsx,ts,tsx,mjs}", "**/*.{js,jsx,ts,tsx,mjs}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: "readonly",
        JSX: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      eqeqeq: ["error", "always"],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@fluent/react",
              importNames: ["useLocalization", "Localized"],
              message:
                "Please use the `useL10n` hook from `/src/hooks/l10n.ts` instead of `useLocalization` from @fluent/react, and the `Localized` component from `/src/components/Localized.tsx` instead of from @fluent/react.",
            },
            {
              name: "react-aria",
              importNames: ["VisuallyHidden"],
              message:
                "Please use the <VisuallyHidden> component from `/components/VisuallyHidden.tsx` instead of the one from react-aria, since the latter's (inline) styles will be stripped by our Content Security Policy.",
            },
          ],
        },
      ],
    },
  },
];
