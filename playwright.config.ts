import { devices, defineConfig } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config({quiet: true});

/**
 * Test suite definitions
 */
const RELAY_ONLY_TESTS = [
  '**/relay-home-page.spec.ts',
  '**/relay-general-functionality.spec.ts',
  '**/relay-premium-functionality.spec.ts',
  '**/relay-premium-upgrade.spec.ts',
];

const FULL_TESTS = '**/*.spec.ts';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config = defineConfig({

  /* Add location of specs. */
  testDir: 'e2e-tests/specs',

  /* Maximum time one test can run for. 2 minutes */
  timeout: 60 * 2 * 1000,

  /* Global setup */
  globalSetup: require.resolve('./e2e-tests/global-setup.ts'),

  /* Max time in milliseconds the whole test suite can to prevent CI breaking. 15 minutes */
  globalTimeout: 60 * 15 * 1000,

  // adding missing snapshots for later comparison
  updateSnapshots: 'missing',

  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5_000
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  /* HTML reporter generates detailed reports with step arguments that can
     contain secrets. Only enable it for local runs where the output stays
     on the developer's machine. CI uses the list reporter only — pass/fail
     results appear in the workflow log, and GitHub Actions masks secret
     values there automatically. */
  reporter: process.env.CI
    ? [['list']]
    : [['list'], ['html']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_TEST_BASE_URL || 'https://relay.allizom.org',

    /* automatically take screenshot only on failures */
    screenshot: 'only-on-failure',

    /* Video disabled — recordings can capture credential entry and end up
       in uploaded artifacts on this public repo. */
    video: 'off',

    /* Trace disabled — trace files capture full network data (headers,
       request/response bodies) which includes secrets passed via env vars
       and extraHTTPHeaders. See MPP-4662. */
    trace: 'off',

    /* Send fxa-ci header to bypass Fastly CAPTCHA on FxA stage.
       setupFxaCiRoutes() strips this header from non-FxA domains
       to avoid CORS preflight failures. */
    extraHTTPHeaders: process.env.FXA_CI_SECRET ? {
      'fxa-ci': process.env.FXA_CI_SECRET,
    } : {},

  },

  /* Configure projects for test suites and browsers */
  projects: [
    {
      name: 'relay-only-chromium',
      testMatch: RELAY_ONLY_TESTS,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'relay-only-firefox',
      testMatch: RELAY_ONLY_TESTS,
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'full-chromium',
      testMatch: FULL_TESTS,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'full-firefox',
      testMatch: FULL_TESTS,
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'test-results/',

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  // },
});

export default config;
