# Testing & QA Guide

Testing guidance for Firefox Private Relay.

See [agents.md](agents.md) for project overview and global principles.

## Testing Overview

- **Backend:** pytest with pytest-django, model-bakery, responses library
- **Frontend:** Jest with React Testing Library, jest-axe
- **E2E:** Playwright (Chrome and Firefox), MSW

## Quick Reference

Run tests in order (fast → slow):

```bash
ruff check .                                                # Backend linting
mypy .                                                      # Type checking
cd frontend && npx --no-install lint-staged --cwd ..        # Frontend linting
cd frontend && npm run lint                                 # Frontend linting
cd frontend && npm test                                     # Frontend tests
pytest                                                      # Backend tests
```

## E2E Testing

**Framework:** Playwright with Page Object Model. Specs in `/e2e-tests/specs/`, page objects in `/e2e-tests/pages/`.

**Commands:**

```bash
cd frontend
npm run test:e2e    # Default
npm run test:local  # http://127.0.0.1:8000 (requires backend + frontend build)
npm run test:dev    # https://relay-dev.allizom.org
npm run test:stage  # https://relay.allizom.org
npm run test:prod   # https://relay.firefox.com (read-only)
```

**Local testing:** Requires backend running and frontend built. Fast feedback loop.

**Dev/Stage:** Tests against deployed environments. Requires credentials.

**Production:** Read-only smoke tests only.

## Testing Checklist for PRs

- [ ] Linting: `ruff check .` and `cd frontend && npx --no-install lint-staged --cwd ..`
- [ ] Type checking: `mypy .`
- [ ] Frontend tests: `cd frontend && npm test`
- [ ] Backend tests: `pytest`
- [ ] New features have tests

## Coverage Reports

**Backend:** `pytest --cov --cov-report=html` → `htmlcov/index.html`

**Frontend:** `cd frontend && npm test -- --coverage` → `coverage/lcov-report/index.html`

## CI/CD Testing

Tests run in GitHub Actions on every PR push and before merge. Order: linting → type checking → unit tests → E2E (stage). See `.github/workflows/`.

## Further Reading

- [agents.md](agents.md) - Project overview
- [agents.backend.md](agents.backend.md) - Backend patterns
- [agents.frontend.md](agents.frontend.md) - Frontend patterns
- [pytest docs](https://docs.pytest.org/), [React Testing Library](https://testing-library.com/react), [Playwright](https://playwright.dev/)
