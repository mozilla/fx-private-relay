import { getAddressValidationMessage } from "./AddressPickerModal";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressPickerModal } from "./AddressPickerModal";

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

describe("getAddressValidationMessage", () => {
  it("returns `null` for valid addresses", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockL10n = { getString: jest.fn() } as any;
    expect(getAddressValidationMessage("a.valid-address", mockL10n)).toBeNull();
  });

  it("returns `null` for valid single-character addresses", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockL10n = { getString: jest.fn() } as any;
    expect(getAddressValidationMessage("a", mockL10n)).toBeNull();
  });

  it("returns a message specific to spaces when the address includes a space", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("invalid address", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-spaces-warning",
    );
  });

  it("returns a message specific to spaces even if other errors exist", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(
      getAddressValidationMessage("invalid address (╯ ͠° ͟ʖ ͡°)╯┻━┻ ", mockL10n),
    ).toBe("String ID: modal-custom-alias-picker-form-prefix-spaces-warning");
  });

  it("returns a generic validation message on invalid characters", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("π", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });

  it("returns a generic validation message on capitalised characters", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("Invalid-address", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });

  it("returns a generic validation message when starting with a hyphen", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("-invalid-address", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });

  it("returns a generic validation message when ending in a hyphen", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("invalid-address-", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });

  it("returns a generic validation message when starting with a period", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage(".invalid.address", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });

  it("returns a generic validation message when ending in a period", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("invalid.address.", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });

  it("returns a generic validation message for a hyphen-only address", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("-", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning-2",
    );
  });
});

describe("AddressPickerModal", () => {
  const onClose = jest.fn();
  const onPick = jest.fn();

  const setup = (isOpen = true) =>
    render(
      <AddressPickerModal
        isOpen={isOpen}
        onClose={onClose}
        onPick={onPick}
        subdomain="test"
      />,
    );

  it("renders modal when open", () => {
    setup();
    expect(
      screen.getByText(/modal-custom-alias-picker-heading-2/),
    ).toBeInTheDocument();
  });

  it("still renders modal even when isOpen is false", () => {
    setup(false);
    expect(
      screen.getByText(/modal-custom-alias-picker-heading-2/),
    ).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/profile-label-cancel/));
    expect(onClose).toHaveBeenCalled();
  });

  it("disables submit button when address is empty", () => {
    setup();
    expect(
      screen.getByRole("button", {
        name: /modal-custom-alias-picker-form-submit-label-2/,
      }),
    ).toBeDisabled();
  });

  it("allows user to fill address and submit successfully", async () => {
    const user = userEvent.setup();
    setup();

    const input = screen.getByPlaceholderText(
      /modal-custom-alias-picker-form-prefix-placeholder-2/,
    );
    await user.type(input, "valid-alias");

    const checkbox = screen.getByLabelText(
      /popover-custom-alias-explainer-promotional-block-checkbox/,
    );
    await user.click(checkbox);

    const submit = screen.getByRole("button", {
      name: /modal-custom-alias-picker-form-submit-label-2/,
    });
    await user.click(submit);

    expect(onPick).toHaveBeenCalledWith("valid-alias", {
      blockPromotionals: true,
    });
  });

  it("does not submit and sets a validation message for an invalid address", async () => {
    const user = userEvent.setup();
    const setCustomValiditySpy = jest.spyOn(
      HTMLInputElement.prototype,
      "setCustomValidity",
    );
    const reportValiditySpy = jest.spyOn(
      HTMLInputElement.prototype,
      "reportValidity",
    );

    setup();

    const input = screen.getByPlaceholderText(
      /modal-custom-alias-picker-form-prefix-placeholder-2/,
    ) as HTMLInputElement;

    await user.type(input, "invalid alias");
    await user.tab();

    const submit = screen.getByRole("button", {
      name: /modal-custom-alias-picker-form-submit-label-2/,
    });
    await user.click(submit);

    expect(onPick).not.toHaveBeenCalled();
    expect(setCustomValiditySpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /modal-custom-alias-picker-form-prefix-spaces-warning/,
      ),
    );
    expect(reportValiditySpy).toHaveBeenCalled();

    setCustomValiditySpy.mockRestore();
    reportValiditySpy.mockRestore();
  });
});
