# Frontend Patterns for Django Waffle Flag Retirement

Detailed patterns for retiring waffle flags in TypeScript/React code.

## Flag Check Function

### isFlagActive

Used throughout React components:

```typescript
import { isFlagActive } from "../../../functions/waffle";

// Check if flag is active
if (isFlagActive(props.runtimeData, "flag_name")) {
  return <NewComponent />;
}
```

**Retirement:**
Remove conditional, keep flag-enabled rendering.

## Component Patterns

### Pattern 1: Conditional Rendering

```typescript
// BEFORE
{isFlagActive(props.runtimeData, "flag_name") ? (
  <NewComponent
    prop1={value1}
    prop2={value2}
  />
) : (
  <OldComponent
    prop1={value1}
  />
)}

// AFTER
<NewComponent
  prop1={value1}
  prop2={value2}
/>
```

### Pattern 2: With Complex Props

```typescript
// BEFORE
const dialog = modalState.isOpen ? (
  isFlagActive(props.runtimeData, "flag_name") ? (
    <CustomAddressGenerationModal
      isOpen={modalState.isOpen}
      onClose={() => modalState.close()}
      onUpdate={onSuccessClose}
      onPick={onPick}
      subdomain={props.subdomain}
      aliasGeneratedState={aliasGeneratedState}
      findAliasDataFromPrefix={props.findAliasDataFromPrefix}
    />
  ) : (
    <AddressPickerModal
      isOpen={modalState.isOpen}
      onClose={() => modalState.close()}
      onPick={onPickNonRedesign}
      subdomain={props.subdomain}
    />
  )
) : null;

// AFTER
const dialog = modalState.isOpen ? (
  <CustomAddressGenerationModal
    isOpen={modalState.isOpen}
    onClose={() => modalState.close()}
    onUpdate={onSuccessClose}
    onPick={onPick}
    subdomain={props.subdomain}
    aliasGeneratedState={aliasGeneratedState}
    findAliasDataFromPrefix={props.findAliasDataFromPrefix}
  />
) : null;
```

### Pattern 3: With Callback Functions

```typescript
// BEFORE
const onPickNew = (address: string, settings: Settings) => {
  props.onCreate({
    mask_type: "custom",
    address: address,
    blockPromotionals: settings.blockPromotionals,
  });
  modalState.close();
};

const onPickOld = (address: string, settings: Settings) => {
  props.onCreate({
    mask_type: "custom",
    address: address,
    blockPromotionals: settings.blockPromotionals,
  });
  modalState.close();
};

const dialog = isFlagActive(props.runtimeData, "flag_name") ? (
  <NewModal onPick={onPickNew} />
) : (
  <OldModal onPick={onPickOld} />
);

// AFTER (delete onPickOld function)
const onPickNew = (address: string, settings: Settings) => {
  props.onCreate({
    mask_type: "custom",
    address: address,
    blockPromotionals: settings.blockPromotionals,
  });
  modalState.close();
};

const dialog = <NewModal onPick={onPickNew} />;
```

### Pattern 4: Component in JSX

```typescript
// BEFORE
return (
  <div className={styles.container}>
    {isFlagActive(props.runtimeData, "flag_name") ? (
      <AliasDeletionButtonPermanent
        setModalOpenedState={props.setModalOpenedState}
        onDelete={props.onDelete}
        alias={props.mask}
      />
    ) : (
      <AliasDeletionButton
        onDelete={props.onDelete}
        alias={props.mask}
      />
    )}
  </div>
);

// AFTER
return (
  <div className={styles.container}>
    <AliasDeletionButtonPermanent
      setModalOpenedState={props.setModalOpenedState}
      onDelete={props.onDelete}
      alias={props.mask}
    />
  </div>
);
```

### Pattern 5: Conditional Logic

```typescript
// BEFORE
const showFeature = isFlagActive(props.runtimeData, "flag_name");

return (
  <div>
    {showFeature && <NewFeatureComponent />}
    {!showFeature && <OldFeatureComponent />}
  </div>
);

// AFTER
return (
  <div>
    <NewFeatureComponent />
  </div>
);
```

## Import Cleanup

### Removing isFlagActive

```typescript
// BEFORE
import { isFlagActive } from "../../../functions/waffle";
import { NewComponent } from "./NewComponent";
import { OldComponent } from "./OldComponent";

// Check if used elsewhere in file
// Search for: isFlagActive

// AFTER (if not used elsewhere)
import { NewComponent } from "./NewComponent";
```

### Removing Old Component Imports

```typescript
// BEFORE
import { AliasDeletionButton } from "./AliasDeletionButton";
import { AliasDeletionButtonPermanent } from "./AliasDeletionButtonPermanent";

// AFTER
import { AliasDeletionButtonPermanent } from "./AliasDeletionButtonPermanent";
```

## Identifying Orphaned Components (CRITICAL)

Before deleting components, identify which ones are truly orphaned.

### Orphaned vs. Still-Used Components

**Orphaned component:** Only used in flag conditionals being removed
**Still-used component:** Also used in active code paths

### Detection Process

**Step 1: Extract old components from flag conditionals**

Look at each conditional being removed:

```typescript
// Example 1: Component conditional
{isFlagActive(data, "flag") ? <NewModal /> : <OldModal />}
// → OldModal is a candidate for deletion

// Example 2: Import conditional
isFlagActive(data, "flag") ? (
  <CustomAddressGenerationModal ... />
) : (
  <AddressPickerModal ... />
)
// → AddressPickerModal is a candidate
```

**Step 2: Search for ALL usages of candidate component**

```bash
# Search for every import and usage
grep -rn "OldModal" --include="*.tsx" --include="*.ts" frontend/src/

# Output example:
# AliasGenerationButton.tsx:87   → In flag conditional (will be removed)
# Alias.tsx:42                   → In deprecated component (needs update)
# MaskCreation.test.tsx:12       → In test mock (will be removed with test)
```

**Step 3: Categorize each usage**

| Location Type                     | Action          | Orphaned? |
| --------------------------------- | --------------- | --------- |
| In flag conditional being removed | Will be removed | Yes ✓     |
| In deprecated file                | Needs update    | Yes ✓     |
| In test of removed conditional    | Will be removed | Yes ✓     |
| In active code path               | Keep using it   | No ✗      |

**Step 4: Verify component is orphaned**

Component is orphaned if:

- ✓ ALL usages are in code being removed
- ✓ OR only used in deprecated files
- ✗ ANY usage in active code → NOT orphaned, keep it

### Example: Complete Analysis

```bash
# Flag shows:
{isFlagActive(data, "custom_domain_management_redesign") ? (
  <CustomAddressGenerationModal />
) : (
  <AddressPickerModal />
)}

# Search for AddressPickerModal:
grep -rn "AddressPickerModal" --include="*.tsx" frontend/src/

# Results:
# AliasGenerationButton.tsx:245  - import statement
# AliasGenerationButton.tsx:369  - Usage in flag conditional
# → Both in same file, both in conditional being removed

# Conclusion: AddressPickerModal is ORPHANED
# Delete:
#   - AddressPickerModal.tsx (241 lines)
#   - AddressPickerModal.module.scss (194 lines)
#   - AddressPickerModal.test.tsx (221 lines)
# Total: 656 lines removed
```

### Orphaned Component Checklist

For each flag conditional with old component:

- [ ] Extracted old component name
- [ ] Searched ALL usages (grep entire codebase)
- [ ] Categorized each usage location
- [ ] Verified NO active code uses it
- [ ] Identified file set (.tsx + .scss + .test.tsx)
- [ ] Added to deletion list

**CRITICAL:** Do not proceed to deletion until ALL old components are analyzed.

## Component Deletion

### Step 1: Delete component files (from orphaned analysis)

```bash
rm frontend/src/components/path/OldComponent.tsx
rm frontend/src/components/path/OldComponent.module.scss
rm frontend/src/components/path/OldComponent.test.tsx
```

**Delete early:** Before tests pass, to force fixing imports.

### Step 2: Handle deprecated components

If deprecated components imported deleted component:

```typescript
// Deprecated component that breaks
import { OldComponent } from "./OldComponent";  // File deleted!

// Fix by updating to new component
import { NewComponent } from "./NewComponent";

// Update usage to match new component props
<OldComponent prop={value} />  // Old way
<NewComponent prop={value} />  // New way
```

## Config File Patterns

### Pattern 1: runtimeData-default.ts

```typescript
// BEFORE
export const DEFAULT_RUNTIME_DATA: RuntimeData = {
  // ... other fields ...
  WAFFLE_FLAGS: [
    ["free_user_onboarding", true],
    ["tracker_removal", true],
    ["flag_name", true], // DELETE THIS LINE
    ["phones", true],
    ["mask_redesign", true],
  ],
};

// AFTER
export const DEFAULT_RUNTIME_DATA: RuntimeData = {
  // ... other fields ...
  WAFFLE_FLAGS: [
    ["free_user_onboarding", true],
    ["tracker_removal", true],
    ["phones", true],
    ["mask_redesign", true],
  ],
};
```

### Pattern 2: mockData.ts

```typescript
// BEFORE
export const mockedRuntimeData: RuntimeData = {
  // ... other fields ...
  WAFFLE_FLAGS: [
    ["tracker_removal", true],
    ["phone_launch_survey", true],
    ["flag_name", true], // DELETE THIS LINE
    ["mask_redesign", true],
  ],
};

// AFTER
export const mockedRuntimeData: RuntimeData = {
  // ... other fields ...
  WAFFLE_FLAGS: [
    ["tracker_removal", true],
    ["phone_launch_survey", true],
    ["mask_redesign", true],
  ],
};
```

## Test Patterns

### Pattern 1: Component test with flag check

```typescript
// BEFORE
import { setFlag } from "../../../__mocks__/api/mockData";

test("deletion button variant is waffle-flag controlled", async () => {
  const user = userEvent.setup();

  setFlag("flag_name", true);
  const { rerender } = renderComponent({ isOpen: true });
  await user.click(
    screen.getByRole("button", { name: "new-button" }),
  );
  expect(onAction).toHaveBeenCalled();

  setFlag("flag_name", false);
  rerender(<Component {...props} />);
  await user.click(screen.getByRole("button", { name: "old-button" }));
  expect(onAction).toHaveBeenCalledTimes(2);
});

// AFTER
// Delete entire test - behavior no longer flag-controlled
```

### Pattern 2: Mock removal

```typescript
// BEFORE
jest.mock("./OldComponent", () => ({
  OldComponent: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete} aria-label="old-button">
      Delete
    </button>
  ),
}));

jest.mock("./NewComponent", () => ({
  NewComponent: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete} aria-label="new-button">
      Delete Permanent
    </button>
  ),
}));

// AFTER
jest.mock("./NewComponent", () => ({
  NewComponent: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete} aria-label="new-button">
      Delete Permanent
    </button>
  ),
}));
```

### Pattern 3: Test expectations update

If new component has different UX than old:

```typescript
// BEFORE: Old component had confirmation checkbox
const confirmationCheckbox = screen.getByLabelText("Are you sure?");
await user.click(confirmationCheckbox);

const confirmButton = screen.getAllByRole("button", { name: "Delete" });
await user.click(confirmButton[1]);

// AFTER: New component has no checkbox
const confirmButton = screen.getAllByRole("button", { name: "Delete" });
await user.click(confirmButton[1]);
```

## Edge Cases

### Case 1: Multiple flags in same component

```typescript
// BEFORE
return (
  <div>
    {isFlagActive(data, "flag_name_1") && <Feature1 />}
    {isFlagActive(data, "flag_name_2") && <Feature2 />}
  </div>
);

// Retiring only flag_name_1
return (
  <div>
    <Feature1 />
    {isFlagActive(data, "flag_name_2") && <Feature2 />}
  </div>
);
```

### Case 2: Nested flags

```typescript
// BEFORE
{isFlagActive(data, "flag_name") ? (
  <div>
    <NewFeature />
    {isFlagActive(data, "other_flag") && <ExtraFeature />}
  </div>
) : (
  <OldFeature />
)}

// AFTER
<div>
  <NewFeature />
  {isFlagActive(data, "other_flag") && <ExtraFeature />}
</div>
```

### Case 3: Flag in useEffect

```typescript
// BEFORE
useEffect(() => {
  if (isFlagActive(props.runtimeData, "flag_name")) {
    initializeNewFeature();
  } else {
    initializeOldFeature();
  }
}, [props.runtimeData]);

// AFTER
useEffect(() => {
  initializeNewFeature();
}, []);
```

## Validation Steps

After modifying frontend code:

1. **Run component tests:**

```bash
npm test -- ComponentName.test.tsx
```

2. **Run full frontend tests:**

```bash
npm test
```

3. **Check for remaining references:**

```bash
grep -r "flag_name" --include="*.tsx" --include="*.ts" \
  --exclude-dir=node_modules frontend/src/
```

4. **Verify imports cleaned up:**

```bash
grep -r "isFlagActive" frontend/src/modified/files/
```

5. **Verify legacy components deleted:**

```bash
find frontend/src/ -name "OldComponent*"
```

6. **Check build succeeds:**

```bash
npm run build
```
