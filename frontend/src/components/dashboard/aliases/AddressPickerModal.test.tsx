import { getAddressValidationMessage } from "./AddressPickerModal";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddressPickerModal } from "./AddressPickerModal";

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string) => `String for ${id}`,
  }),
}));

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

  it("returns a message specific to spaces when the address includes a space, even if there are other validation errors", () => {
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
      screen.getByText("String for modal-custom-alias-picker-heading-2"),
    ).toBeInTheDocument();
  });

  it("still renders modal even when isOpen is false", () => {
    setup(false);
    const heading = screen.queryByText(
      "String for modal-custom-alias-picker-heading-2",
    );
    expect(heading).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    setup();
    fireEvent.click(screen.getByText("String for profile-label-cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("disables submit button when address is empty", () => {
    setup();
    expect(
      screen.getByRole("button", {
        name: "String for modal-custom-alias-picker-form-submit-label-2",
      }),
    ).toBeDisabled();
  });

  it("allows user to fill address and submit successfully", () => {
    setup();
    const input = screen.getByPlaceholderText(
      "String for modal-custom-alias-picker-form-prefix-placeholder-2",
    );
    fireEvent.change(input, { target: { value: "valid-alias" } });

    const checkbox = screen.getByLabelText(
      "String for popover-custom-alias-explainer-promotional-block-checkbox",
    );
    fireEvent.click(checkbox);

    const submit = screen.getByRole("button", {
      name: "String for modal-custom-alias-picker-form-submit-label-2",
    });
    fireEvent.click(submit);

    expect(onPick).toHaveBeenCalledWith("valid-alias", {
      blockPromotionals: true,
    });
  });

  it("does not submit and sets a validation message for an invalid address", () => {
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
      "String for modal-custom-alias-picker-form-prefix-placeholder-2",
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "invalid alias" } });
    fireEvent.blur(input);

    const submit = screen.getByRole("button", {
      name: "String for modal-custom-alias-picker-form-submit-label-2",
    });
    fireEvent.click(submit);

    expect(onPick).not.toHaveBeenCalled();
    expect(setCustomValiditySpy).toHaveBeenCalledWith(
      "String for modal-custom-alias-picker-form-prefix-spaces-warning",
    );
    expect(reportValiditySpy).toHaveBeenCalled();

    setCustomValiditySpy.mockRestore();
    reportValiditySpy.mockRestore();
  });
});
