import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RelayNumberPicker } from "../onboarding/RelayNumberPicker";
import { OverlayProvider } from "react-aria";
import { useL10n } from "../../../hooks/l10n";
import * as relayNumberHooks from "../../../hooks/api/relayNumber";

jest.mock("../../../hooks/l10n", () => ({
  useL10n: jest.fn(),
}));

jest.mock("../../../hooks/api/relayNumber", () => ({
  useRelayNumber: jest.fn(),
  useRelayNumberSuggestions: jest.fn(),
  search: jest.fn(),
}));

describe("RelayNumberPicker", () => {
  const mockRegisterRelayNumber = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useL10n as jest.Mock).mockReturnValue({
      getString: (key: string) => `translated(${key})`,
    });

    (relayNumberHooks.useRelayNumber as jest.Mock).mockReturnValue({
      data: null,
      registerRelayNumber: mockRegisterRelayNumber,
    });

    (relayNumberHooks.useRelayNumberSuggestions as jest.Mock).mockReturnValue({
      data: {
        same_area_options: [{ phone_number: "+12345678900" }],
        other_areas_options: [],
        same_prefix_options: [],
        random_options: [],
      },
    });

    (relayNumberHooks.search as jest.Mock).mockResolvedValue([
      { phone_number: "+19998887777" },
    ]);
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<OverlayProvider>{ui}</OverlayProvider>);
  };

  it("starts with intro and progresses to selection", () => {
    renderWithProvider(<RelayNumberPicker onComplete={mockOnComplete} />);

    expect(
      screen.getByText("translated(phone-onboarding-step3-code-success-title)"),
    ).toBeInTheDocument();

    const startButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step3-code-success-cta-2)",
    });
    fireEvent.click(startButton);

    expect(
      screen.getByText("translated(phone-onboarding-step4-country)"),
    ).toBeInTheDocument();
  });

  it("opens confirmation modal after selecting and submitting a number", async () => {
    renderWithProvider(<RelayNumberPicker onComplete={mockOnComplete} />);

    const startButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step3-code-success-cta-2)",
    });
    fireEvent.click(startButton);

    const radio = await screen.findByRole("radio");
    fireEvent.click(radio);

    const submitBtn = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-register-phone-number)",
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(
        "translated(phone-onboarding-step4-body-confirm-relay-number)",
      ),
    ).toBeInTheDocument();
  });

  it("does not open modal if no number selected", () => {
    renderWithProvider(<RelayNumberPicker onComplete={mockOnComplete} />);

    const startButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step3-code-success-cta-2)",
    });
    fireEvent.click(startButton);

    const submitBtn = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-register-phone-number)",
    });
    fireEvent.click(submitBtn);

    expect(
      screen.queryByText(
        "translated(phone-onboarding-step4-body-confirm-relay-number)",
      ),
    ).not.toBeInTheDocument();
  });

  it("cycles relay number suggestions when clicking 'more options'", async () => {
    renderWithProvider(<RelayNumberPicker onComplete={mockOnComplete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "translated(phone-onboarding-step3-code-success-cta-2)",
      }),
    );

    const showMoreBtn = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-more-options)",
    });

    fireEvent.click(showMoreBtn);
    expect(screen.getByRole("radio")).not.toBeChecked(); // radio reset
  });

  it("handles search input and updates suggestions", async () => {
    renderWithProvider(<RelayNumberPicker onComplete={mockOnComplete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "translated(phone-onboarding-step3-code-success-cta-2)",
      }),
    );

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "999" } });
    fireEvent.submit(searchInput);

    await waitFor(() => {
      expect(relayNumberHooks.search).toHaveBeenCalledWith("999");
    });

    const label = screen.getByLabelText("(999) 888 - 7777");
    expect(label).toBeInTheDocument();
  });

  it("renders confirmation component when relayNumberData has data", () => {
    (relayNumberHooks.useRelayNumber as jest.Mock).mockReturnValue({
      data: ["+12223334444"],
      registerRelayNumber: mockRegisterRelayNumber,
    });

    renderWithProvider(<RelayNumberPicker onComplete={mockOnComplete} />);

    const successHeader = screen.getByTestId("confirmation-success-title");
    expect(successHeader).toBeInTheDocument();
  });
});
