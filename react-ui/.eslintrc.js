module.exports = {
  extends: "next/core-web-vitals",
  rules: {
    // We export the Next.js app to static HTML,
    // whereas Next.js's <Image> depends on a server-side component:
    "@next/next/no-img-element": "off",
  },
};
