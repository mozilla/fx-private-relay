# Relay e2e Test Suites

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

#### Running the full suite

```
npm run test:e2e           # Runs on stage (default)
npm run test:full:stage    # Explicit full suite on stage
npm run test:full:prod     # Full suite on production
```

By default, `npm run test:e2e` will run all tests on https://relay.allizom.org/.

#### Running the relay-only suite

The relay-only suite excludes tests that depend on Mozilla Monitor, SubPlat payment flows, or third-party sites like developmentthatpays.com.

```
npm run test:relay-only         # Runs on stage (default)
npm run test:relay-only:stage   # Relay-only on stage
npm run test:relay-only:prod    # Relay-only on production
```

**Test suites:**

- **Relay-only**: Landing page, free user functionality, premium functionality, upgrade flow
- **Full**: All relay-only tests plus Monitor integration, subscription flows, tracker tests

**External dependencies:**

- Relay-only requires: Relay deployment, FXA, Restmail.net
- Full suite additionally requires: Mozilla Monitor, SubPlat, developmentthatpays.com

You can also run tests locally or on our dev server. See all commands [here](https://github.com/mozilla/fx-private-relay/blob/main/package.json), or use `E2E_TEST_ENV=<env (prod, dev, stage, local)> npx playwright test`.

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

### 8. Relay-Only Suite

The [Relay e2e tests workflow](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml) runs the relay-only test suite daily at 8 AM UTC. This suite focuses on core Relay functionality without dependencies on external services like Monitor or payment processors.

The relay-only suite runs automatically on a schedule, but you can also trigger it manually:

1. Go to [Relay e2e tests](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml)
2. Click "Run workflow"
3. Select "relay-only" from the suite dropdown
4. Click "Run workflow"

To run the relay-only suite locally:

```bash
npm run test:relay-only:stage
```

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
