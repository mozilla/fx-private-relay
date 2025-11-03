import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelayNumberPicker } from "../onboarding/RelayNumberPicker";
import * as relayNumberHooks from "../../../hooks/api/relayNumber";
import { formatPhone } from "../../../functions/formatPhone";
import { renderWithProviders } from "frontend/__mocks__/modules/renderWithProviders";

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

    global.useL10nImpl = () => ({
      getString: (key: string) => `translated(${key})`,
    });

    (relayNumberHooks.useRelayNumber as jest.Mock).mockReturnValue({
      data: null,
      registerRelayNumber: mockRegisterRelayNumber,
    });

    (relayNumberHooks.useRelayNumberSuggestions as jest.Mock).mockReturnValue({
      data: {
        same_area_options: [
          { phone_number: "+12345678900" },
          { phone_number: "+12345678901" },
          { phone_number: "+12345678902" },
          { phone_number: "+12345678903" }, // extra for cycling
        ],
        other_areas_options: [],
        same_prefix_options: [],
        random_options: [],
      },
    });

    (relayNumberHooks.search as jest.Mock).mockResolvedValue([
      { phone_number: "+19998887777" },
    ]);
  });

  it("starts with intro and progresses to selection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberPicker onComplete={mockOnComplete} />);

    expect(
      screen.getByText("translated(phone-onboarding-step3-code-success-title)"),
    ).toBeInTheDocument();

    const startButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step3-code-success-cta-2)",
    });
    await user.click(startButton);

    expect(
      screen.getByText("translated(phone-onboarding-step4-country)"),
    ).toBeInTheDocument();
  });

  it("opens confirmation modal after selecting and submitting a number", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberPicker onComplete={mockOnComplete} />);

    const startButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step3-code-success-cta-2)",
    });
    await user.click(startButton);

    const radios = await screen.findAllByRole("radio");
    await user.click(radios[0]);

    const submitBtn = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-register-phone-number)",
    });
    await user.click(submitBtn);

    expect(
      await screen.findByText(
        "translated(phone-onboarding-step4-body-confirm-relay-number)",
      ),
    ).toBeInTheDocument();
  });

  it("does not open modal if no number selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberPicker onComplete={mockOnComplete} />);

    const startButton = screen.getByRole("button", {
      name: "translated(phone-onboarding-step3-code-success-cta-2)",
    });
    await user.click(startButton);

    const submitBtn = screen.getByRole("button", {
      name: "translated(phone-onboarding-step4-button-register-phone-number)",
    });
    await user.click(submitBtn);

    expect(
      screen.queryByText(
        "translated(phone-onboarding-step4-body-confirm-relay-number)",
      ),
    ).not.toBeInTheDocument();
  });

  it("cycles relay number suggestions when clicking 'more options'", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberPicker onComplete={mockOnComplete} />);

    await user.click(
      screen.getByRole("button", {
        name: "translated(phone-onboarding-step3-code-success-cta-2)",
      }),
    );

    // Get all visible labels for the current radio suggestions
    const initialRadios = screen.getAllByRole("radio");
    const initialLabels = initialRadios.map((radio) => {
      const label = screen.getByLabelText(
        radio.getAttribute("aria-label") || "",
      );
      return label.textContent?.trim();
    });

    await user.click(
      screen.getByRole("button", {
        name: "translated(phone-onboarding-step4-button-more-options)",
      }),
    );

    const newRadios = screen.getAllByRole("radio");
    const newLabels = newRadios.map((radio) => {
      const label = screen.getByLabelText(
        radio.getAttribute("aria-label") || "",
      );
      return label.textContent?.trim();
    });

    expect(newLabels).not.toEqual(initialLabels);
  });

  it("handles search input and updates suggestions", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RelayNumberPicker onComplete={mockOnComplete} />);

    await user.click(
      screen.getByRole("button", {
        name: "translated(phone-onboarding-step3-code-success-cta-2)",
      }),
    );

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "999{enter}");

    await waitFor(() => {
      expect(relayNumberHooks.search).toHaveBeenCalledWith("999");
    });

    const formatted = formatPhone("+19998887777");
    const label = await screen.findByLabelText(formatted);
    expect(label).toBeInTheDocument();
  });

  it("renders confirmation component when relayNumberData has data", () => {
    (relayNumberHooks.useRelayNumber as jest.Mock).mockReturnValue({
      data: ["+12223334444"],
      registerRelayNumber: mockRegisterRelayNumber,
    });

    renderWithProviders(<RelayNumberPicker onComplete={mockOnComplete} />);

    const successHeader = screen.getByTestId("confirmation-success-title");
    expect(successHeader).toBeInTheDocument();
  });
});
