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
      home.page.tsx
      home.page.test.tsx
```

## Test Helper Files

All test helpers are organized in the `__mocks__/` directory:

### API Mocking (`__mocks__/api/`)

| File            | Purpose                                     |
| --------------- | ------------------------------------------- |
| `initialise.ts` | Entry point for MSW setup                   |
| `browser.ts`    | MSW browser worker for component tests      |
| `server.ts`     | MSW Node.js server for unit tests           |
| `handlers.ts`   | HTTP request handlers for all API endpoints |
| `mockData.ts`   | Pre-defined mock data for all user states   |

**Mock Users Available**: `"demo"`, `"empty"`, `"onboarding"`, `"some"`, `"full"`

### Hook Mocks (`__mocks__/hooks/`)

| File                    | Purpose                              |
| ----------------------- | ------------------------------------ |
| `l10n.ts`               | Localization mock with test matchers |
| `api/profile.ts`        | Profile data mock factory            |
| `api/aliases.ts`        | Alias data mock factory              |
| `api/runtimeData.ts`    | Runtime data mock factory            |
| `api/realPhone.ts`      | Real phone number mocks              |
| `api/relayNumber.ts`    | Relay number mocks                   |
| `api/inboundContact.ts` | Inbound contact mocks                |
| `api/user.ts`           | User data mocks                      |

### Component Mocks (`__mocks__/components/`)

| File            | Purpose                         |
| --------------- | ------------------------------- |
| `Localized.tsx` | Mockable localization component |
| `ImageMock.tsx` | Next.js Image component mock    |
| `IconsMock.tsx` | SVG icon mocks                  |

### Function Mocks (`__mocks__/functions/`)

| File           | Purpose                        |
| -------------- | ------------------------------ |
| `flags.ts`     | Feature flag testing utilities |
| `getLocale.ts` | Locale function mock           |
| `getPlan.ts`   | Plan availability mock         |
| `cookies.ts`   | Cookie handling mock           |

### Module Mocks (`__mocks__/modules/`)

| File                      | Purpose                          |
| ------------------------- | -------------------------------- |
| `renderWithProviders.tsx` | Custom render with all providers |
| `next__router.ts`         | Next.js router mock              |

## Writing Tests

### Basic Component Test

```typescript
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("can be disabled", () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Component with Providers

If your component needs providers (localization, overlay provider), use `renderWithProviders`:

```typescript
import { renderWithProviders } from "__mocks__/modules/renderWithProviders";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
```

### Testing User Interactions

Always use `userEvent` for realistic user interactions:

```typescript
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

it("handles user input", async () => {
  render(<Input />);
  const input = screen.getByRole("textbox");

  await userEvent.type(input, "Hello World");
  expect(input).toHaveValue("Hello World");

  await userEvent.clear(input);
  expect(input).toHaveValue("");
});

it("handles clicks", async () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click</Button>);

  await userEvent.click(screen.getByRole("button"));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Testing Hooks

Use `renderHook` from React Testing Library:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useAliases } from "./useAliases";
import { setMockAliasesData } from "__mocks__/hooks/api/aliases";

describe("useAliases", () => {
  it("fetches aliases", async () => {
    const mockAliases = [{ id: 1, address: "test@relay.com" }];
    setMockAliasesData({ random: mockAliases });

    const { result } = renderHook(() => useAliases());

    await waitFor(() => {
      expect(result.current.randomAliasData.data).toEqual(mockAliases);
    });
  });
});
```

### Mocking API Data

Use mock factory functions for consistent, configurable data:

```typescript
import { setMockProfileData } from "__mocks__/hooks/api/profile";
import { setMockRuntimeData, getMockRuntimeDataWithPhones } from "__mocks__/hooks/api/runtimeData";
import { getMockRandomAlias } from "__mocks__/hooks/api/aliases";

describe("Premium features", () => {
  it("shows premium UI for premium users", () => {
    setMockProfileData({ has_premium: true });
    setMockRuntimeData(getMockRuntimeDataWithPhones());

    render(<Dashboard />);
    expect(screen.getByText(/premium/i)).toBeInTheDocument();
  });

  it("customizes alias with partial override", () => {
    const customAlias = getMockRandomAlias({
      enabled: false,
      description: "My custom description"
    });

    // Use customAlias in your test
  });
});
```

### One-Time Mock Overrides

Use `*Once()` methods when you need different data for a single test:

```typescript
import { setMockAliasesDataOnce } from "__mocks__/hooks/api/aliases";

it("handles empty state", () => {
  setMockAliasesDataOnce({ random: [] });
  render(<AliasList />);
  expect(screen.getByText("No aliases yet")).toBeInTheDocument();
});
```

### Testing with Feature Flags

Use the flags utilities for testing conditional features:

```typescript
import { setFlags, resetFlags, withFlag } from "__mocks__/functions/flags";

describe("Feature flag dependent component", () => {
  beforeEach(() => {
    resetFlags();
  });

  it("shows feature when flag is active", () => {
    setFlags({ new_feature: true });
    render(<Component />);
    expect(screen.getByTestId("new-feature")).toBeInTheDocument();
  });

  it("hides feature when flag is inactive", () => {
    setFlags({ new_feature: false });
    render(<Component />);
    expect(screen.queryByTestId("new-feature")).not.toBeInTheDocument();
  });

  it("uses withFlag for isolated flag testing", async () => {
    await withFlag("new_feature", true, () => {
      render(<Component />);
      expect(screen.getByTestId("new-feature")).toBeInTheDocument();
    });
  });
});
```

### Testing Localization

Use the l10n mock matchers for testing localized content:

```typescript
import { byMsgId } from "__mocks__/hooks/l10n";

it("displays localized text", () => {
  render(<Component />);
  expect(screen.getByText(byMsgId("welcome-message"))).toBeInTheDocument();
});

it("finds button by localized label", () => {
  render(<Component />);
  const button = screen.getByRole("button", { name: byMsgId("submit-button") });
  expect(button).toBeInTheDocument();
});
```

The mock l10n returns identifiable strings like `"l10n string: [message-id], with vars: {...}"` for easy testing.

### Accessibility Testing

Every component should have an accessibility test:

```typescript
import { axe } from "jest-axe";

it("passes axe accessibility testing", async () => {
  const { baseElement } = render(<Component />);
  const results = await axe(baseElement);
  expect(results).toHaveNoViolations();
});
```

## Best Practices

### 1. Use Accessibility-First Queries

Prefer queries that reflect how users interact with your app:

```typescript
// Good - accessible queries
screen.getByRole("button", { name: "Submit" });
screen.getByLabelText("Email address");
screen.getByRole("heading", { name: "Dashboard" });

// Avoid - implementation details
screen.getByTestId("submit-btn");
screen.getByClassName("email-input");
```

### 2. Use Mock Factories, Not Hardcoded Data

```typescript
// Good - configurable, maintainable
const alias = getMockRandomAlias({ enabled: false });
setMockProfileData({ has_premium: true });

// Avoid - brittle, hard to maintain
const alias = {
  id: 1,
  address: "test@relay.com",
  enabled: false,
  // ... 20 more required fields
};
```

### 3. Reset State Between Tests

```typescript
import { resetFlags } from "__mocks__/functions/flags";

describe("MyComponent", () => {
  beforeEach(() => {
    resetFlags();
    // Reset other global state
  });
});
```

Jest automatically clears all mocks between tests (`clearMocks: true` in config).

### 4. Test User Flows, Not Implementation

```typescript
// Good - tests behavior
it("allows user to create a new alias", async () => {
  render(<AliasGenerator />);
  await userEvent.click(screen.getByRole("button", { name: "Generate" }));
  expect(screen.getByText(/new alias created/i)).toBeInTheDocument();
});

// Avoid - tests implementation
it("calls createAlias function", () => {
  const createAlias = jest.fn();
  render(<AliasGenerator onGenerate={createAlias} />);
  // This tests the prop, not the user experience
});
```

### 5. Use `waitFor` for Async Behavior

```typescript
import { waitFor } from "@testing-library/react";

it("loads data asynchronously", async () => {
  render(<AsyncComponent />);

  await waitFor(() => {
    expect(screen.getByText("Data loaded")).toBeInTheDocument();
  });
});
```

### 6. Keep Tests Focused

One assertion per test when possible. Use descriptive test names.

```typescript
// Good - focused, clear
it("disables submit button when form is invalid", () => {
  render(<Form />);
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
});

it("enables submit button when form is valid", async () => {
  render(<Form />);
  await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
  expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
});

// Avoid - tests multiple unrelated things
it("works correctly", () => {
  // Tests 10 different behaviors
});
```

### 7. Don't Test External Libraries

Trust that React Testing Library, Next.js, etc. work correctly. Test your code.

```typescript
// Avoid - testing React Router
it("navigates to home page", () => {
  // Don't test that Next.js routing works
});

// Good - test your component's behavior
it("shows link to home page", () => {
  render(<Navigation />);
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
});
```

## Common Patterns

### Testing Forms

```typescript
it("submits form with valid data", async () => {
  const handleSubmit = jest.fn();
  render(<ContactForm onSubmit={handleSubmit} />);

  await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
  await userEvent.type(screen.getByLabelText("Message"), "Hello!");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(handleSubmit).toHaveBeenCalledWith({
    email: "user@example.com",
    message: "Hello!"
  });
});
```

### Testing Error States

```typescript
import { setMockProfileDataOnce } from "__mocks__/hooks/api/profile";

it("displays error when profile fetch fails", async () => {
  setMockProfileDataOnce(null); // Simulate error

  render(<Profile />);

  await waitFor(() => {
    expect(screen.getByText(/error loading profile/i)).toBeInTheDocument();
  });
});
```

### Testing Loading States

```typescript
it("shows loading indicator", () => {
  render(<DataComponent />);
  expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
});
```

### Testing Conditional Rendering

```typescript
it("shows premium features for premium users", () => {
  setMockProfileData({ has_premium: true });
  render(<Dashboard />);
  expect(screen.getByText(/premium feature/i)).toBeInTheDocument();
});

it("hides premium features for free users", () => {
  setMockProfileData({ has_premium: false });
  render(<Dashboard />);
  expect(screen.queryByText(/premium feature/i)).not.toBeInTheDocument();
});
```

### Testing Lists

```typescript
it("renders list of aliases", () => {
  const aliases = [
    getMockRandomAlias({ address: "alias1@relay.com" }),
    getMockRandomAlias({ address: "alias2@relay.com" }),
  ];
  setMockAliasesData({ random: aliases });

  render(<AliasList />);

  expect(screen.getByText("alias1@relay.com")).toBeInTheDocument();
  expect(screen.getByText("alias2@relay.com")).toBeInTheDocument();
});
```

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
