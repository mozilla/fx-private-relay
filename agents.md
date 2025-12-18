# agents.md

This file provides guidance to Claude Code, Codex CLI, and Gemini CLI when working with code in this repository.

## Project Overview

Firefox Private Relay is a Mozilla privacy service that generates masked email addresses and phone numbers. The project uses Django (Python) for the backend API and Next.js (TypeScript/React) for the frontend, with static HTML export served by Django. The production site is https://relay.firefox.com

## Common Commands

### Development Setup

```bash
# Clone with translations submodule
git clone --recurse-submodules https://github.com/mozilla/fx-private-relay.git

# Python setup
python -m venv env
source env/bin/activate  # or env/Scripts/activate on Windows
pip install -r requirements.txt

# Database setup
python manage.py migrate
python manage.py createsuperuser

# Frontend setup
cd frontend
npm install
cd ..

# Update translations submodule
git submodule update --remote
```

### Running Locally

```bash
# Backend (Django)
python manage.py runserver  # Port 8000

# Frontend (production build with watch)
cd frontend
npm run watch

# Frontend (development server with hot reload)
cd frontend
npm run dev  # Port 3000 - less like production but faster rebuilds
```

### Testing

```bash
# Backend tests
pytest  # Run all Python tests
pytest api/  # Test specific app
pytest -k test_name  # Run specific test

# Frontend tests
cd frontend
npm test  # Run all Jest tests
npm run lint  # Run linting (StyleLint, ESLint, Prettier)

# E2E tests (Playwright)
npm run test:e2e  # Default environment
npm run test:local  # Local dev server at http://127.0.0.1:8000
npm run test:dev  # Dev environment at https://relay-dev.allizom.org
npm run test:stage  # Stage environment at https://relay.allizom.org
```

### Code Quality

```bash
# Python
ruff check .  # Lint Python code
ruff format .  # Format Python code
mypy .  # Type check Python code

# Frontend
cd frontend
npm run lint  # Run all frontend linters
```

### Building

```bash
# Frontend production build
cd frontend
npm run build  # Static HTML export to /frontend/out/

# Analyze bundle size
cd frontend
ANALYZE=true npm run build
```

## Architecture

## Key Files

- `privaterelay/settings.py` - All Django configuration
- `api/views/emails.py` - Email API endpoints
- `api/views/phones.py` - Phone API endpoints
- `api/views/privaterelay.py` - Account/profile API
- `emails/models.py` - Email masking models and business logic
- `emails/views.py` - Email forwarding handlers
- `frontend/src/pages/` - Next.js page routes
- `frontend/src/hooks/api/` - SWR data fetching hooks
- `docs/` - Comprehensive documentation

## Technology Stack

- **Backend**: Python 3, Django, DRF, Gunicorn
- **Frontend**: TypeScript, React, Next.js
- **Database**: PostgreSQL
- **Caching**: Redis via django-redis
- **Email**: AWS SES/SNS via boto3
- **Phone**: Twilio
- **Auth**: Mozilla Accounts OAuth via django-allauth
- **Testing**: pytest-django, Jest, Playwright, React Testing Library
- **Code Quality**: Ruff, mypy, ESLint, Prettier, StyleLint

### Backend Structure

**Django Apps:**

- `privaterelay/` - Core Django settings, middleware, and configuration
- `api/` - DRF REST API endpoints with views in `api/views/*.py`
- `emails/` - Email masking business logic, models, AWS integration via boto3
- `phones/` - Phone masking business logic, Twilio integration
- `telemetry/` - Glean telemetry event definitions

**Key Backend Patterns:**

- Django ORM models for data layer
- DRF serializers and viewsets for API
- Custom authentication via Mozilla Accounts (FxA) OAuth with `django-allauth`
- Redis caching via `django-redis`
- AWS SES/SNS for email processing via `boto3`
- Twilio for phone masking
- Feature flags via `django-waffle`
- Middleware pipeline for security, CORS, localization, static files

### Frontend Structure

**Next.js App (Static Export):**

- `/frontend/src/pages/` - File-based routing (page components). Every URL has a corresponding `.page.tsx` file.
- `/frontend/src/components/` - React components by feature
- `/frontend/src/hooks/` - Custom React hooks (especially SWR data fetching)
- `/frontend/src/functions/` - Utility functions
- `/frontend/src/styles/` - SCSS with CSS modules
- `/frontend/__mocks__/` - MSW mock data for development/testing

**Key Frontend Patterns:**

- Static HTML export (no SSR) served by Django/Whitenoise
- SWR for data fetching and caching (see `/frontend/src/hooks/api/` for examples)
- Mock Service Worker (MSW) for development mocking (`npm run dev:mocked`)
- Fluent (@fluent/react) for i18n
- React Aria for accessible components
- Runtime config from backend API (`/api/runtime_data/` via `useRuntimeData` hook)
- Single build deployed to all environments

### Data Flow

1. Frontend builds to static HTML/JS/CSS in `/frontend/out/`
2. Django serves static files via Whitenoise
3. Frontend fetches runtime config and data from Django REST API
4. Backend processes email forwarding via AWS SES/SNS
5. Backend handles phone masking via Twilio
6. Authentication flows through Mozilla Accounts OAuth

### Add-on

The Firefox Private Relay add-on is a WebExtension that integrates email masking directly into Firefox browsers.

It's code is at https://github.com/mozilla/fx-private-relay-add-on/.
It's listing on AMO is at https://addons.mozilla.org/en-US/firefox/addon/private-relay/.

**Key Technologies:**

- WebExtensions API
- Fathom ML for email field detection
- Background script for API communication
- Content scripts for form filling and field detection
- Fluent for i18n (translations in git submodule)

**Architecture:**

- `/src/js/background/` - Background scripts handle API requests, context menus, and data storage
- `/src/js/popup/` - Toolbar popup UI for managing aliases
- `/src/js/relay.firefox.com/` - scripts for communicating with website
- `/src/js/other-websites/` - Content scripts injected into all websites for field detection and form filling
- `/src/js/shared/` - Utility functions and metrics

**Communication with Relay Frontend Website:**

The add-on communicates with relay.firefox.com through DOM elements and browser storage:

- Reads website data via `<firefox-private-relay-addon>` custom element attributes (see "Add-on Communication" section)
- Injects profile data and labels into website via `#profile-main` element
- Syncs aliases and settings bidirectionally
- Detects logout events to clear local storage

## Development Guidelines

### Authentication Testing

To test with Mozilla Accounts:

1. Set `ADMIN_ENABLED=True` in `.env`
2. Run `python manage.py migrate`
3. Go to http://127.0.0.1:8000/admin/sites/site/1/change/ and change domain to `127.0.0.1:8000`
4. Add social app at http://127.0.0.1:8000/admin/socialaccount/socialapp/ with:
   - Provider: Mozilla Accounts
   - Name: `accounts.stage.mozaws.net`
   - Client ID: `9ebfe2c2f9ea3c58`
   - Secret: Request from #fx-private-relay-eng Slack
   - Sites: `127.0.0.1:8000`
5. Use accounts.stage.mozaws.net (not production accounts.firefox.com)

### API Authentication

The API uses three authentication methods:

1. **FXA OAuth Token**: Used by Firefox browsers - clients send `Authorization: Bearer {fxa-access-token}` header
2. **SessionAuthentication**: Used by add-on "first run" to fetch token
3. **TokenAuthentication**: Used by add-on and React website

Firefox clients must first POST to `/api/v1/terms-accepted-user` to accept Terms of Service and create user records.

### Premium Features Testing

Premium is auto-enabled for email addresses ending in `mozilla.com`, `getpocket.com`, or `mozillafoundation.org` (see `PREMIUM_DOMAINS` in `emails/models.py`). For full premium testing with Stripe, see README.md section "Optional: Enable Premium Features".

Phone features require the `phones` waffle flag to be enabled for the user.

### Feature Flags

Feature flags use `django-waffle`. Manage locally at http://127.0.0.1:8000/admin/waffle/flag/. In deployed environments, use `python manage.py waffle_flag` command.

Frontend checks flags via `isFlagActive(runtimeData.data, "flag_name")` after fetching runtime data with `useRuntimeData` hook. Flags are exposed via `/runtime_data` endpoint implemented in `api/views/privaterelay.py`.

### Translations

Translations are in a git submodule at `privaterelay/locales/`.

To update translations:

```bash
git submodule update --remote
```

To add new translatable strings:

1. Add strings to `privaterelay/locales/en/` (backend) or define in code (frontend)
2. For temporary strings not ready for translation, use `frontend/pendingTranslations.ftl` or `pending_locales/pending.ftl`
3. Create PR to https://github.com/mozilla-l10n/fx-private-relay-l10n
4. After merge and submodule update, remove temporary strings to avoid test failures

Automated job syncs translations daily from the l10n repo.

### Environment Variables

Key `.env` variables for local development:

- `SECRET_KEY` - Required for Django (generate unique value)
- `ADMIN_ENABLED` - Set to `True` to enable /admin endpoints
- `FXA_*` - Mozilla Accounts OAuth configuration
- `AWS_*` - AWS SES/SNS credentials for email testing
- `TWILIO_*` - Twilio credentials for phone testing
- `STRIPE_*` - Stripe keys for premium features testing

See `.env-dist` for full list.

### Environment-Specific Configuration

The frontend is built once and deployed to all environments. Environment-specific values cannot be baked into the build. Instead, the backend exposes an `/runtime_data` endpoint that provides environment variables to the frontend. Extend this endpoint in `/api/views/privaterelay.py`. The frontend fetches it using the `useRuntimeData` hook in `/frontend/src/hooks/api/runtimeData.ts`.

### Mock Data for Frontend Development

Mock data is defined in `frontend/__mocks__/api/mockData.ts`. Available mock users:

- `empty` - New user, no aliases, no premium
- `onboarding` - Just upgraded to premium, hasn't completed onboarding
- `some` - Premium user with some aliases created
- `full` - Power user with custom domain, multiple aliases, experienced bounce

Append `?mockId=<mockId>` to URL to auto-login as that user. Run with `npm run dev:mocked` for mocked backend.

When modifying mock data, update type definitions in `/frontend/src/hooks/api/` hooks first. TypeScript will guide you through which mock objects need updating.

### CSS/Styling

Follow Protocol design system (https://protocol.mozilla.org). Use CSS modules (`.module.scss`) for component-level styling. Import tokens from Protocol.

**Class naming convention (SMACSS-based):**

- `c-` for components (e.g., `.mzp-c-card`)
- `t-` for themes (e.g., `.mzp-t-dark`)
- `l-` for layout (e.g., `.mzp-l-content`)
- `u-` for utilities (e.g., `.mzp-u-inline`)
- `is-` for state (e.g., `.mzp-is-active`)
- `has-` for parent styling (e.g., `.mzp-has-submenu`)
- `js-` for behavior hooks (e.g., `.mzp-js-toggle`)
- `a-` for animations (e.g., `.mzp-a-fade-in`)

Protocol classes use `.mzp-` prefix. Custom/non-Protocol classes drop the prefix.

Use `//` for comments in Sass (not `/* */`). Use simple selectors and minimal nesting. See Protocol CSS coding guide: https://protocol.mozilla.org/docs/css-guide.html

### Django Migrations

**Adding new fields:**

- New columns need database default or allow `NULL` to prevent errors when old code runs against new database
- Old code runs against new database during rollout, so omitted columns in INSERT statements must have defaults

**Deleting fields/models:**

1. Remove all references in code
2. Deploy code changes to production
3. Then remove from `models.py` and create migration
4. Deploy model changes and migration

This prevents errors when code references deleted columns during rollout.

## Code Organization Patterns

### Backend

- Models in `{app}/models.py` define database schema
- Views in `{app}/views.py` or `api/views/{module}.py` handle requests
- Serializers in `api/serializers.py` validate/transform API data
- Tests in `{app}/tests/test_*.py` using pytest-django
- Management commands in `{app}/management/commands/`
- Type hints required (mypy strict mode)

### Frontend

- Components use CSS modules (`component.module.scss`)
- Data fetching via custom SWR hooks in `/hooks/`
- Tests co-located with components (`component.test.tsx`)
- React Testing Library for component tests
- Mock data in `__mocks__/` for different user states
- Fluent strings defined in l10n submodule

### Add-on Communication

The website and browser add-on communicate in four ways:

1. **Website → Add-on (data)**: Via `<firefox-private-relay-addon-data>` element attributes (rendered by `<AddonData>` component). Add-on reads via `#profile-main` element.

2. **Add-on → Website (data)**: Via `<firefox-private-relay-addon>` element attributes (rendered in `_app.page.tsx`). React components use `useAddonData` hook to access.

3. **Website → Add-on (events)**: Use `sendEvent` function from `useAddonData` hook. Fires `website` event on addon element.

4. **Add-on → Website (events)**: Add-on calls `browser.tabs.reload` instead of events.

Show/hide content based on add-on: use `is-visible-with-addon` or `is-hidden-with-addon` classes.

## Testing Architecture

### Backend Testing

- Framework: pytest with pytest-django
- Fixtures: model-bakery for model factories
- Mocking: responses library for HTTP mocks
- Coverage: coverage.py with HTML reports
- Test specific app: `pytest emails/` or `pytest api/tests/test_views.py`

### Frontend Testing

- Framework: Jest with React Testing Library
- Accessibility: jest-axe for a11y testing
- Mocking: MSW for API mocking
- Run: `cd frontend && npm test`

### E2E Testing

- Framework: Playwright (Chrome and Firefox)
- Specs in `/e2e-tests/specs/`
- Page objects in `/e2e-tests/pages/`
- Environment-specific commands: `test:local`, `test:dev`, `test:stage`, `test:prod`
- Automatic retries, video/trace capture on failure

### Metrics Testing

Enable metrics in tests with `@override_settings(STATSD_ENABLED=True)` and use `MetricsMock` for assertions:

```python
from markus.testing import MetricsMock

@override_settings(STATSD_ENABLED=True)
def test_code():
    with MetricsMock() as mm:
        code_that_emits_metric()
    mm.assert_incr_once("metric_name")
```

## Production & Release

### Environments

- **Production**: relay.firefox.com (run by SRE in GCP)
- **Stage**: relay.allizom.org (run by SRE in GCP)
- **Dev**: relay-dev.allizom.org (run by ENGR in MozCloud)
- **Local**: 127.0.0.1:8000

### Build Process

Multi-stage Docker build:

1. Node stage: Build frontend static files
2. Python stage: Install dependencies, collect static files
3. Django serves via Whitenoise + Gunicorn

### Monitoring

- Metrics: markus with datadog extensions → telegraf → Monarch (GCP Prometheus storage)
- Errors: Sentry
- Profiling: Google Cloud Profiler
- Telemetry: Glean
- Logs: MozLog JSON format

Enable metrics in development:

- `STATSD_ENABLED=True` - Send to statsd server (use `nc -lu localhost 8125` to view)
- `STATSD_DEBUG=True` - Log metrics to console

Utility functions in `emails/utils.py`:

- `time_if_enabled(name)`
- `incr_if_enabled(name, value=1, tags=None)`
- `histogram_if_enabled(name, value, tags=None)`
- `gauge_if_enabled(name, value, tags=None)`

## Code Quality Guidelines

When writing code for this project, follow these principles to keep it clean and maintainable.

### Write Concise Code

- Use clear variable names. Avoid comments that restate the code.
- Prefer built-in functions over custom implementations.
- Remove debug code before committing (console.log, print statements, etc.).

**Example**:

```python
# Bad: Verbose
def get_user_data(user_id):
    # Get the user from the database
    user = db.query(User).filter(User.id == user_id).first()
    # Return the user
    return user

# Good: Concise
def get_user(user_id):
    return db.query(User).filter_by(id=user_id).first()
```

### Comments

Add comments only for:

- **Why, not what** - Explain reasoning, not mechanics
- **Context** - Business rules, edge cases, non-obvious decisions
- **Warnings** - Performance gotchas, security considerations

Skip comments that:

- Restate what the code already says
- Describe obvious operations
- Would be better expressed as better variable names

Do NOT use emoji in comments.

### When to Extract Functions

**Extract a function when:**

- The same code appears 3+ times (not 2)
- A block genuinely improves readability when named
- It needs independent testing
- In python code, when it is indented too many levels

**Don't extract when:**

- Used only once (inline instead)
- The function name doesn't add clarity
- It makes the code harder to follow

**Important:** Avoid creating unnecessary abstractions or helper functions for code that's only used in a single context. Duplicating a couple of lines is fine, but when the same 6-7+ lines appear repeatedly, that's when extraction makes sense.

### Keep Code Clean

- Delete unused imports immediately
- Remove functions/variables that aren't called
- Delete commented-out code (use git history instead)
- Don't leave TODO comments - create issues or fix it now

## Important Technical Decisions

**Single Frontend Build**: Build once, deploy to all environments. Environment-specific config fetched at runtime via API. This means environment-specific values cannot be baked into the build.

**Static HTML Export**: Next.js static export generates pre-built HTML served by Django. This simplifies deployment but means dynamic routes must be handled carefully.

**Translations Submodule**: `privaterelay/locales/` is a separate git repository. Always use `--recurse-submodules` when cloning. Updated automatically by daily jobs.

**Feature Flags**: Django Waffle controls feature rollout. Check for flag usage before modifying gated features. Working towards "always clean main" where all incomplete features are behind flags.
