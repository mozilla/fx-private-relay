# End-to-End Testing Documentation

This document provides comprehensive documentation of the end-to-end (E2E) testing infrastructure for Firefox Private Relay.

## Table of Contents

- [Overview](#overview)
- [Test Files & Coverage](#test-files--coverage)
- [Test Suites](#test-suites)
- [Page Object Models](#page-object-models)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [CI/CD Integration](#cicd-integration)
- [Environment Variables](#environment-variables)
- [Test Dependencies](#test-dependencies)
- [Known Limitations](#known-limitations)

## Overview

### Framework & Location

The project uses **Playwright 1.57.0** with TypeScript for end-to-end testing. All E2E tests are located in the `e2e-tests/` directory.

### Directory Structure

```
e2e-tests/
├── specs/           # Test specification files
├── pages/           # Page object models
├── fixtures/        # Test fixtures
├── e2eTestUtils/    # Helper utilities
└── global-setup.ts  # Global authentication setup
```

### Testing Approach

- **Page Object Model (POM)** pattern for maintainable test code
- **Visual regression testing** with screenshot comparisons
- **Multi-browser support** (Chromium and Firefox)
- **Environment-agnostic** tests (stage, prod, dev, local)
- **Authenticated state management** via Playwright's `storageState`

## Test Files & Coverage

### 1. relay-home-page.spec.ts

**Location:** `e2e-tests/specs/relay-home-page.spec.ts`

**Test Count:** 6 tests

**Scope:** Landing page and public-facing functionality

**Test Scenarios:**

- Visual regression testing for header and hero section
  - **Note:** Visual regression tests run on Firefox only; Chromium tests are skipped
- Header navigation functionality:
  - FAQ button redirects to FAQ section
  - Home button navigation
  - Firefox logo link functionality
- Authentication flows:
  - Sign in button authentication flow (C1818784)
  - Sign up button authentication flow (C1818782)

### 2. relay-general-functionality.spec.ts

**Location:** `e2e-tests/specs/relay-general-functionality.spec.ts`

**Test Count:** 6 tests

**Scope:** Free user dashboard functionality

**Test Scenarios:**

- Free tier mask creation limit (5 masks maximum) - C1553067
- Visual regression tests (Firefox only; Chromium tests are skipped):
  - Dashboard header for logged-in free user - C1812639
  - Extension upgrade banner visibility - C1812641
  - Mask card display and styling - C1553070
  - Mask deletion confirmation dialog - C1553071

**Coverage:**

- Free user limitations and restrictions
- UI visual regression testing
- Mask management (creation and deletion)
- Dashboard UI elements

### 3. relay-premium-functionality.spec.ts

**Location:** `e2e-tests/specs/relay-premium-functionality.spec.ts`

**Test Count:** 3 tests

**Scope:** Premium account functionality

**Test Scenarios:**

- Premium users can create unlimited masks (verified with 6+ masks)
- Mask blocking options:
  - Block promotional emails
  - Block all emails
- Custom domain mask generation

**Requirements:**

- Pre-configured premium test account
- Premium account must have a chosen subdomain

### 4. relay-premium-upgrade.spec.ts

**Location:** `e2e-tests/specs/relay-premium-upgrade.spec.ts`

**Test Count:** 1 test

**Scope:** Premium upgrade flows

**Test Scenarios:**

- "Upgrade" button redirect to premium pricing page (`/premium/#pricing`) - C1812640, C1808503

### 5. relay-e2e.spec.ts

**Location:** `e2e-tests/specs/relay-e2e.spec.ts`

**Test Count:** 9 tests (some skipped)

**Scope:** Complete end-to-end flows including authentication, email forwarding, and subscriptions

**Test Scenarios:**

#### Authentication & Email Forwarding

- FxA (Firefox Accounts) authentication flow - C1553068
- Random mask generation and email forwarding - C1553065, C1811801
- Email forwarding confirmation (verifies 1 forwarded email after signup) - C1553068

#### Subscription Flows (with PlanGrid)

Four subscription flow tests covering all plan combinations:

1. Yearly "Relay Premium" plan - C1818792
2. Monthly "Relay Premium" plan - C1818792
3. Yearly "Relay + Phone" bundle plan - C1818792
4. Monthly "Relay + Phone" bundle plan - C1818792

#### Skipped Tests

- Email forwarding with tracker removal (Firefox only) - C1811801
  - Reason: Requires new website that sends tracked emails (TODO: find replacement)

**External Dependencies:**

- Mozilla Monitor integration
- Payment processors (SubPlat)
- restmail.net for email verification

## Test Suites

The project defines two test suites optimized for different testing needs:

### Relay-Only Suite

**Test Count:** ~19 tests

**Schedule:** Runs daily at 8 AM UTC via GitHub Actions

**Included Specs:**

- `relay-home-page.spec.ts`
- `relay-general-functionality.spec.ts`
- `relay-premium-functionality.spec.ts`
- `relay-premium-upgrade.spec.ts`

**Dependencies:**

- Firefox Private Relay
- Firefox Accounts (FxA)
- restmail.net

**Characteristics:**

- Faster execution time
- No external service integrations beyond FxA
- Suitable for daily automated testing
- Tests core Relay functionality only

**Run Commands:**

```bash
npm run test:relay-only:stage
npm run test:relay-only:prod
npm run test:relay-only:dev
npm run test:relay-only:local
```

### Full Suite

**Test Count:** All tests from relay-only suite plus ~9 additional tests

**Included Specs:**

- All relay-only specs
- `relay-e2e.spec.ts` (subscription and integration flows)

**Additional Dependencies:**

- Mozilla Monitor
- SubPlat (payment processing)
- External websites for email forwarding tests

**Run Commands:**

```bash
npm run test:full:stage
npm run test:full:prod
npm run test:full:dev
npm run test:full:local
```

## Page Object Models

All page objects are located in `e2e-tests/pages/` and follow the Page Object Model pattern.

### 1. LandingPage (`landingPage.ts`)

**Responsibility:** Public landing page interactions

**Key Elements:**

- Header navigation (FAQ button, Home button, Firefox logo)
- Sign in/Sign up buttons
- Plan grid with pricing options
- Yearly/Monthly plan toggles
- Hero section (for visual regression)
- Premium, Phone, and Megabundle plan cards

**Methods:**

- `goto()` - Navigate to landing page
- `clickSignIn()` - Initiate sign-in flow
- `clickSignUp()` - Initiate sign-up flow
- Plan selection and pricing interactions

### 2. AuthPage (`authPage.ts`)

**Responsibility:** Firefox Accounts authentication flows

**Key Elements:**

- Email input field
- Password input fields (login and signup variants)
- Verification code input
- Form submission buttons

**Methods:**

- `enterEmail(email)` - Enter email address
- `enterPassword(password)` - Enter password
- `submitEmail()` - Submit email form
- `submitPassword()` - Submit password form
- `enterVerificationCode(code)` - Enter verification code
- `completeSignUp()` - Complete full signup flow
- `completeLogin()` - Complete full login flow

### 3. DashboardPage (`dashboardPage.ts`)

**Responsibility:** Main dashboard functionality (most complex page object)

**Key Elements:**

#### Header Elements

- User menu
- Sign out button
- Upgrade button

#### Dashboard Stats

- Emails forwarded counter
- Emails blocked counter
- Masks used counter

#### Mask Management

- Generate new mask button (random and custom domain)
- Mask cards with expansion functionality
- Delete mask button with confirmation dialog
- Mask labels and descriptions
- Mask forwarding status

#### Premium Features

- Custom domain mask generation
- Unlimited mask creation
- Mask blocking options:
  - Block promotional emails
  - Block all emails

#### UI Elements

- Relay extension banner
- Upgrade promotional banners
- Onboarding tips sections

**Methods:**

- `goto()` - Navigate to dashboard
- `generateRandomMask()` - Create a new random mask
- `generateCustomDomainMask(label)` - Create custom domain mask
- `deleteMask(maskEmail)` - Delete a specific mask
- `getMaskCount()` - Get current number of masks
- `setBlockPromotions(mask, enabled)` - Toggle promotional email blocking
- `setBlockAll(mask, enabled)` - Toggle block all emails

### 4. SubscriptionPaymentPage (`subscriptionPaymentPage.ts`)

**Responsibility:** Payment and subscription flows

**Key Elements:**

- Subscription plan titles and details
- Payment form fields:
  - Cardholder name
  - Card number
  - Expiry date
  - CVC/CVV
  - Postal/ZIP code
- PayPal button
- Discount/coupon code form
- Plan type indicator
- Pricing display

**Methods:**

- `fillPaymentForm(cardDetails)` - Fill all payment fields
- `submitPayment()` - Submit payment form
- `enterCouponCode(code)` - Apply discount code
- `selectPayPal()` - Choose PayPal payment method

### 5. MozillaMonitorPage (`mozillaMonitorPage.ts`)

**Responsibility:** Mozilla Monitor integration and OAuth flows

**Key Elements:**

- Monitor sign-up form
- OAuth consent screens
- Verification code input for Monitor
- Monitor dashboard elements

**Methods:**

- `completeMonitorSignUp(email)` - Sign up for Monitor
- `enterVerificationCode(code)` - Enter Monitor verification code
- `authorizeOAuth()` - Complete OAuth authorization

## Configuration

### Playwright Configuration

**File:** `playwright.config.ts`

#### Core Settings

| Setting        | Value                       | Description                 |
| -------------- | --------------------------- | --------------------------- |
| Test Directory | `e2e-tests/specs`           | Location of test files      |
| Base URL       | `https://relay.allizom.org` | Default (stage environment) |
| Timeout        | 120 seconds                 | Per-test timeout            |
| Global Timeout | 900 seconds (15 minutes)    | Total suite timeout         |
| Global Setup   | `e2e-tests/global-setup.ts` | Authentication setup script |

#### Environment Configuration

Tests support four environments:

| Environment | Base URL                        | Purpose                     |
| ----------- | ------------------------------- | --------------------------- |
| `stage`     | `https://relay.allizom.org`     | Default testing environment |
| `prod`      | `https://relay.firefox.com`     | Production (read-only)      |
| `dev`       | `https://relay-dev.allizom.org` | Development environment     |
| `local`     | `http://127.0.0.1:8000`         | Local development           |

#### Browser Configuration

**Supported Browsers:**

- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)

**Disabled Browsers** (commented out in config):

- Safari (WebKit)
- Mobile Chrome
- Mobile Safari

#### Test Execution Settings

| Setting        | CI Value           | Local Value            | Description                         |
| -------------- | ------------------ | ---------------------- | ----------------------------------- |
| Workers        | 1                  | `undefined` (parallel) | Prevents rate limiting on CI        |
| Retries        | 1                  | 0                      | Retry failed tests once on CI       |
| Fully Parallel | `true`             | `true`                 | Run tests in parallel when possible |
| Reporter       | `['list', 'html']` | `['list', 'html']`     | Console + HTML reports              |

#### Artifact Collection

| Artifact    | Trigger            | Purpose              |
| ----------- | ------------------ | -------------------- |
| Screenshots | `only-on-failure`  | Capture failures     |
| Videos      | `retry-with-video` | Record retried tests |
| Traces      | `on-first-retry`   | Debug information    |

#### Visual Regression Settings

- **Max Diff Pixel Ratio:** 4%
- **Animations:** Disabled during screenshots
- **Snapshot Path:** `e2e-tests/specs/*.spec.ts-snapshots/`
- **Update Mode:** `missing` (auto-add missing baselines)
- **Platform-Specific:** Separate snapshots for Linux (CI) and Darwin (local)
- **Browser-Specific:** Separate snapshots for Chromium and Firefox

## Running Tests

### Prerequisites

#### For All Environments

- Node.js 22.x
- npm dependencies installed (`npm install`)
- Playwright browsers installed (`npx playwright install --with-deps`)

#### For Local Testing

- Backend server running (`docker-compose up`)
- Frontend built (`cd frontend && npm run build`)
- Environment variables configured

### Test Commands

**Important:** All E2E test commands should be run from the **project root directory**, not the frontend directory. The test scripts are defined in the root `package.json`.

#### Relay-Only Suite

```bash
# Stage environment (default)
npm run test:relay-only
npm run test:relay-only:stage

# Production environment
npm run test:relay-only:prod

# Development environment
npm run test:relay-only:dev

# Local environment
npm run test:relay-only:local
```

#### Full Suite

```bash
# Stage environment
npm run test:full:stage

# Production environment
npm run test:full:prod

# Development environment
npm run test:full:dev

# Local environment
npm run test:full:local
```

#### All Tests (Combined)

```bash
# Stage environment (default)
npm run test:e2e
npm run test:stage

# Production environment
npm run test:prod

# Development environment
npm run test:dev

# Local environment
npm run test:local
```

#### Interactive Testing

```bash
# Run with browser visible
npx playwright test --headed

# Run with interactive UI
npx playwright test --ui

# Run with step-by-step debugger
npx playwright test --debug

# Run specific test file
npx playwright test e2e-tests/specs/relay-home-page.spec.ts

# Run specific test by name
npx playwright test -g "should create unlimited masks"
```

#### Debugging

```bash
# Show browser and slow down actions
npx playwright test --headed --slow-mo=1000

# Generate trace for debugging
npx playwright test --trace on

# Open last HTML report
npx playwright show-report
```

### Test Execution Flow

1. **Global Setup** (`global-setup.ts`):
   - Launches Chromium browser
   - Generates random test email (`{timestamp}_tstact@restmail.net`)
   - Navigates to Relay landing page
   - Completes sign-up flow:
     - Enters email
     - Sets password
     - Retrieves verification code from restmail.net
     - Enters verification code
   - Saves authenticated state to `state.json`
   - Cleans up browser

2. **Test Execution**:
   - Each test loads authenticated state from `state.json`
   - Tests run in parallel (locally) or sequentially (CI)
   - Page objects abstract UI interactions
   - Assertions validate expected behavior

3. **Cleanup**:
   - Screenshots saved on failure
   - Videos recorded for retried tests
   - HTML report generated in `playwright-report/`

## CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/playwright.yml`

#### Triggers

1. **Scheduled Run**
   - **Time:** Daily at 8:00 AM UTC
   - **Suite:** Relay-only suite
   - **Environment:** Stage

2. **Manual Dispatch**
   - **Workflow:** Can be triggered manually from GitHub Actions UI
   - **Parameters:**
     - Environment: `stage`, `prod`, or `dev`
     - Suite: `relay-only` or `full`

#### Workflow Steps

1. **Checkout Code**
   - Uses `actions/checkout@v4`

2. **Setup Node.js**
   - Version: 22.15.0
   - Caching: npm dependencies cached

3. **Install Dependencies**
   - Runs `npm ci` in frontend directory

4. **Install Playwright**
   - Installs Playwright browsers
   - Includes system dependencies

5. **Run Tests**
   - Executes appropriate test suite based on parameters
   - Uses environment-specific credentials from GitHub Secrets

6. **Upload Artifacts**
   - **Trigger:** On test failure
   - **Artifact:** HTML test report
   - **Retention:** 30 days

7. **Slack Notification**
   - **Trigger:** On test failure
   - **Channel:** Configured Slack channel
   - **Content:** Failure summary with GitHub run link

#### Environment Variables in CI

Set via GitHub Secrets:

```
E2E_TEST_ACCOUNT_FREE
E2E_TEST_ACCOUNT_PREMIUM
E2E_TEST_ACCOUNT_PASSWORD
E2E_TEST_ENV
```

## Environment Variables

### Required Variables

| Variable                    | Description                | Example                          |
| --------------------------- | -------------------------- | -------------------------------- |
| `E2E_TEST_ENV`              | Target environment         | `stage`, `prod`, `dev`, `local`  |
| `E2E_TEST_ACCOUNT_FREE`     | Free account email         | Auto-generated or pre-configured |
| `E2E_TEST_ACCOUNT_PREMIUM`  | Premium account email      | `premium_test@example.com`       |
| `E2E_TEST_ACCOUNT_PASSWORD` | Password for test accounts | `SecurePassword123!`             |

### Optional Variables

| Variable            | Description          | Default                  |
| ------------------- | -------------------- | ------------------------ |
| `E2E_TEST_BASE_URL` | Override base URL    | Environment-specific URL |
| `SITE_ORIGIN`       | Local testing origin | `http://127.0.0.1:8000`  |

### Setting Environment Variables

#### Local Development

Create a `.env` file in the project root:

```bash
E2E_TEST_ENV=local
E2E_TEST_ACCOUNT_FREE=your_free_account@example.com
E2E_TEST_ACCOUNT_PREMIUM=your_premium_account@example.com
E2E_TEST_ACCOUNT_PASSWORD=YourPassword123!
SITE_ORIGIN=http://127.0.0.1:8000
```

#### CI/CD

Configure as GitHub Secrets in repository settings:

- Settings → Secrets and variables → Actions → New repository secret

## Test Dependencies

### Internal Services

| Service                    | Purpose          | Required For |
| -------------------------- | ---------------- | ------------ |
| **Firefox Private Relay**  | Core application | All tests    |
| **Firefox Accounts (FxA)** | Authentication   | All tests    |

### External Services

| Service             | Purpose                   | Required For                      |
| ------------------- | ------------------------- | --------------------------------- |
| **restmail.net**    | Email verification codes  | Authentication flows              |
| **SubPlat**         | Payment processing        | Subscription flows (full suite)   |
| **Mozilla Monitor** | Cross-product integration | Monitor signup tests (full suite) |

### Service Reliability

- **restmail.net**: Public service, occasional downtime possible
- **FxA**: Production service, generally reliable
- **SubPlat**: Payment sandbox, may have rate limits
- **Monitor**: Production service, integration points may change

### Handling Service Outages

- Tests automatically retry once on CI
- Timeouts are configured to wait for slow responses
- Visual regression tests have 4% pixel difference tolerance
- Helper functions include retry logic for verification codes

## Key Features Tested

### Core Functionality

✅ **Email Mask Generation**

- Random mask creation
- Custom domain mask creation (premium)
- Mask limit enforcement (free tier: 5 masks)
- Unlimited masks for premium users

✅ **Mask Management**

- Mask deletion with confirmation dialog
- Mask card UI display and expansion
- Mask labels and descriptions

✅ **Email Forwarding**

- Basic email forwarding functionality
- Forwarding confirmation after signup
- Tracker removal (test currently skipped)

✅ **Account Tiers**

- Free account limitations
- Premium account features
- Premium upgrade flow

✅ **Authentication**

- FxA sign-up flow
- FxA sign-in flow
- Email verification
- Session persistence

✅ **Subscription Flows**

- All plan combinations (4 tests):
  - Relay Premium (yearly/monthly)
  - Relay + Phone Bundle (yearly/monthly)
- Payment form validation
- Plan selection and pricing display

✅ **UI Components**

- Navigation and header
- Dashboard stats and counters
- Extension upgrade banners
- Promotional banners

✅ **Visual Regression**

- Landing page hero section
- Dashboard header (free user)
- Mask cards
- 9+ screenshot comparison tests

✅ **Premium Features**

- Custom domain masks
- Mask blocking options:
  - Block promotional emails
  - Block all emails
- Unlimited mask creation

✅ **Cross-Product Integration**

- Mozilla Monitor OAuth flow
- Monitor signup with masks

## Known Limitations

### Test Gaps

1. **Tracker Removal Test**
   - **Status:** Skipped
   - **Reason:** Requires website that sends emails with trackers
   - **TODO:** Find replacement website for tracker testing
   - **Test ID:** C1811801

2. **Chromium Visual Regression Tests**
   - **Status:** Skipped
   - **Tests Affected:** 6 tests (relay-home-page.spec.ts and relay-general-functionality.spec.ts)
   - **Reason:** Visual regression tests only run on Firefox to reduce baseline maintenance burden
   - **Impact:** Chromium-specific UI bugs may not be caught by visual regression

3. **Mobile Browser Testing**
   - **Status:** Not implemented
   - **Browsers:** Mobile Chrome and Mobile Safari are commented out
   - **Reason:** Configuration exists but not enabled

### Technical Constraints

1. **FxA React App Rendering**
   - **Issue:** FxA switched to React app, causing rendering issues
   - **Workaround:** `forceNonReactLink()` helper function
   - **Impact:** May require maintenance if FxA changes further

2. **Rate Limiting**
   - **Issue:** Relay enforces abuse limits on mask creation
   - **Workaround:** CI runs with single worker (`workers: 1`)
   - **Impact:** Slower test execution on CI

3. **Premium Account Requirements**
   - **Issue:** Custom domain tests require premium account with pre-chosen subdomain
   - **Constraint:** Cannot dynamically create premium accounts
   - **Impact:** Requires manual premium account setup and maintenance

4. **Visual Regression Sensitivity**
   - **Issue:** Screenshots can fail due to minor rendering differences
   - **Mitigation:** 4% max diff pixel ratio tolerance
   - **Impact:** May require baseline updates when UI changes

### External Service Dependencies

1. **restmail.net Reliability**
   - **Issue:** Public service with no SLA
   - **Impact:** Occasional test failures due to service downtime
   - **Mitigation:** Retry logic in verification code retrieval

2. **SubPlat Payment Processing**
   - **Issue:** Payment sandbox may have rate limits or downtime
   - **Impact:** Subscription flow tests may fail
   - **Suite:** Full suite only

3. **Mozilla Monitor Availability**
   - **Issue:** Production service, integration may change
   - **Impact:** Monitor integration tests may break
   - **Suite:** Full suite only

4. **Cross-Service Timing**
   - **Issue:** Email forwarding requires email delivery timing
   - **Impact:** Tests must wait for async email processing
   - **Mitigation:** Polling and timeout strategies

## Test Utilities

### Helper Functions

**File:** `e2e-tests/e2eTestUtils/helpers.ts`

#### Key Functions

| Function                | Purpose                                   | Parameters                              |
| ----------------------- | ----------------------------------------- | --------------------------------------- |
| `checkAuthState()`      | Handle FxA authentication flow            | `page`, `authPage`, `email`, `password` |
| `getVerificationCode()` | Retrieve verification codes from restmail | `email`, `retries`                      |
| `forceNonReactLink()`   | Workaround for FxA React rendering        | `page`, `selector`                      |
| `setEnvVariables()`     | Configure environment settings            | `environment`                           |

#### Constants

| Constant            | Description                   | Values                              |
| ------------------- | ----------------------------- | ----------------------------------- |
| `ENV_URLS`          | Environment base URLs         | stage, prod, dev, local URLs        |
| `ENV_MONITOR`       | Monitor service URLs          | Environment-specific Monitor URLs   |
| `ENV_EMAIL_DOMAINS` | Email domains per environment | restmail.net, etc.                  |
| `TIMEOUTS`          | Predefined timeouts           | SHORT (2s), MEDIUM (5s), LONG (10s) |

### Test Fixtures

**File:** `e2e-tests/fixtures/basePages.ts`

Extends Playwright's `test` fixture with custom page objects:

```typescript
import { test as base } from "@playwright/test";

export const test = base.extend({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  subscriptionPage: async ({ page }, use) => {
    await use(new SubscriptionPaymentPage(page));
  },
  mozillaMonitorPage: async ({ page }, use) => {
    await use(new MozillaMonitorPage(page));
  },
});
```

**Usage in tests:**

```typescript
import { test } from "../fixtures/basePages";

test("my test", async ({ dashboardPage }) => {
  await dashboardPage.goto();
  // Use page object methods
});
```

## Best Practices

### Writing New Tests

1. **Use Page Objects**
   - Never access UI elements directly in tests
   - Add methods to appropriate page object
   - Keep test files focused on scenarios, not implementation

2. **Follow Naming Conventions**
   - Test files: `feature-name.spec.ts`
   - Test descriptions: Start with `should` or action verb
   - Include Jira ticket IDs in test descriptions when applicable

3. **Use Fixtures**
   - Import test from `fixtures/basePages.ts`
   - Use injected page objects instead of creating instances
   - Leverage fixture auto-cleanup

4. **Handle Async Operations**
   - Use Playwright's auto-waiting capabilities
   - Add explicit waits only when necessary
   - Use appropriate timeouts from `TIMEOUTS` constants

5. **Visual Regression**
   - Take screenshots at consistent viewport sizes
   - Disable animations before screenshots
   - Use descriptive snapshot names
   - Only run on Firefox to reduce baseline maintenance

### Debugging Tests

1. **Local Debugging**

   ```bash
   # Run with browser visible and slowed down
   npx playwright test --headed --slow-mo=1000 --debug

   # Run specific test in debug mode
   npx playwright test -g "test name" --debug
   ```

2. **CI Debugging**
   - Download HTML report artifact from failed GitHub Actions run
   - Check screenshots and videos
   - Review trace files for detailed execution logs

3. **Common Issues**
   - **Timeout errors**: Increase timeout or check for network issues
   - **Element not found**: Verify selectors in browser DevTools
   - **Flaky tests**: Add explicit waits or improve selectors
   - **Visual regression failures**: Check for intentional UI changes

## Maintenance

### Updating Baselines

When UI changes are intentional and visual regression tests fail:

```bash
# Update all missing/failed snapshots
npx playwright test --update-snapshots

# Update snapshots for specific test
npx playwright test relay-home-page.spec.ts --update-snapshots

# Review changes before committing
git diff e2e-tests/specs/*.spec.ts-snapshots/
```

### Adding New Tests

1. Create or modify spec file in `e2e-tests/specs/`
2. Use existing page objects or add new methods as needed
3. Follow existing test patterns and structure
4. Run tests locally to verify
5. Update this documentation if adding new coverage

### Updating Page Objects

When UI changes affect selectors:

1. Locate the page object file in `e2e-tests/pages/`
2. Update affected selectors
3. Update method implementations if interaction patterns changed
4. Run affected tests to verify changes
5. Consider adding comments for complex selectors

### Playwright Version Updates

When updating Playwright:

1. Update `package.json` version
2. Run `npm install`
3. Run `npx playwright install --with-deps`
4. Run full test suite to check for breaking changes
5. Update configuration if new features are beneficial
6. Check Playwright changelog for migration notes

## Resources

### Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test Runner](https://playwright.dev/docs/test-runners)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)

### Internal Resources

- [agents.testing.md](../.agents/agents.testing.md) - Quick testing reference
- [frontend-architecture.md](frontend-architecture.md) - Frontend structure
- [developer_mode.md](developer_mode.md) - Local development setup

### Related Workflows

- `.github/workflows/playwright.yml` - CI/CD configuration
- `playwright.config.ts` - Playwright configuration
- `package.json` - Test scripts and dependencies

## Support

For questions or issues with E2E tests:

1. Check this documentation first
2. Review [agents.testing.md](../.agents/agents.testing.md) for quick reference
3. Check test output and HTML reports for detailed failure information
4. Ask in team Slack channels
5. Create GitHub issue for bugs or improvements
