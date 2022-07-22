# Relay e2e Test Suite

---

## How to run

### 1. Install Docker

```
https://docs.docker.com/get-docker/
```

### 2. Build Docker container using official image from playwright

```
docker run -v $PWD:/tests -w /tests --rm --ipc=host -it mcr.microsoft.com/playwright:v1.23.0-focal /bin/bash
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

TEST_BASE_URL={/* base will be stage url */}
TEST_ACCOUNT_FREE=
TEST_ACCOUNT_PASSWORD=
```

### 6. Run Tests

```
npx playwright test || npm run test:e2e
```