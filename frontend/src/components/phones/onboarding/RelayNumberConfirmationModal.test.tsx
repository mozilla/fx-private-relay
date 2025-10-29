import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelayNumberConfirmationModal } from "../onboarding/RelayNumberConfirmationModal";
import { useL10n } from "../../../hooks/l10n";
import { renderWithProviders } from "frontend/__mocks__/modules/renderWithProviders";

jest.mock("../../../hooks/l10n", () => ({
  useL10n: jest.fn(),
}));

jest.mock("react-aria", () => {
  const original = jest.requireActual("react-aria");
  return {
    ...original,
    OverlayContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="overlay-container">{children}</div>
    ),
  };
});

describe("RelayNumberConfirmationModal", () => {
  const mockOnClose = jest.fn();
  const mockConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useL10n as jest.Mock).mockReturnValue({
      getString: (key: string) => `translated(${key})`,
    });
  });

  const defaultProps = {
    onClose: mockOnClose,
    confirm: mockConfirm,
    isOpen: true,
    relayNumber: "+12345678900",
  };

  it("renders modal when isOpen is true", () => {
    renderWithProviders(<RelayNumberConfirmationModal {...defaultProps} />);
    expect(
      screen.getByText(
        "translated(phone-onboarding-step4-body-confirm-relay-number)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((text) => text.includes("234") && text.includes("8900")),
    ).toBeInTheDocument();
  });

  it("calls onClose when close icon is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberConfirmationModal {...defaultProps} />);
    const closeButton = screen.getByRole("button", { name: /Close/ });
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls confirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberConfirmationModal {...defaultProps} />);
    const confirmButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-confirm-relay-number)",
    });
    await user.click(confirmButton);
    expect(mockConfirm).toHaveBeenCalled();
  });

  it("disables confirm button if relayNumber is empty", () => {
    renderWithProviders(
      <RelayNumberConfirmationModal {...defaultProps} relayNumber="" />,
    );
    const confirmButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-confirm-relay-number)",
    });
    expect(confirmButton).toBeDisabled();
  });
});
