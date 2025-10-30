import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CustomAddressGenerationModal,
  isAddressValid,
} from "./CustomAddressGenerationModal";
import type { ProfileData } from "../../../hooks/api/profile";
import type { AliasData } from "../../../hooks/api/aliases";

const TEST_SUBDOMAIN = "demo";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

const mockUseProfiles = jest.fn();
jest.mock("../../../hooks/api/profile", () => ({
  useProfiles: () => mockUseProfiles(),
}));

jest.mock("../../../config", () => ({
  getRuntimeConfig: () => ({ mozmailDomain: "mozmail.com" }),
}));

function renderModal(
  overrides: Partial<
    React.ComponentProps<typeof CustomAddressGenerationModal>
  > = {},
) {
  const onClose = jest.fn();
  const onPick = jest.fn();
  const onUpdate = jest.fn();

  const defaultProps: React.ComponentProps<
    typeof CustomAddressGenerationModal
  > = {
    isOpen: true,
    onClose,
    onPick,
    onUpdate,
    subdomain: TEST_SUBDOMAIN,
    aliasGeneratedState: false,
    findAliasDataFromPrefix: (_prefix: string) => ({}) as unknown as AliasData,
  };

  const utils = render(
    <CustomAddressGenerationModal {...defaultProps} {...overrides} />,
  );
  return { ...utils, onClose, onPick, onUpdate };
}

beforeEach(() => {
  mockUseProfiles.mockReturnValue({
    data: [{ subdomain: TEST_SUBDOMAIN } as ProfileData],
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("CustomAddressGenerationModal - creator flow", () => {
  test("renders creator view with disabled submit when invalid and enables when valid", async () => {
    const user = userEvent.setup();
    const { onPick } = renderModal({ aliasGeneratedState: false });

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /modal-custom-alias-picker-heading-2/,
      }),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText(
      /modal-custom-alias-picker-form-prefix-placeholder-redesign/,
    ) as HTMLInputElement;

    // invalid (symbols)
    await user.type(input, "Bad!");
    const submit = screen.getByRole("button", {
      name: /modal-custom-alias-picker-form-submit-label-2/,
    });
    expect(submit).toBeDisabled();

    await user.click(submit);
    // 👇 only match the generic ID, not the suffixed variants
    expect(
      screen.getByText(/error-alias-picker-prefix-invalid(?!-)/),
    ).toBeInTheDocument();

    // invalid (uppercase)
    await user.clear(input);
    await user.type(input, "myMask");
    expect(submit).toBeDisabled();

    // valid
    await user.clear(input);
    await user.type(input, "mymask");
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onPick).toHaveBeenCalledTimes(1);
    const [addressArg, setErrorStateArg] = (onPick as jest.Mock).mock.calls[0];
    expect(addressArg).toBe("mymask");
    expect(typeof setErrorStateArg).toBe("function");
  });

  test("cancel button triggers onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ aliasGeneratedState: false });

    const cancel = screen.getByRole("button", { name: /profile-label-cancel/ });
    await user.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("shows composed domain hint using profile subdomain and runtime mozmailDomain", () => {
    renderModal({ aliasGeneratedState: false });
    expect(
      screen.getByText(`@${TEST_SUBDOMAIN}.mozmail.com`),
    ).toBeInTheDocument();
  });
});

describe("CustomAddressGenerationModal - success flow", () => {
  test("displays newly created mask and handles 'Copy mask' (copyToClipboard=true)", async () => {
    const user = userEvent.setup();

    const onUpdate = jest.fn();
    const findAliasDataFromPrefix = jest
      .fn()
      .mockImplementation((_prefix: string) => ({}) as unknown as AliasData);

    const { rerender } = render(
      <CustomAddressGenerationModal
        isOpen
        onClose={jest.fn()}
        onPick={jest.fn()}
        onUpdate={onUpdate}
        subdomain={TEST_SUBDOMAIN}
        aliasGeneratedState={false}
        findAliasDataFromPrefix={findAliasDataFromPrefix}
      />,
    );

    const input = screen.getByPlaceholderText(
      /modal-custom-alias-picker-form-prefix-placeholder-redesign/,
    );
    await user.type(input, "mymask");

    // simulate moving to success state
    rerender(
      <CustomAddressGenerationModal
        isOpen
        onClose={jest.fn()}
        onPick={jest.fn()}
        onUpdate={onUpdate}
        subdomain={TEST_SUBDOMAIN}
        aliasGeneratedState
        findAliasDataFromPrefix={findAliasDataFromPrefix}
      />,
    );

    expect(
      screen.getByText(`mymask@${TEST_SUBDOMAIN}.mozmail.com`),
    ).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", {
      name: /popover-custom-alias-explainer-promotional-block-checkbox-label/i,
    });
    await user.click(checkbox);

    const copyBtn = screen.getByRole("button", { name: /copy-mask/i });
    await user.click(copyBtn);

    expect(findAliasDataFromPrefix).toHaveBeenCalledWith("mymask");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [aliasArg, blockPromosArg, copyToClipboardArg] = (
      onUpdate as jest.Mock
    ).mock.calls[0];
    expect(blockPromosArg).toBe(true);
    expect(copyToClipboardArg).toBe(true);
    expect(aliasArg).toBeDefined();
  });

  test("clicking 'Done' calls onUpdate with copyToClipboard undefined", async () => {
    const user = userEvent.setup();

    const onUpdate = jest.fn();
    const findAliasDataFromPrefix = jest
      .fn()
      .mockReturnValue({} as unknown as AliasData);

    const { rerender } = render(
      <CustomAddressGenerationModal
        isOpen
        onClose={jest.fn()}
        onPick={jest.fn()}
        onUpdate={onUpdate}
        subdomain={TEST_SUBDOMAIN}
        aliasGeneratedState={false}
        findAliasDataFromPrefix={findAliasDataFromPrefix}
      />,
    );

    const input = screen.getByPlaceholderText(
      /modal-custom-alias-picker-form-prefix-placeholder-redesign/,
    );
    await user.type(input, "donecase");

    rerender(
      <CustomAddressGenerationModal
        isOpen
        onClose={jest.fn()}
        onPick={jest.fn()}
        onUpdate={onUpdate}
        subdomain={TEST_SUBDOMAIN}
        aliasGeneratedState
        findAliasDataFromPrefix={findAliasDataFromPrefix}
      />,
    );

    const doneBtn = screen.getByRole("button", { name: /done-msg/ });
    await user.click(doneBtn);

    expect(findAliasDataFromPrefix).toHaveBeenCalledWith("donecase");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [, , copyToClipboardArg] = (onUpdate as jest.Mock).mock.calls[0];
    expect(copyToClipboardArg).toBeUndefined();
  });
});

describe("isAddressValid", () => {
  test("accepts simple lowercase alphanumeric", () => {
    expect(isAddressValid("abc")).toBe(true);
    expect(isAddressValid("a1b2c3")).toBe(true);
  });

  test("rejects uppercase and symbols", () => {
    expect(isAddressValid("Abc")).toBe(false);
    expect(isAddressValid("abc!")).toBe(false);
    expect(isAddressValid("ab_c")).toBe(false);
  });

  test("handles hyphens/periods correctly", () => {
    expect(isAddressValid("a-b")).toBe(true);
    expect(isAddressValid("a.b")).toBe(true);
    expect(isAddressValid("-abc")).toBe(false);
    expect(isAddressValid("abc-")).toBe(false);
    expect(isAddressValid("a--b")).toBe(true);
  });

  test("enforces 1-63 length, not starting/ending with hyphen", () => {
    const sixtyThree = "a".repeat(63);
    const sixtyFour = "a".repeat(64);
    expect(isAddressValid(sixtyThree)).toBe(true);
    expect(isAddressValid(sixtyFour)).toBe(false);
  });

  test("rejects unicode and emoji", () => {
    expect(isAddressValid("café")).toBe(false);
    expect(isAddressValid("ümlaut")).toBe(false);
    expect(isAddressValid("mask😊")).toBe(false);
    expect(isAddressValid("masк")).toBe(false);
  });
});
