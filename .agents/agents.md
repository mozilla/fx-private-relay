# agents.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Firefox Private Relay is a Mozilla privacy service that generates masked email addresses and phone numbers. The project uses Django (Python) for the backend API and Next.js (TypeScript/React) for the frontend, with static HTML export served by Django. The production site is https://relay.firefox.com

**Tech stack:** Python, Django, Django REST Framework, PostgreSQL, Redis, AWS: SES/SNS/SQS, Twilio, Mozilla Accounts OAuth, TypeScript, React, Next.js (static export),

## Where to Find Guidance

Working on different parts of the codebase? Start here:

- **Backend (Django/Python/API)** → See [agents.backend.md](agents.backend.md)
- **Frontend (Next.js/React/TypeScript)** → See [agents.frontend.md](agents.frontend.md)
- **Testing & QA** → See [agents.testing.md](agents.testing.md)

## Quick Commands

```bash
# Tests
pytest  # Backend
cd frontend && npm test  # Frontend

# Code quality
ruff check . && ruff format .  # Python
cd frontend && npm run lint  # Frontend
```

## Global Principles

These constraints apply across the entire codebase:

### Single Frontend Static HTML Export

The frontend is built **once** and deployed to **all environments** (dev, stage, prod). Environment-specific values **cannot be baked into the build**. See "Environment-specific configuration" in [agents.backend.md](agents.backend.md) for more details. Next.js generates static HTML served by Django/Whitenoise. No server-side rendering. Dynamic routes must be handled carefully.

### Translations Submodule

`privaterelay/locales/` is a separate git repository. Always clone with `--recurse-submodules`. Updated automatically by daily jobs.

### Code Quality

- Use clear variable names.
- Extract functions when code appears 3+ times (not 2).
- Delete unused imports, functions, commented-out code immediately.
- No emoji in code or comments.
- Type hints required (Python mypy strict mode).

#### Code comments

Add comments only for:

- **Why, not what** - Explain reasoning, not mechanics
- **Context** - Business rules, edge cases, non-obvious decisions
- **Warnings** - Performance gotchas, accessibility considerations

Skip comments that:

- Restate what the code already says
- Describe obvious operations
- Would be better expressed as better variable names

Do NOT use emoji in comments.

## Getting Help

- Check area-specific files linked above for detailed guidance
- See `README.md` for full setup instructions
- See `docs/` for architecture documentation
