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

```
create/update a .env file with the following:

E2E_TEST_ACCOUNT_PASSWORD=<arbitrary password>
```

### 6. Run Tests

```
npm run test:e2e
```

By default, `npm run test:e2e` will run the tests on https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/. 

You can also run tests locally, on our dev server (https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/), and in production (https://relay.firefox.com/). You can find the commands [here](https://github.com/mozilla/fx-private-relay/blob/main/package.json#L26-L31). To view the tests live in the browser, you can add `--headed` to the end of the command. See https://playwright.dev/docs/test-cli for more flags.

[![Relay e2e Tests](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml/badge.svg)](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml)
