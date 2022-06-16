import { getAddressValidationMessage } from "./AddressPickerModal";

describe("getAddressValidationMessage", () => {
  it("returns `null` for valid addresses", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockL10n = { getString: jest.fn() } as any;
    expect(getAddressValidationMessage("valid-address", mockL10n)).toBeNull();
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
      "String ID: modal-custom-alias-picker-form-prefix-spaces-warning"
    );
  });

  it("returns a message specific to spaces when the address includes a space, even if there are other validation errors", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(
      getAddressValidationMessage("invalid address (╯ ͠° ͟ʖ ͡°)╯┻━┻ ", mockL10n)
    ).toBe("String ID: modal-custom-alias-picker-form-prefix-spaces-warning");
  });

  it("returns a generic validation message on invalid characters", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("π", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning"
    );
  });

  it("returns a generic validation message on capitalised characters", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("Invalid-address", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning"
    );
  });

  it("returns a generic validation message when starting with a hyphen", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("-invalid-address", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning"
    );
  });

  it("returns a generic validation message when ending in a hyphen", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("invalid-address-", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning"
    );
  });

  it("returns a generic validation message for a hyphen-only address", () => {
    const mockL10n = {
      getString: jest.fn((id: string) => `String ID: ${id}`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(getAddressValidationMessage("-", mockL10n)).toBe(
      "String ID: modal-custom-alias-picker-form-prefix-invalid-warning"
    );
  });
});
