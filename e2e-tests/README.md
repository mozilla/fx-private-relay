# Relay e2e Test Suite

---

## How to run

Note: Steps 1 and 2 can be skipped if you are not updating screenshots. By default, screenshots use darwin but linux is what is used in our CI/CD.

### 1. Install Docker

```
https://docs.docker.com/get-docker/
```

### 2. Build Docker container using official image from playwright

```
docker run -v $PWD:/tests -w /tests --rm --ipc=host -it mcr.microsoft.com/playwright:v1.24.0-focal /bin/bash
```

### 3. Install Node Dependencies

```
npm install
```

### 4. Install Playwright test dependencies

```
npx playwright install
```

### 5. Run Tests

If you are running only free specs, this following will suffice.

```
create/update a .env file with the following:

E2E_TEST_ACCOUNT_PASSWORD=<arbitrary password>
```

If you are running premium tests as well, you will need the following.

```
create/update a .env file with the following:

E2E_TEST_ACCOUNT_PREMIUM=<your_premium_account_email>
E2E_TEST_ACCOUNT_PASSWORD=<your_premium_account_password>
```

The premium account needs to have a chosen subdomain for the premium tests to pass. Any free account created during the initial setup of tests will also use `E2E_TEST_ACCOUNT_PASSWORD`. If you do not want to use a personal premium account, reach out to Luke for `relay-team` premium account details.

### 6. Run Tests

```
npm run test:e2e
```

By default, `npm run test:e2e` will run the tests on https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/.

You can also run tests locally, on our dev server (https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/), and in production (https://relay.firefox.com/). You can find the commands [here](https://github.com/mozilla/fx-private-relay/blob/main/package.json#L26-L31), or you can run `E2E_TEST_ENV=<env (prod, dev, stage)> npx playwright test`.

To view the tests live in the browser, you can add `--headed` to the end of the command:

```
npx playwright test --headed
```

To interactively develop tests, you can use `--ui --debug`:

```
npx playwright test --ui --debug
```

See <https://playwright.dev/docs/test-cli> for more flags.

Our github actions workflows can be found here, [![Relay e2e Tests](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml/badge.svg)](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml). You can run the tests against different branches.

### 7. Screenshots

When you run tests for the first time locally, you will run into an error for the tests that rely on screenshots, stating that a snapshot does not exist. Here is an example.

```
Error: A snapshot doesn't exist at example.spec.ts-snapshots/example-test-1-chromium-darwin.png, writing actual.
```

This is because playwright needs to create an image initially. On the following runs, it will compare that a screenshot of the respective element matches the one added initially. Do not push your local images into the repo, the only ones that are needed for CI end in `linux`.

### 8. Health check

Our ![health check](https://github.com/mozilla/fx-private-relay/actions/workflows/relay_e2e_health.yml) runs a subset of the entire e2e test suite everyday. This subset of tests focuses on critical tests for free and premium users for the overall health of the relay application. To add a test into the healthcheck CI, add `@health_check` into the title of your test or test group. See the following as an example,

`test.describe("Subscription flows @health_check", ...)`

To run the health check manually, go to ![Relay e2e tests](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml), click run workflow, and check off "enable health check" before clicking "run workflow".

### 9. Diagnosing Test Failures

If the end-to-end automated test suite fails, a good first step is to manually run the test in stage with similar steps. This will help determine if the playwright tests need updates or if it has detected a regression.

The end-to-end tests rely on several external services:

- Relay deployments
- [Mozilla Accounts](https://accounts.firefox.com/)
- [Mozilla Monitor](https://monitor.mozilla.org/)
- [Development That Pays](https://pages.developmentthatpays.com)
- [Restmail.net](https://restmail.net/)

If tests fail when checking these services, manually check that they are running.

Relay includes abuse monitoring. For example, there is a limit to how many masks can be created in a time period. When developing tests, it is possible to hit these abuse limits.

If a test is flaky, consider making the tests more reliable by using the [locators][playwright-locators], [auto-retrying assertions][playwright-auto-retrying-assertions], or [fixtures][playwright-fixtures]. For more suggestions on making Playwright tests more reliable or efficient, see [documentation on FxA test improvements][fxa-test-improvements].

[playwright-locators]: https://playwright.dev/docs/locators
[playwright-auto-retrying-assertions]: https://playwright.dev/docs/test-assertions#auto-retrying-assertions
[playwright-fixtures]: https://playwright.dev/docs/test-fixtures
[fxa-test-improvements]: https://docs.google.com/presentation/d/1dSASq9xcaA8DuQM_1_Ab6q5_ScBpvqI9NPHvovkA-wU/edit#slide=id.g276e3207c4d_1_427
