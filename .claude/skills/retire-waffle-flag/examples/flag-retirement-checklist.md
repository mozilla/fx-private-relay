# Waffle Flag Retirement Checklist Template

Use this checklist when retiring a Django waffle flag from Firefox Relay.

## Flag Information

**Flag name:** `_____________`
**Jira ticket:** `MPP-____`
**Date:** `____-__-__`
**Engineer:** `_____________`

**Flag purpose:**
_Brief description of what the flag controls_

**Behavior to keep:**

- [ ] Flag enabled (new behavior)
- [ ] Flag disabled (old behavior)

## Step 1: Search and Discovery

### Backend Search

```bash
grep -r "flag_name" --include="*.py" emails/ api/ privaterelay/
```

**Findings:**

- [ ] `____/____/____.py` line \_\_\_ (flag_is_active_in_task)
- [ ] `____/____/____.py` line \_\_\_ (flag_is_active)
- [ ] `____/____.py` line \_\_\_ (test with @override_flag)

### Frontend Search

```bash
grep -r "flag_name" --include="*.tsx" --include="*.ts" frontend/src/
```

**Findings:**

- [ ] `____/____/____.tsx` line \_\_\_ (isFlagActive)
- [ ] `____/____.tsx` line \_\_\_ (component conditional)
- [ ] `____/____.test.tsx` line \_\_\_ (test)

### Config Search

```bash
grep -r "flag_name" frontend/src/hooks/api/ frontend/__mocks__/
```

**Findings:**

- [ ] `runtimeData-default.ts` line \_\_\_
- [ ] `mockData.ts` line \_\_\_

## Step 2: Categorization

### Backend Files (\_\_ total)

| File | Type                | Action             | Lines |
| ---- | ------------------- | ------------------ | ----- |
|      | flag check          | Remove conditional |       |
|      | test (active=True)  | Remove decorator   |       |
|      | test (active=False) | Delete test        |       |

### Frontend Files (\_\_ total)

| File | Type      | Action             | Lines |
| ---- | --------- | ------------------ | ----- |
|      | component | Remove conditional |       |
|      | test      | Update/delete      |       |
|      | config    | Remove entry       |       |

### Components to Delete (\_\_ files)

- [ ] `____Component.tsx`
- [ ] `____Component.module.scss`
- [ ] `____Component.test.tsx`
- [ ] `____Modal.tsx`
- [ ] `____Modal.module.scss`
- [ ] `____Modal.test.tsx`

## Step 3: Implementation Plan

### 3.1 Backend Changes

**Files to modify:**

- [ ] `emails/validators.py`
  - Line \_\_\_: Remove if-else, keep if-true branch
  - Line \_\_\_: Remove flag_is_active_in_task import
- [ ] `emails/tests/validator_tests.py`
  - Line \_\_\_: Remove @override_flag decorator
- [ ] `emails/tests/models_tests.py`
  - Line \_\_\_: Delete test_old_behavior (entire test)
  - Line \_\_\_: Remove @override_flag from test_new_behavior
- [ ] `api/tests/emails_views_tests.py`
  - Line \_\_\_: Remove @override_flag decorator

### 3.2 Identify Orphaned Components (CRITICAL)

**For each old component in flag conditionals:**

| Component Name | Import Locations | Categorization | Orphaned? |
| -------------- | ---------------- | -------------- | --------- |
|                |                  |                |           |
|                |                  |                |           |

**Orphaned component file sets to delete:**

- [ ] `____Component.tsx` + `.module.scss` + `.test.tsx` (\_\_ lines total)
- [ ] `____Modal.tsx` + `.module.scss` + `.test.tsx` (\_\_ lines total)
- [ ] `____Button.tsx` + `.module.scss` + `.test.tsx` (\_\_ lines total)

**Total lines to delete:** ~\_\_\_ lines

**Deprecated files needing updates:**

- [ ] `____Deprecated.tsx` - imports deleted component

### 3.3 Delete Orphaned Components (DO EARLY)

- [ ] Deleted `____Component.tsx`
- [ ] Deleted `____Component.module.scss`
- [ ] Deleted `____Component.test.tsx`
- [ ] Deleted `____Modal.tsx`
- [ ] Deleted `____Modal.module.scss`
- [ ] Deleted `____Modal.test.tsx`

**Status:** Tests will break - this is expected!

### 3.4 Frontend Changes

**Files to modify:**

- [ ] `frontend/src/components/____/____.tsx`
  - Line \_\_\_: Remove isFlagActive conditional
  - Line \_\_\_: Keep <NewComponent />
  - Line \_\_\_: Remove <OldComponent />
  - Line \_\_\_: Remove OldComponent import
  - Line \_\_\_: Remove isFlagActive import (if unused)
- [ ] `frontend/src/components/____/____.tsx`
  - Line \_\_\_: Remove conditional
  - Line **_-_**: Delete onPickOld function (if exists)
- [ ] `frontend/src/components/____/____.test.tsx`
  - Line \_\_\_: Delete flag-controlled test
  - Line \_\_\_: Remove OldComponent mock

**Config files:**

- [ ] `frontend/src/hooks/api/runtimeData-default.ts`
  - Line \_\_\_: Remove ["flag_name", true]
- [ ] `frontend/__mocks__/api/mockData.ts`
  - Line \_\_\_: Remove ["flag_name", true]

### 3.5 Fix Deprecated Components (if needed)

**Files identified in step 3.2:**

- [ ] `____Deprecated.tsx`
  - Line \_\_\_: Update import to NewComponent
  - Line \_\_\_: Update usage
  - Line \_\_\_: Add comment about flag retirement

## Step 4: Execution

### 4.1 Make Backend Changes

- [ ] Modified: `emails/validators.py`
- [ ] Modified: `emails/tests/validator_tests.py`
- [ ] Modified: `emails/tests/models_tests.py`
- [ ] Modified: `api/tests/emails_views_tests.py`

### 4.2 Identified Orphaned Components

- [ ] Completed orphaned component analysis
- [ ] Listed all file sets to delete
- [ ] Total lines to delete: \_\_\_ lines

### 4.3 Deleted Orphaned Components (EARLY)

- [ ] Deleted: `____Component.*` files
- [ ] Deleted: `____Modal.*` files
- [ ] Deleted: `____Button.*` files
- [ ] Tests now break (expected!)

### 4.4 Make Frontend Changes

- [ ] Modified: Component files
- [ ] Modified: Test files
- [ ] Modified: Config files

### 4.5 Fix Deprecated Components

- [ ] Updated: Deprecated component imports

## Step 5: Testing and Validation

### 5.1 Backend Tests

```bash
pytest emails/tests/validator_tests.py::TestClass::test_name -v
pytest emails/tests/models_tests.py::TestClass::test_name -v
pytest api/tests/emails_views_tests.py::test_name -v
```

**Results:**

- [ ] validator_tests.py: PASSED
- [ ] models_tests.py: PASSED
- [ ] emails_views_tests.py: PASSED

**Full backend test:**

```bash
pytest
```

- [ ] All backend tests: PASSED

### 5.2 Frontend Tests

```bash
npm test -- ComponentName.test.tsx
npm test -- AnotherComponent.test.tsx
```

**Results:**

- [ ] Component test 1: PASSED
- [ ] Component test 2: PASSED

**Full frontend test:**

```bash
npm test
```

- [ ] All frontend tests: PASSED

### 5.3 Verification

**Check 1: No flag references remain**

```bash
grep -r "flag_name" --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=out --exclude-dir=.next .
```

- [ ] No references found in source code

**Check 2: No orphaned components remain (CRITICAL)**

```bash
# Verify each component from step 4.3 is deleted
find frontend/src -name "____Component.*"
find frontend/src -name "____Modal.*"
find frontend/src -name "____Button.*"
```

- [ ] No component files found
- [ ] No style files found
- [ ] No test files found

**Check 3: No orphaned imports remain**

```bash
# Check deleted components not imported
grep -r "import.*____Component" --include="*.tsx" frontend/src/
grep -r "import.*____Modal" --include="*.tsx" frontend/src/
```

- [ ] No imports found (except fixed deprecated files)

**Check 4: No unused waffle imports**

```bash
# Check modified files for unused isFlagActive
grep -n "isFlagActive" frontend/src/modified/files/*.tsx
```

- [ ] Either no matches or import still used for other flags

**Check 5: Build succeeds**

```bash
npm run build
```

- [ ] Frontend build: SUCCESS

## Step 6: Commit

### Commit Message

```
refactor: retire flag_name waffle flag

Remove flag and keep new behavior. Flag was added in [date] and is now default.

Changes:
- Backend always [describe behavior]
- Frontend uses [NewComponent] and [NewModal]
- Delete legacy [OldComponent] and [OldModal] components
- Remove flag from configs and tests

Closes MPP-____

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Commit and Push

```bash
git add -A
git commit -m "..."
git push
```

- [ ] Committed changes
- [ ] Pushed to remote

## Step 7: Follow-up

### Database Cleanup

**After deployment**, delete flag from databases or file ticket:

- [ ] Dev environment: Flag deleted
- [ ] Stage environment: Flag deleted
- [ ] Production environment: Flag deleted

**OR**

- [ ] Filed follow-up ticket: **\_\_\_\_**

## Summary

**Files modified:** \*\*
**Files deleted:** \*\*
**Tests updated:** \*\*
**Lines changed:** +\_** -**_
**Time spent:** _** minutes
**Cost:\*\* ~$\_\_\_

### Completeness Check

**Lines removed:** \_\_\_ lines

Completeness assessment:

- [ ] **Incomplete (<200 lines):** Flag only, dead code remains
- [ ] **Partial (200-500 lines):** Flag + some components, review step 4.2-4.3
- [ ] **Complete (500-1500+ lines):** Flag + ALL orphaned components ✓

If <300 lines removed, review orphaned component analysis in step 4.2.

---

## Notes

_Add any notes about unusual issues, decisions, or things to remember:_

-
-
-
