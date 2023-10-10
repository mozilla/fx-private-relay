# Relay e2e Test Suite

---

## How to run

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

[![Relay e2e Tests](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml/badge.svg)](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml)
