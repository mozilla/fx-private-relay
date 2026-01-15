import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This custom value for `pageExtensions` ensures that
  // test files are not picked up as pages to render by Next.js.
  // See https://nextjs.org/docs/api-reference/next.config.js/custom-page-extensions
  pageExtensions: ["page.ts", "page.tsx", "page.js", "page.jsx"],
  trailingSlash: true,
  productionBrowserSourceMaps: true,
  images: {
    // Since we're statically exporting the frontend (i.e. turning it into HTML
    // as build time, rather than running Next.js on the backend), we can't use
    // automatic image optimisation. See
    // https://nextjs.org/docs/messages/export-image-api
    unoptimized: true,
  },
  // See https://nextjs.org/blog/next-13-3#static-export-for-app-router and
  // https://nextjs.org/docs/pages/building-your-application/deploying/static-exports
  output: "export",
  turbopack: {
    rules: {
      "*.ftl": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  sassOptions: {
    // TODO MPP-3946: Fix deprecation warnings in sass 1.80.x
    // https://github.com/mozilla/protocol/releases/tag/v18.0.0
    silenceDeprecations: [
      // Upstream issues
      "legacy-js-api", // vercel/next.js issue #71638
    ],
    // TODO MPP-3946: Update to mozilla-protocol 18.0.0
    quietDeps: true,
  },
};

export default nextConfig;
