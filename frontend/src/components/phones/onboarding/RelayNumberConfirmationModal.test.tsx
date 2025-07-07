import { render, screen, fireEvent } from "@testing-library/react";
import { RelayNumberConfirmationModal } from "../onboarding/RelayNumberConfirmationModal";
import { useL10n } from "../../../hooks/l10n";
import { OverlayProvider } from "react-aria";

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

  const renderWithProvider = (ui: React.ReactElement) =>
    render(<OverlayProvider>{ui}</OverlayProvider>);

  const defaultProps = {
    onClose: mockOnClose,
    confirm: mockConfirm,
    isOpen: true,
    relayNumber: "+12345678900",
  };

  it("renders modal when isOpen is true", () => {
    renderWithProvider(<RelayNumberConfirmationModal {...defaultProps} />);
    expect(
      screen.getByText(
        "translated(phone-onboarding-step4-body-confirm-relay-number)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((text) => text.includes("234") && text.includes("8900")),
    ).toBeInTheDocument();
  });

  it("calls onClose when close icon is clicked", () => {
    renderWithProvider(<RelayNumberConfirmationModal {...defaultProps} />);
    const closeButton = screen.getByRole("button", { name: /Close/ });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls confirm when confirm button is clicked", () => {
    renderWithProvider(<RelayNumberConfirmationModal {...defaultProps} />);
    const confirmButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-confirm-relay-number)",
    });
    fireEvent.click(confirmButton);
    expect(mockConfirm).toHaveBeenCalled();
  });

  it("disables confirm button if relayNumber is empty", () => {
    renderWithProvider(
      <RelayNumberConfirmationModal {...defaultProps} relayNumber="" />,
    );
    const confirmButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-confirm-relay-number)",
    });
    expect(confirmButton).toBeDisabled();
  });
});
