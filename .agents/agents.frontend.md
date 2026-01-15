# Frontend Development Guide

Frontend guidance for Firefox Private Relay Next.js/React/TypeScript codebase.

See [.agents/agents.md](.agents/agents.md) for project overview and global principles.

## Technology Stack

- **Frontend**: TypeScript, React, Next.js (static export)
- **Styling**: SCSS with CSS modules, tokens from the Protocol design system
- **Data Fetching**: SWR (stale-while-revalidate)
- **i18n**: Fluent (@fluent/react)
- **Accessibility**: React Aria
- **Testing**: Jest, React Testing Library, jest-axe
- **Code Quality**: ESLint, Prettier, StyleLint

## Common Commands

```bash
cd frontend
npm run dev         # Dev server on :3000 (hot reload)
npm run watch       # Production build with watch
npm run build       # Static HTML export to /frontend/out/
npm test            # Jest tests
npm run lint        # All linters
npm run dev:mocked  # Dev with MSW mocking
```

## Frontend Patterns

### Static HTML Export (No SSR)

Next.js generates static HTML served by Django/Whitenoise. Build output in `/frontend/out/`. All pages must be statically exportable. No `getServerSideProps`.

### Single Build for All Environments

Frontend built once, deployed to dev/stage/prod. Environment-specific config fetched at runtime from `/api/runtime_data/` via `useRuntimeData` hook. See [.agents/agents.md](.agents/agents.md).

### Runtime Config

Use `useRuntimeData` hook to fetch feature flags, environment URLs, and API config. To add config: update `api/views/privaterelay.py` (backend) and `/frontend/src/hooks/api/runtimeData.ts` (frontend types).

### SWR for Data Fetching

Create custom hooks in `/frontend/src/hooks/api/` for each API endpoint.

## Mock Data for Development

Mock data in `frontend/__mocks__/api/mockData.ts`. Available mock users: `empty`, `onboarding`, `some`, `full`.

**Usage:** Append `?mockId=<mockId>` to URL after running `npm run dev:mocked`.

**Updating:** Change type definitions in `/frontend/src/hooks/api/` first, then update mock data. TypeScript guides you to stale mocks.

## CSS/Styling

Use tokens from the [Protocol design system](https://protocol.mozilla.org) (see `node_modules/@mozilla-protocol/core/protocol/css/includes/_lib.scss`).

### Protocol Design System Values

Don't invent or guess Protocol design tokens. Verify actual values from the source.

1. Check `node_modules/@mozilla-protocol/core/protocol/css/includes/_lib.scss` for actual values
2. Search existing codebase usage to see how values are used
3. If you cannot find the exact value, ask the user to verify rather than guessing
4. Never assume "standard" or "typical" values match Protocol

**Common Protocol tokens:**

- Media queries: `$mq-xs`, `$mq-sm`, `$mq-md`, `$mq-lg`, `$mq-xl`
- Colors: `$color-*` (e.g., `$color-blue-50`, `$color-red-60`)
- Spacing: `$spacing-*` (e.g., `$spacing-sm`, `$spacing-lg`)

## Translations (i18n)

Translations in [fx-private-relay-l10n](https://github.com/mozilla-l10n/fx-private-relay-l10n) which is a git submodule at `privaterelay/locales/`. Use Fluent (@fluent/react) with `<Localized>` component.

**Update translations:** `git submodule update --remote`

**Add new strings:** Use `frontend/pendingTranslations.ftl` first. Also make changes in the `privaterelay/locales/` submodule. A PR will need to be opened and merged there. We remove temporary strings after merge to avoid test failures.

## Frontend Testing

See [agents.testing.md](agents.testing.md) for details. Use Jest with React Testing Library and jest-axe for accessibility. Tests co-located with components (`component.test.tsx`). Test user behavior, not implementation details.

## Code Organization

- Components use CSS modules (`component.module.scss`)
- Data fetching via custom SWR hooks in `/hooks/`
- Tests co-located with components
- Mock data in `__mocks__/` for different user states

## Code Quality Guidelines

See [.agents/agents.md](.agents/agents.md) for global rules. Use TypeScript strict mode, functional components, hooks for state/effects, and React Aria for accessibility.

## Further Reading

- [.agents/agents.md](.agents/agents.md) - Project overview
- [agents.backend.md](agents.backend.md) - Backend API
- [agents.testing.md](agents.testing.md) - Testing guidance
- [Protocol Design System](https://protocol.mozilla.org)
