import type { NextConfig } from "next";
import type { RuntimeConfig } from "./src/config";

const productionConfig: RuntimeConfig = {
  // The front-end and back-end are served from the same domain in production,
  // so relative URLs can be used:
  backendOrigin: "",
  frontendOrigin: "",
  fxaLoginUrl: "/accounts/fxa/login/?process=login",
  fxaLogoutUrl: "/accounts/logout/",
  supportUrl: "https://support.mozilla.org/products/relay",
  emailSizeLimitNumber: 10,
  emailSizeLimitUnit: "MB",
  maxFreeAliases: 5,
  mozmailDomain: "mozmail.com",
  googleAnalyticsId: "UA-77033033-33",
  maxOnboardingAvailable: 3,
  maxOnboardingFreeAvailable: 3,
  featureFlags: {
    // Also add keys here to RuntimeConfig in src/config.ts
    tips: true,
    generateCustomAliasMenu: true,
    generateCustomAliasSubdomain: false,
    interviewRecruitment: true,
    csatSurvey: true,
  },
};

// This configuration is for the setup where the Next.js dev server
// is running concurrently with the Django server.
// Due to not running on the same server as the back-end,
// login and logout needs to be simulated using the `/mock/` pages.
const developmentConfig: RuntimeConfig = {
  ...productionConfig,
  backendOrigin: "http://127.0.0.1:8000",
  frontendOrigin: "http://localhost:3000",
  fxaLoginUrl: "http://localhost:3000/mock/login",
  fxaLogoutUrl: "http://localhost:3000/mock/logout",
};

// This configuration is for the setup where the front-end is built and served
// on its own, with the back-end mocked out using Mock Service Worker.
// Login and logout need to be simulated using the `/mock/` pages.
const apimockConfig: RuntimeConfig = {
  ...productionConfig,
  backendOrigin: "",
  frontendOrigin: "",
  fxaLoginUrl: "/mock/login",
  fxaLogoutUrl: "/mock/logout",
};

const runtimeConfigs: Record<string, RuntimeConfig> = {
  production: productionConfig,
  development: developmentConfig,
  apimock: apimockConfig,
};

let applicableConfig = "production";
if (process.env.NEXT_PUBLIC_MOCK_API === "true") {
  applicableConfig = "apimock";
}
if (process.env.NODE_ENV === "development") {
  applicableConfig = "development";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This custom value for `pageExtensions` ensures that
  // test files are not picked up as pages to render by Next.js.
  // See https://nextjs.org/docs/api-reference/next.config.js/custom-page-extensions
  pageExtensions: ["page.ts", "page.tsx", "page.js", "page.jsx"],
  trailingSlash: true,
  productionBrowserSourceMaps: true,
  // Unfortunately we cannot use Next.js's built-in dev server,
  // as the front-end needs to be served from the same origin as the back-end
  // in order to use authenticated sessions.
  // Thus, we use `npm run watch` to create a build every time a file in `src/`
  // changes — but builds are production builds in Next.js by default.
  // Thus, we cannot use different .env files for different environments
  // (https://nextjs.org/docs/basic-features/environment-variables),
  // and use this mechanism instead:
  publicRuntimeConfig: runtimeConfigs[applicableConfig],
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
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.ftl/,
      type: "asset/source",
    });

    // msw/browser is not exported when compiling for Node (see
    // https://github.com/mswjs/msw/blob/461a1885280451ec0837fdce897f49521b8ff260/package.json#L24)
    // and msw/node is not exported when compiling for the browser (see
    // https://github.com/mswjs/msw/blob/461a1885280451ec0837fdce897f49521b8ff260/package.json#L17),
    // so to avoid build errors, we have to prevent Webpack from trying to
    // traverse them when building.
    // See https://github.com/mswjs/msw/issues/1801#issuecomment-1793911389
    if (options.isServer) {
      if (Array.isArray(config.resolve.alias)) {
        config.resolve.alias.push({ name: "msw/browser", alias: false });
      } else {
        config.resolve.alias["msw/browser"] = false;
      }
    } else {
      if (Array.isArray(config.resolve.alias)) {
        config.resolve.alias.push({ name: "msw/node", alias: false });
      } else {
        config.resolve.alias["msw/node"] = false;
      }
    }

    return config;
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
