# End-to-End Testing Documentation

Documentation for Firefox Private Relay's E2E test infrastructure.

## Overview

The project uses Playwright with TypeScript for end-to-end testing. All tests are in `e2e-tests/`:

```
e2e-tests/
├── specs/           # Test specification files
├── pages/           # Page object models
├── fixtures/        # Test fixtures (basePages.ts)
├── e2eTestUtils/    # Helper utilities (helpers.ts)
└── global-setup.ts  # Authentication setup
```

**Architecture:**

- Page Object Model (POM) pattern for maintainability
- Visual regression testing with screenshot comparisons (Firefox only)
- Multi-browser support (Chromium and Firefox)
- Environment-agnostic (stage, prod, dev, local)
- Authenticated state management via Playwright's `storageState`

## Test Files

See `e2e-tests/specs/` for all test files. Key files:

- **relay-home-page.spec.ts** - Landing page, navigation, visual regression
- **relay-general-functionality.spec.ts** - Free user dashboard, mask limits, visual tests
- **relay-premium-functionality.spec.ts** - Premium features (unlimited masks, blocking, custom domains)
- **relay-premium-upgrade.spec.ts** - Upgrade flows
- **relay-e2e.spec.ts** - Full flows (authentication, email forwarding, subscriptions)

## Test Suites

Two suite configurations exist for different testing needs:

### Relay-Only Suite

Faster execution, tests core Relay functionality without external integrations. Runs daily at 8 AM UTC via GitHub Actions.

**Run:**

```bash
npm run test:relay-only:stage  # or :prod, :dev, :local
```

### Full Suite

All relay-only tests plus subscription and integration flows (Mozilla Monitor, SubPlat payments).

**Run:**

```bash
npm run test:full:stage  # or :prod, :dev, :local
```

### Combined Suite

Both suites together:

```bash
npm run test:e2e      # stage (default)
npm run test:stage    # stage
npm run test:prod     # production
npm run test:dev      # development
npm run test:local    # local (requires backend + frontend running)
```

**Note:** Run all commands from the **project root**, not the frontend directory.

## Page Objects

Located in `e2e-tests/pages/`. See source files for complete API:

- **LandingPage** (`landingPage.ts`) - Public landing page, pricing, sign-in/sign-up
- **AuthPage** (`authPage.ts`) - Firefox Accounts authentication flows
- **DashboardPage** (`dashboardPage.ts`) - Main dashboard, mask management, stats
- **SubscriptionPaymentPage** (`subscriptionPaymentPage.ts`) - Payment flows
- **MozillaMonitorPage** (`mozillaMonitorPage.ts`) - Monitor integration, OAuth

## Configuration

**File:** `playwright.config.ts`

Key settings:

- Test directory: `e2e-tests/specs`
- Timeouts: 120s per test, 900s global
- Visual regression: 4% max diff pixel ratio, Firefox only
- Artifacts: Screenshots on failure, videos on retry, traces on first retry

**Environments:**

- `stage` - https://relay.allizom.org (default)
- `prod` - https://relay.firefox.com
- `dev` - https://relay-dev.allizom.org
- `local` - http://127.0.0.1:8000

See `playwright.config.ts` for complete configuration details.

## Running Tests

### Prerequisites

**All environments:**

- Node.js (version in `.nvmrc` or `package.json`)
- `npm install` (installs dependencies including Playwright)
- `npx playwright install --with-deps` (installs browsers)

**Local testing:**

- Backend running: `docker-compose up`
- Frontend built: `cd frontend && npm run build`
- Environment variables configured (see below)

### Interactive Testing

```bash
# Run with visible browser
npx playwright test --headed

# Interactive UI mode
npx playwright test --ui

# Step-by-step debugger
npx playwright test --debug

# Specific test file
npx playwright test e2e-tests/specs/relay-home-page.spec.ts

# Specific test by name
npx playwright test -g "should create unlimited masks"

# Slow motion + visible
npx playwright test --headed --slow-mo=1000
```

### Debugging

```bash
# Generate trace
npx playwright test --trace on

# Open HTML report
npx playwright show-report
```

## Environment Variables

### Required

| Variable                    | Description           | Example                          |
| --------------------------- | --------------------- | -------------------------------- |
| `E2E_TEST_ENV`              | Target environment    | `stage`, `prod`, `dev`, `local`  |
| `E2E_TEST_ACCOUNT_FREE`     | Free account email    | Auto-generated or pre-configured |
| `E2E_TEST_ACCOUNT_PREMIUM`  | Premium account email | `premium@example.com`            |
| `E2E_TEST_ACCOUNT_PASSWORD` | Password for accounts | `SecurePassword123!`             |

### Optional

| Variable            | Description          | Default                 |
| ------------------- | -------------------- | ----------------------- |
| `E2E_TEST_BASE_URL` | Override base URL    | Environment-specific    |
| `SITE_ORIGIN`       | Local testing origin | `http://127.0.0.1:8000` |

**Local setup:** Create `.env` file in project root with variables above.

**CI/CD:** Configure as GitHub Secrets (Settings → Secrets and variables → Actions).

## Test Dependencies

**Internal services (all tests):**

- Firefox Private Relay
- Firefox Accounts (FxA)
- restmail.net (email verification)

**External services (full suite only):**

- Mozilla Monitor (cross-product integration)
- SubPlat (payment processing)

**Reliability notes:**

- restmail.net is a public service; occasional downtime possible
- Tests include retry logic for verification codes
- Visual regression has 4% tolerance for minor rendering differences

## CI/CD Integration

**File:** `.github/workflows/playwright.yml`

**Triggers:**

1. **Scheduled:** Daily at 8 AM UTC (relay-only suite on stage)
2. **Manual:** GitHub Actions UI (configurable environment and suite)

**Workflow:** Checkout → Setup Node → Install deps → Install Playwright → Run tests → Upload artifacts (on failure) → Slack notification (on failure)

See workflow file for complete details.

## Test Utilities

**Helper functions** (`e2e-tests/e2eTestUtils/helpers.ts`):

- `checkAuthState()` - Handle FxA authentication
- `getVerificationCode()` - Retrieve codes from restmail
- `forceNonReactLink()` - FxA React rendering workaround
- `setEnvVariables()` - Environment configuration
- Constants: `ENV_URLS`, `ENV_MONITOR`, `ENV_EMAIL_DOMAINS`, `TIMEOUTS`

**Test fixtures** (`e2e-tests/fixtures/basePages.ts`):
Extends Playwright's `test` with page object fixtures. Import from `../fixtures/basePages` to use.

```typescript
import { test } from "../fixtures/basePages";

test("my test", async ({ dashboardPage }) => {
  await dashboardPage.goto();
  // Use page object methods
});
```

## Known Limitations

### Test Gaps

1. **Tracker removal test** - Skipped, requires website sending tracked emails (C1811801)
2. **Chromium visual tests** - Skipped to reduce baseline maintenance (Firefox only)
3. **Mobile browsers** - Configuration exists but not enabled

### Technical Constraints

1. **FxA React rendering** - Requires `forceNonReactLink()` workaround
2. **Rate limiting** - CI uses single worker to avoid Relay abuse limits
3. **Premium accounts** - Require manual setup with pre-chosen subdomain
4. **restmail.net** - Public service with no SLA, may have downtime
5. **Visual regression** - May require baseline updates when UI changes intentionally

## Maintenance

### Updating Visual Baselines

When UI changes are intentional:

```bash
# Update all snapshots
npx playwright test --update-snapshots

# Update specific test
npx playwright test relay-home-page.spec.ts --update-snapshots

# Review before committing
git diff e2e-tests/specs/*.spec.ts-snapshots/
```

### Adding Tests

1. Create/modify spec file in `e2e-tests/specs/`
2. Use existing page objects or add new methods
3. Follow existing patterns
4. Run locally to verify
5. Update this doc if adding new coverage areas

### Updating Page Objects

When UI changes affect selectors:

1. Find page object in `e2e-tests/pages/`
2. Update selectors and methods
3. Run affected tests
4. Add comments for complex selectors

## Resources

**Internal:**

- [.agents/agents.testing.md](../.agents/agents.testing.md) - Quick testing reference
- `.github/workflows/playwright.yml` - CI/CD configuration
- `playwright.config.ts` - Complete Playwright configuration
- `package.json` - Test scripts
