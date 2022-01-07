/** @type { Record<string, import("./src/config").RuntimeConfig> } */
const runtimeConfigs = {
  production: {
    backendOrigin: "https://relay.firefox.com",
    frontendOrigin: "https://relay.firefox.com",
    fxaOrigin: "https://accounts.firefox.com",
    fxaLoginUrl: "https://relay.firefox.com/accounts/fxa/login/?process=login",
    fxaLogoutUrl: "https://relay.firefox.com/accounts/logout/",
    premiumProductId: "prod_K29ULZL9pUR9Fr",
    emailSizeLimitNumber: 150,
    emailSizeLimitUnit: "KB",
    maxFreeAliases: 5,
    mozmailDomain: "mozmail.com",
    googleAnalyticsId: "UA-77033033-33",
    maxOnboardingAvailable: 3,
    featureFlags: {
      generateCustomAliasMenu: false,
      generateCustomAliasSubdomain: false,
      generateCustomAliasTip: false,
    },
  },
};

// This configuration is for the setup where we have a watch process
// that looks for changes to files in src/ to trigger builds,
// with the build output being served by Django/Whitenoise.
runtimeConfigs.watch_build = {
  ...runtimeConfigs.production,
  backendOrigin: "http://127.0.0.1:8000",
  frontendOrigin: "http://127.0.0.1:8000",
  fxaOrigin: "https://accounts.stage.mozaws.net",
  fxaLoginUrl: "http://127.0.0.1:8000/accounts/fxa/login/?process=login",
  fxaLogoutUrl: "http://127.0.0.1:8000/accounts/logout/",
};

// This configuration is for the setup where the Next.js dev server
// is running concurrently with the Django server.
// Due to not running on the same server as the back-end,
// login and logout needs to be simulated using the `/mock/` pages.
runtimeConfigs.development = {
  ...runtimeConfigs.production,
  backendOrigin: "http://127.0.0.1:8000",
  frontendOrigin: "http://localhost:3000",
  fxaOrigin: "https://accounts.stage.mozaws.net",
  fxaLoginUrl: "http://localhost:3000/mock/login",
  fxaLogoutUrl: "http://localhost:3000/mock/logout",
};

/** @type {import('next').NextConfig} */
module.exports = {
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
  publicRuntimeConfig:
    runtimeConfigs[process.env.NODE_ENV ?? "production"] ??
    runtimeConfigs.production,
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.ftl/,
      type: "asset/source",
    });

    return config;
  },
};
