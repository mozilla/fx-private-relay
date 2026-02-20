---
name: Retire Django Waffle Flag
description: This skill should be used when the user asks to "retire a waffle flag", "remove a Django waffle flag", "delete a feature flag", or mentions "flag retirement" in the context of the Firefox Relay codebase.
version: 1.0.0
---

# Retire Django Waffle Flag

Retire a Django waffle feature flag from the Firefox Relay codebase by removing all conditional logic and keeping only the flag-enabled (new) behavior.

## Overview

Waffle flags control feature behavior through conditionals. Retirement means:

- Remove all flag checks
- Keep flag-enabled behavior (new code)
- Delete flag-disabled code (legacy code)
- Delete legacy components
- Clean up tests and configs

## 5-Step Workflow

### Step 1: Search for all flag references

Run these commands to find all usages:

```bash
# Backend: Python/Django code
grep -r "flag_name" --include="*.py" emails/ api/ privaterelay/

# Frontend: TypeScript/React code
grep -r "flag_name" --include="*.tsx" --include="*.ts" frontend/src/

# Tests
grep -r "flag_name" --include="*test*.py" --include="*test*.tsx"

# Config files
grep -r "flag_name" frontend/src/hooks/api/ frontend/__mocks__/
```

### Step 2: Analyze and categorize findings

Group findings by type:

| Type                | Location                                       | Action                                  |
| ------------------- | ---------------------------------------------- | --------------------------------------- |
| Backend flag check  | `flag_is_active_in_task("flag_name", ...)`     | Remove conditional, keep if-true branch |
| Frontend flag check | `isFlagActive(props.runtimeData, "flag_name")` | Remove conditional, keep true branch    |
| Test decorator      | `@override_flag("flag_name", active=True)`     | Remove decorator                        |
| Test decorator      | `@override_flag("flag_name", active=False)`    | Delete entire test                      |
| Config entry        | `["flag_name", true]` in WAFFLE_FLAGS          | Remove array entry                      |
| Legacy component    | Component only used when flag=false            | Delete file + styles + tests            |

### Step 3: Plan the changes

Create a checklist:

- List files to modify (with line numbers)
- List files to delete
- Identify which behavior to keep (usually flag=true)
- Note deprecated components that might break

### Step 4: Execute changes

Work in this order:

**4.1 Backend changes**

```python
# BEFORE: Conditional check
if flag_is_active_in_task("flag_name", user):
    new_behavior()
else:
    old_behavior()

# AFTER: Always use new behavior
new_behavior()
```

Remove imports if unused:

```python
# Remove if not used elsewhere in file
from privaterelay.utils import flag_is_active_in_task
```

**4.2 Identify orphaned components (CRITICAL)**

Before proceeding, identify components that will become orphaned after flag removal.

**For each old component in the false/else branches:**

1. **Search for ALL imports of the component:**

```bash
grep -r "import.*OldComponent" --include="*.tsx" --include="*.ts" frontend/src/
```

2. **Categorize each import:**
   - Used in flag conditional being removed → Will be removed
   - Used in deprecated file → Needs update (mark for step 4.5)
   - Used in active code → NOT orphaned, KEEP IT

3. **If ONLY used in conditionals being removed → ORPHANED**

4. **List ALL files to delete:**
   - Component file: `OldComponent.tsx`
   - Styles file: `OldComponent.module.scss`
   - Test file: `OldComponent.test.tsx`

**Orphaned components checklist:**

- [ ] Identified all old components from step 2 analysis
- [ ] Searched imports for each component
- [ ] Categorized each import (conditional/deprecated/active)
- [ ] Listed complete file sets to delete (.tsx + .scss + .test.tsx)
- [ ] Noted deprecated files needing updates

**Example:**

```bash
# Flag check shows:
{isFlagActive(data, "flag") ? <NewModal /> : <OldModal />}

# Search for OldModal:
grep -r "OldModal" --include="*.tsx" frontend/src/

# Results:
# - AliasGen.tsx:89  → In flag conditional (ORPHANED)
# - Alias.tsx:42     → Deprecated file (NEEDS UPDATE)

# Conclusion: OldModal is ORPHANED
# Delete: OldModal.tsx, OldModal.module.scss, OldModal.test.tsx
# Update: Alias.tsx imports
```

**STOP:** Do not proceed until orphaned components are identified.

**4.3 Delete orphaned components (DO THIS EARLY)**

Delete orphaned components NOW, before tests pass. This forces fixing import issues.

```bash
# Delete each orphaned component set
rm frontend/src/components/path/OldComponent.tsx
rm frontend/src/components/path/OldComponent.module.scss
rm frontend/src/components/path/OldComponent.test.tsx
```

**Why delete early?**

- Tests will break immediately
- Forces you to fix imports and usage
- Prevents "tests pass, skip deletion" scenario
- Ensures complete cleanup

**4.4 Frontend component changes**

```typescript
// BEFORE: Conditional rendering
{isFlagActive(props.runtimeData, "flag_name") ? (
  <NewComponent />
) : (
  <OldComponent />
)}

// AFTER: Always render new component
<NewComponent />
```

Remove imports if unused:

```typescript
// Remove if not used elsewhere
import { isFlagActive } from "../../../functions/waffle";
import { OldComponent } from "./OldComponent";
```

**4.5 Fix deprecated components (if needed)**

If deprecated components import deleted components, update them NOW:

```typescript
// Deprecated component that breaks
import { OldComponent } from "./OldComponent";  // File deleted!

// Fix by updating to new component
import { NewComponent } from "./NewComponent";

// Update usage to match new component props
<OldComponent prop={value} />  // Old way
<NewComponent prop={value} additionalProp={value2} />  // New way
```

Add comment explaining why deprecated file wasn't deleted:

```typescript
// Deprecated: marked for removal in MPP-XXXX
// Updated to use NewComponent after flag retirement
```

**4.6 Test file changes**

```python
# Remove decorator from tests that verify new behavior
@override_flag("flag_name", active=True)  # DELETE THIS LINE
def test_new_behavior(self):
    # Keep test body
    assert new_behavior_works

# Delete entire tests that verify old behavior
@override_flag("flag_name", active=False)  # DELETE ENTIRE TEST
def test_old_behavior(self):
    assert old_behavior_works
```

Remove imports if unused:

```python
from waffle.testutils import override_flag  # Remove if not used
```

**4.7 Config file changes**

```typescript
// frontend/src/hooks/api/runtimeData-default.ts
WAFFLE_FLAGS: [
  ["other_flag", true],
  ["flag_name", true], // DELETE THIS LINE
  ["another_flag", true],
];

// frontend/__mocks__/api/mockData.ts
WAFFLE_FLAGS: [
  ["other_flag", true],
  ["flag_name", true], // DELETE THIS LINE
  ["another_flag", true],
];
```

### Step 5: Test and validate

**5.1 Run backend tests**

```bash
# Run specific tests
pytest emails/tests/validator_tests.py -v
pytest api/tests/ -v

# Run full backend suite
pytest
```

**5.2 Run frontend tests**

```bash
# Run component tests
npm test -- ComponentName

# Run full frontend suite
npm test
```

**5.3 Verify complete cleanup**

**Check 1: No flag references remain**

```bash
grep -r "flag_name" --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=out --exclude-dir=.next .
```

Expected: No matches in source code

**Check 2: No orphaned components remain (CRITICAL)**

For EACH component from step 4.2, verify complete deletion:

```bash
# Example: Verify AddressPickerModal is deleted
find frontend/src -name "AddressPickerModal.*"
```

Expected: No files found

If files found:

- Review why they weren't deleted in step 4.3
- Verify they are truly orphaned (not used in active code)
- Delete them now

Repeat for ALL components from step 4.2 orphan list.

**Check 3: No orphaned imports remain**

For EACH deleted component, verify no imports remain:

```bash
# Example: Check AddressPickerModal imports
grep -r "import.*AddressPickerModal" --include="*.tsx" --include="*.ts" frontend/src/
```

Expected: No matches (or only in deprecated files you updated in step 4.5)

If imports found:

- In deprecated files → Did you update them in step 4.5?
- In active files → Component may not be orphaned, investigate
- In test files → Update or remove the test

Repeat for ALL deleted components from step 4.3.

**Check 4: No test mocks of deleted components**

```bash
# Example: Check for test mocks
grep -r "jest.mock.*AddressPickerModal" --include="*.test.tsx" frontend/src/
```

Expected: No matches

If mocks found: Remove the mock from the test file.

**Check 5: No unused waffle imports**

Check files you modified for unused isFlagActive imports:

```bash
# Example: Check if isFlagActive still used
grep -n "isFlagActive" frontend/src/components/aliases/MaskCard.tsx
```

Expected: Either:

- No matches (import was removed) ✓
- Matches show import used for OTHER flags ✓
- Only import line, no usage → Remove the import

## Quick Patterns Reference

### Backend Patterns

**Pattern 1: Simple conditional**

```python
# BEFORE
if flag_is_active_in_task("flag_name", None):
    check_something()

# AFTER
check_something()
```

**Pattern 2: If-else choice**

```python
# BEFORE
if flag_is_active_in_task("flag_name", user):
    return new_algorithm()
else:
    return old_algorithm()

# AFTER
return new_algorithm()
```

**Pattern 3: Early return**

```python
# BEFORE
if not flag_is_active_in_task("flag_name", user):
    return

do_new_thing()

# AFTER
do_new_thing()
```

### Frontend Patterns

**Pattern 1: Component choice**

```typescript
// BEFORE
{isFlagActive(data, "flag_name") ? <NewComp /> : <OldComp />}

// AFTER
<NewComp />
```

**Pattern 2: With complex props**

```typescript
// BEFORE
{isFlagActive(data, "flag_name") ? (
  <NewModal
    isOpen={state.isOpen}
    onClose={close}
    data={data}
  />
) : (
  <OldModal
    isOpen={state.isOpen}
    onClose={close}
  />
)}

// AFTER
<NewModal
  isOpen={state.isOpen}
  onClose={close}
  data={data}
/>
```

**Pattern 3: With function callback**

```typescript
// BEFORE: Old function only used by old component
const onPickOld = (value: string) => {
  handleOld(value);
  close();
};

const dialog = isFlagActive(data, "flag_name") ? (
  <NewModal onPick={onPickNew} />
) : (
  <OldModal onPick={onPickOld} />
);

// AFTER: Delete onPickOld function
const dialog = <NewModal onPick={onPickNew} />;
```

## Test Patterns

**Keep test, remove decorator:**

```python
# This tests desired behavior - keep it
@override_flag("flag_name", active=True)  # REMOVE
def test_prevents_deleted_address_reuse(self):
    # Test body stays
```

**Delete entire test:**

```python
# This tests old behavior - delete it
@override_flag("flag_name", active=False)  # DELETE ENTIRE TEST
def test_allows_deleted_address_reuse(self):
    # This behavior no longer supported
```

**Test mock updates:**

```typescript
// BEFORE: Mock for both components
jest.mock("./OldComponent", () => ({
  /* ... */
}));
jest.mock("./NewComponent", () => ({
  /* ... */
}));

// AFTER: Remove old component mock
jest.mock("./NewComponent", () => ({
  /* ... */
}));
```

## Common Issues

**Issue 1: Deprecated components break**

If you see errors like `Cannot find module './OldComponent'` in deprecated files:

- Update deprecated component to import new component
- Update usage to match new component props
- See `references/common-issues.md` for details

**Issue 2: Test cascades fail**

Multiple test files may fail when legacy component is deleted:

- Find all imports of deleted component
- Update to use new component
- Adjust test expectations for new component behavior

**Issue 3: Modal behavior differences**

Old vs new components may have different UX:

- New modal may skip confirmation checkbox
- Update tests to match new UX flow
- See `references/frontend-patterns.md` for examples

## Validation Checklist

Before completing flag retirement:

- [ ] Search found all flag references (Step 1)
- [ ] Categorized changes (backend, frontend, tests, config) (Step 2)
- [ ] Identified correct behavior to keep (flag-enabled) (Step 3)
- [ ] Modified backend files (removed conditionals) (Step 4.1)
- [ ] **Identified orphaned components (Step 4.2) - CRITICAL**
- [ ] **Deleted orphaned components (Step 4.3) - CRITICAL**
- [ ] Modified frontend files (removed conditionals) (Step 4.4)
- [ ] Fixed deprecated component imports (if any) (Step 4.5)
- [ ] Updated test files (removed decorators, deleted old tests) (Step 4.6)
- [ ] Updated config files (removed flag entries) (Step 4.7)
- [ ] Backend tests pass (Step 5.1)
- [ ] Frontend tests pass (Step 5.2)
- [ ] **No orphaned component files remain (Step 5.3.2) - CRITICAL**
- [ ] **No orphaned imports remain (Step 5.3.3) - CRITICAL**
- [ ] No flag references remain in source (Step 5.3.1)
- [ ] **PR removes 500+ lines (if fewer, review step 4.2-4.3)**
- [ ] Committed changes with conventional commit message

## Detailed References

For detailed patterns and troubleshooting:

- `references/backend-patterns.md` - Django/Python patterns
- `references/frontend-patterns.md` - TypeScript/React patterns
- `references/common-issues.md` - Troubleshooting guide

For templates and examples:

- `examples/flag-retirement-checklist.md` - Step-by-step checklist template

## Completeness Metrics

A complete flag retirement should show significant code deletion. If your PR removes <300 lines, you likely missed orphaned components.

### Expected Deletion Ranges

| Cleanup Level  | Lines Removed | What's Included                               |
| -------------- | ------------- | --------------------------------------------- |
| **Incomplete** | 50-200        | Flag references only, dead code remains       |
| **Partial**    | 200-500       | Flag + some components, orphans likely remain |
| **Complete**   | 500-1500+     | Flag + ALL orphaned components deleted        |

### Verification Checklist

Before submitting your PR, verify:

- [ ] Backend flag conditionals removed
- [ ] Frontend flag conditionals removed
- [ ] Config flag entries removed
- [ ] Old behavior tests deleted
- [ ] **Legacy components deleted** (this is usually 70-90% of the work)
- [ ] Deprecated components updated
- [ ] All tests pass

**Example: custom_domain_management_redesign flag**

- Incomplete cleanup: 109 lines removed (flag only)
- Complete cleanup: 1,280 lines removed (flag + components)

### Cost Savings

Using this skill with complete cleanup reduces:

- Token usage: ~70% (from ~160k to ~50k tokens)
- Cost: ~70% (from ~$4.00 to ~$1.30)
- Time: ~50% (from ~40min to ~20min)
- **Maintenance burden: Eliminates 500-1500 lines of dead code**
