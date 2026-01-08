# Frontend Testing Guide

This document provides best practices and guidelines for writing frontend tests in the Firefox Relay project.

## Table of Contents

- [Testing Stack](#testing-stack)
- [Quick Start](#quick-start)
- [Test File Organization](#test-file-organization)
- [Test Helper Files](#test-helper-files)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Testing Stack

We use the following testing tools:

- **Jest** (v30.2.0) - Test runner and assertion library
- **React Testing Library** (v16.3.0) - Component testing with accessibility-first queries
- **MSW (Mock Service Worker)** (v2.12.2) - API mocking
- **jest-axe** (v10.0.0) - Accessibility testing
- **@testing-library/user-event** (v14.6.1) - Realistic user interactions

### Configuration Files

- `jest.config.js` - Jest configuration with Next.js integration
- `jest.setup.ts` - Global test setup, mocks, and utilities

## Quick Start

### Running Tests

```bash
npm test                    # Run all tests
```

### Coverage Thresholds

- Branches: 70%
- Functions: 70%
- Lines: 80%
- Statements: 80%

## Test File Organization

Tests live alongside the code they test, using the `.test.tsx` or `.test.ts` extension:

```
frontend/
  src/
    components/
      Button.tsx
      Button.test.tsx
    hooks/
      useAliases.ts
      useAliases.test.ts
    pages/
      faq.page.tsx
      faq.page.test.tsx
```

## Test Helper Files

All test helpers are organized in the `__mocks__/` directory:

### API Mocking (`__mocks__/api/`)

Contains MSW setup files, HTTP request handlers, and pre-defined mock data for all API endpoints and user states.

### Hook Mocks (`__mocks__/hooks/`)

Contains mock factories for localization, API data (profile, aliases, runtime data, phone numbers, contacts, users), and related hooks.

### Component Mocks (`__mocks__/components/`)

Contains mocks for localization components, Next.js Image component, and SVG icons.

### Function Mocks (`__mocks__/functions/`)

Contains utilities for testing feature flags, locale functions, plan availability, and cookie handling.

### Module Mocks (`__mocks__/modules/`)

Contains custom render utilities with providers and Next.js router mocks.

## Writing Tests

- Use `render` and `screen` from `@testing-library/react` for basic component tests
- If your component needs providers (localization, overlay provider), use `renderWithProviders` from `__mocks__/modules/renderWithProviders`
- Always use `userEvent` for realistic user interactions (clicks, typing, etc.) and remember to `await` all userEvent calls
- Use `renderHook` from React Testing Library for testing custom hooks
- Use mock factory functions (`setMockProfileData`, `getMockRuntimeData`, `getMockRandomAlias`, etc.) for consistent, configurable API data
- Use `*Once()` methods (e.g., `setMockAliasesDataOnce`) when you need different mock data for a single test
- Use `setFlags`, `resetFlags`, and `withFlag` from `__mocks__/functions/flags` for testing feature flag dependent components
- Use `byMsgId` from `__mocks__/hooks/l10n` for testing localized content
- Every component should have an accessibility test using `axe` from `jest-axe`

## Best Practices

- Use accessibility-first queries (e.g., `getByRole`, `getByLabelText`) that reflect how users interact with your app instead of implementation details like test IDs or class names
- Use mock factories (e.g., `getMockRandomAlias`, `setMockProfileData`) instead of hardcoded data for configurable, maintainable tests
- Reset state between tests using `beforeEach` (e.g., `resetFlags()`). Jest automatically clears all mocks between tests
- Test user flows and behavior, not implementation details like function calls or internal state
- Use `waitFor` from `@testing-library/react` for async behavior
- Keep tests focused with one assertion per test when possible, and use descriptive test names
- Don't test external libraries (React Testing Library, Next.js, etc.). Trust they work and test your code's behavior

## Common Patterns

Search the codebase for real examples of these patterns:

- **Forms**: Use `userEvent.type()` for inputs, `userEvent.click()` for submission, and assert the handler was called with expected data
- **Error States**: Use `setMock*DataOnce(null)` to simulate fetch failures, then assert error messages appear with `waitFor`
- **Loading States**: Assert loading indicators appear using `getByRole("status")`
- **Conditional Rendering**: Set mock data with different states and use `getBy*` for expected elements, `queryBy*` with `.not.toBeInTheDocument()` for hidden elements
- **Lists**: Create multiple mock items with factory functions, set mock data, and assert each item appears in the document

## Troubleshooting

### Test Fails with "Not wrapped in act(...)"

Use `waitFor` or `await userEvent.*` for async operations:

```typescript
// Before
userEvent.click(button); // Missing await

// After
await userEvent.click(button);
```

### Mock Data Not Applied

Make sure you're calling `setMock*` functions before rendering:

```typescript
// Wrong order
render(<Component />);
setMockProfileData({ has_premium: true }); // Too late!

// Correct order
setMockProfileData({ has_premium: true });
render(<Component />);
```

### Element Not Found

1. Check if element is rendered conditionally
2. Use `findBy*` for async elements
3. Use `queryBy*` to assert non-existence
4. Use `screen.debug()` to see current DOM

```typescript
screen.debug(); // Prints current DOM to console
```

### Feature Flag Not Working

Reset flags in `beforeEach`:

```typescript
beforeEach(() => {
  resetFlags();
  setFlags({ my_flag: true });
});
```

### Type Errors with Mock Data

Use the factory functions to get properly typed mock data:

```typescript
// Good - typed correctly
const alias = getMockRandomAlias();

// Avoid - may have type errors
const alias = { address: "test@relay.com" }; // Missing required fields
```

## Additional Resources

- [React Testing Library Documentation](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/)
- [MSW Documentation](https://mswjs.io/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)

## Contributing

When adding new features:

1. Write tests alongside your code
2. Use existing mock patterns for consistency
3. Add new mock factories to `__mocks__/` when needed
4. Run tests before committing: `npm test`
5. Ensure coverage thresholds are met
