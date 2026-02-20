# Common Issues When Retiring Waffle Flags

Troubleshooting guide for common problems encountered during flag retirement.

## Issue 1: Deprecated Component Breakage

### Symptom

```
Cannot find module './OldComponent' from 'src/components/Deprecated.tsx'
```

Test suites fail with module not found errors after deleting legacy components.

### Cause

Deprecated components still import deleted legacy components.

### Example

```typescript
// Deprecated component marked with TODO
// Deprecated, flag "mask_redesign" is in use and uses <MaskCard/> instead
// TODO MPP-4463: Remove code and tests

import { OldComponent } from "./OldComponent"; // File was deleted!
```

### Solution

**Step 1: Identify affected deprecated components**

```bash
grep -r "OldComponent" --include="*.tsx" frontend/src/
```

**Step 2: Update imports in deprecated files**

```typescript
// BEFORE
import { OldComponent } from "./OldComponent";

// AFTER
import { NewComponent } from "./NewComponent";
```

**Step 3: Update usage**

```typescript
// BEFORE
<OldComponent onAction={props.onAction} data={props.data} />

// AFTER
<NewComponent onAction={props.onAction} data={props.data} />
```

**Step 4: Update test mocks**

```typescript
// In test file
// BEFORE
jest.mock("./OldComponent", () => ({
  /* ... */
}));

// AFTER
jest.mock("./NewComponent", () => ({
  /* ... */
}));
```

### Prevention

Before deleting legacy components, search for all imports:

```bash
grep -r "ComponentName" --include="*.tsx" --include="*.ts" frontend/src/
```

## Issue 2: Test Cascade Failures

### Symptom

Multiple test files fail after deleting legacy component:

```
FAIL  src/components/AliasList.test.tsx
FAIL  src/pages/profile.test.tsx
FAIL  src/components/FreeOnboarding.test.tsx
```

All with same error: `Cannot find module './OldComponent'`

### Cause

Legacy component was imported and used in many files, including deprecated ones.

### Solution

**Step 1: Find all affected files**

```bash
# Find all test imports
grep -r "OldComponent" --include="*.test.tsx" frontend/src/

# Find all component imports
grep -r "OldComponent" --include="*.tsx" frontend/src/
```

**Step 2: Update each file**
For each file found, apply the same fix as Issue 1.

**Step 3: Run tests incrementally**

```bash
# Test each fixed file
npm test -- FileName.test.tsx

# When all pass, run full suite
npm test
```

### Prevention

Use grep to identify all usages before deletion:

```bash
grep -r "ComponentName" \
  --include="*.tsx" \
  --include="*.ts" \
  --exclude-dir=node_modules \
  frontend/
```

## Issue 3: Modal UX Differences

### Symptom

Tests fail with:

```
Unable to find a label with the text of: "modal-delete-confirmation"
```

### Cause

New component has different UX flow than old component.

Common differences:

- Old modal: Confirmation checkbox before delete button
- New modal: Direct delete button (no checkbox)

### Example

```typescript
// BEFORE: Test expects checkbox
const checkbox = screen.getByLabelText(
  "l10n string: [modal-delete-confirmation-2]",
);
await user.click(checkbox);

const deleteButton = screen.getAllByRole("button", { name: "Delete" });
await user.click(deleteButton[1]);

// AFTER: New modal has no checkbox
const deleteButton = screen.getAllByRole("button", { name: "Delete" });
await user.click(deleteButton[1]);
```

### Solution

**Step 1: Understand new component UX**
Read new component code to see what elements exist:

```typescript
// Check what the new component renders
<AliasDeletionButtonPermanent
  onDelete={onDelete}
  alias={alias}
/>
```

**Step 2: Update test to match new UX**
Remove steps that don't exist in new component:

```typescript
// DELETE: Checkbox interaction
const checkbox = screen.getByLabelText("confirmation");
await user.click(checkbox);

// KEEP: Button click
const deleteButton = screen.getByRole("button", { name: "Delete" });
await user.click(deleteButton);
```

**Step 3: Add comment explaining change**

```typescript
// The new permanent deletion modal doesn't have a checkbox
const deleteButton = screen.getAllByRole("button", { name: "Delete" });
await user.click(deleteButton[1]);
```

### Prevention

Review new component UX before updating tests.

## Issue 4: Import Cleanup Missed

### Symptom

Linter warnings or unused import errors:

```
'isFlagActive' is defined but never used
'OldComponent' is defined but never used
```

### Cause

Removed flag checks but forgot to remove imports.

### Solution

**Step 1: Check for other usages**

```bash
grep -n "isFlagActive" path/to/file.tsx
grep -n "OldComponent" path/to/file.tsx
```

**Step 2: Remove if not used**

```typescript
// BEFORE
import { isFlagActive } from "../../../functions/waffle";
import { NewComponent } from "./NewComponent";
import { OldComponent } from "./OldComponent";

// AFTER (if not used elsewhere)
import { NewComponent } from "./NewComponent";
```

**Step 3: Remove waffle import if not used**

```typescript
// Check if any other flags checked in file
grep "isFlagActive" file.tsx

// If none, remove import
import { isFlagActive } from "../../../functions/waffle";  // DELETE
```

### Prevention

After removing flag checks, always search file for import usage:

```bash
grep -n "ImportName" file.tsx
```

## Issue 5: Config Synchronization

### Symptom

Mock data doesn't match default runtime data:

- Tests pass locally
- Tests fail in CI

### Cause

Flag removed from one config file but not the other.

### Files to check

```
frontend/src/hooks/api/runtimeData-default.ts  (default config)
frontend/__mocks__/api/mockData.ts             (mock config)
```

### Solution

**Step 1: Remove from both files**

```typescript
// runtimeData-default.ts
WAFFLE_FLAGS: [
  ["other_flag", true],
  ["flag_name", true], // DELETE
];

// mockData.ts
WAFFLE_FLAGS: [
  ["other_flag", true],
  ["flag_name", true], // DELETE
];
```

**Step 2: Verify arrays match**

```bash
# Compare flag lists
grep -A 20 "WAFFLE_FLAGS" frontend/src/hooks/api/runtimeData-default.ts
grep -A 20 "WAFFLE_FLAGS" frontend/__mocks__/api/mockData.ts
```

### Prevention

Always update both config files in same commit.

## Issue 6: Test Mock Function Mismatch

### Symptom

```
TypeError: Cannot read property 'setModalOpenedState' of undefined
```

### Cause

New component requires props that old component didn't.

### Example

```typescript
// Old component
<OldComponent
  onDelete={onDelete}
  alias={alias}
/>

// New component needs additional prop
<NewComponent
  onDelete={onDelete}
  alias={alias}
  setModalOpenedState={setModalOpenedState}  // NEW PROP
/>
```

### Solution

**Step 1: Add missing props to test**

```typescript
// BEFORE
const { onDelete } = renderComponent({
  alias: mockAlias,
  onDelete: jest.fn(),
});

// AFTER
const { onDelete } = renderComponent({
  alias: mockAlias,
  onDelete: jest.fn(),
  setModalOpenedState: jest.fn(), // ADD
});
```

**Step 2: Update mock implementation**

```typescript
jest.mock("./NewComponent", () => ({
  NewComponent: ({
    onDelete,
    alias,
    setModalOpenedState  // ADD TO MOCK
  }: Props) => (
    <button onClick={onDelete}>Delete</button>
  ),
}));
```

### Prevention

Compare prop types of old vs new components before updating tests.

## Issue 7: Circular Dependencies

### Symptom

```
Dependency cycle detected
```

### Cause

Updating deprecated component creates circular import.

### Solution

**Step 1: Identify cycle**

```bash
npm run build  # Shows circular dependency path
```

**Step 2: Break cycle**
Usually caused by deprecated component trying to import from file that imports it.

**Step 3: Consider deletion**
If component is deprecated, consider deleting it instead of fixing imports.

### Prevention

Check import graph before modifying deprecated files.

## Issue 8: Build Output Not Cleaned

### Symptom

Tests pass but flag still referenced in built files.

### Cause

Old build artifacts remain in `out/` or `.next/` directories.

### Solution

```bash
# Clean build artifacts
rm -rf frontend/out frontend/.next

# Rebuild
npm run build
```

### Prevention

Clean before final validation:

```bash
npm run clean
npm run build
npm test
```

## Quick Troubleshooting Checklist

When tests fail after flag retirement:

- [ ] Check for deprecated components importing deleted files
- [ ] Search for all imports of deleted component
- [ ] Update test mocks to match new component
- [ ] Remove unused imports (isFlagActive, old components)
- [ ] Verify config files synchronized (runtimeData-default.ts, mockData.ts)
- [ ] Check new component prop requirements
- [ ] Clean build artifacts
- [ ] Run tests incrementally (file by file)
- [ ] Search for remaining flag references

## Getting Help

If stuck, search for similar patterns:

```bash
# Find other retired flags for examples
git log --all --grep="retire.*flag"

# Look for similar test patterns
grep -r "jest.mock" frontend/src/**/*.test.tsx
```

Check recent commits for flag retirement examples.
