module.exports = {
  extends: ["next/core-web-vitals", "plugin:jest-dom/recommended"],
  plugins: ["testing-library", "jest-dom"],
  rules: {
    // We export the Next.js app to static HTML,
    // whereas Next.js's <Image> depends on a server-side component:
    "@next/next/no-img-element": "off",
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
      extends: ["plugin:testing-library/react"]
    },
  ],
};
