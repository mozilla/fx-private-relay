import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailForwardingModal, Props } from "./EmailForwardingModal";
import { useL10n } from "../../hooks/l10n";
import { aliasEmailTest } from "../../hooks/api/aliases";
import { useGaEvent } from "../../hooks/gaEvent";

jest.mock("../../hooks/l10n", () => ({
  useL10n: jest.fn(),
}));
jest.mock("../../hooks/api/aliases", () => ({
  aliasEmailTest: jest.fn(),
}));
jest.mock("../../hooks/gaEvent", () => ({
  useGaEvent: jest.fn(),
}));

const mockGetString = jest.fn((id) => id);
const mockGaEvent = jest.fn();

const defaultProps: Props = {
  isOpen: true,
  isSet: false,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
  onComplete: jest.fn(),
};

describe("EmailForwardingModal", () => {
  beforeEach(() => {
    (useL10n as jest.Mock).mockReturnValue({ getString: mockGetString });
    (useGaEvent as jest.Mock).mockReturnValue(mockGaEvent);
    jest.clearAllMocks();
  });

  it("renders ConfirmModal when isSet is false", () => {
    render(<EmailForwardingModal {...defaultProps} />);
    expect(
      screen.getByText(
        "profile-free-onboarding-copy-mask-try-out-email-forwarding",
      ),
    ).toBeInTheDocument();
  });

  it("submits the email and triggers aliasEmailTest and gaEvent", async () => {
    const user = userEvent.setup();
    (aliasEmailTest as jest.Mock).mockResolvedValueOnce(true);

    render(<EmailForwardingModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      "profile-free-onboarding-copy-mask-placeholder-relay-email-mask",
    );

    await user.type(input, "test@relay.example");

    await user.click(
      screen.getByText("profile-free-onboarding-copy-mask-send-email"),
    );

    await waitFor(() =>
      expect(aliasEmailTest).toHaveBeenCalledWith("test@relay.example"),
    );
    await waitFor(() => expect(defaultProps.onConfirm).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockGaEvent).toHaveBeenCalledWith({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-2-forwarding-test",
        value: 1,
      }),
    );
  });

  it("does not call onConfirm if aliasEmailTest fails", async () => {
    const user = userEvent.setup();
    (aliasEmailTest as jest.Mock).mockResolvedValueOnce(false);

    render(<EmailForwardingModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      "profile-free-onboarding-copy-mask-placeholder-relay-email-mask",
    );
    await user.type(input, "bad@relay.example");

    await user.click(
      screen.getByText("profile-free-onboarding-copy-mask-send-email"),
    );

    await waitFor(() => expect(aliasEmailTest).toHaveBeenCalled());
    await waitFor(() => expect(defaultProps.onConfirm).not.toHaveBeenCalled());
    await waitFor(() => expect(mockGaEvent).not.toHaveBeenCalled());
  });

  it("calls onClose when Nevermind button is clicked", async () => {
    const user = userEvent.setup();
    render(<EmailForwardingModal {...defaultProps} />);
    await user.click(
      screen.getByText("profile-free-onboarding-copy-mask-nevermind"),
    );
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders SuccessModal when isSet is true", () => {
    render(<EmailForwardingModal {...defaultProps} isSet={true} />);
    expect(
      screen.getByText("profile-free-onboarding-copy-mask-check-inbox"),
    ).toBeInTheDocument();
  });

  it("calls onComplete when Continue button is clicked in SuccessModal", async () => {
    const user = userEvent.setup();
    render(<EmailForwardingModal {...defaultProps} isSet={true} />);
    await user.click(
      screen.getByText("profile-free-onboarding-copy-mask-continue"),
    );
    expect(defaultProps.onComplete).toHaveBeenCalled();
  });

  it("returns null when isOpen is false", () => {
    render(<EmailForwardingModal {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByText("profile-free-onboarding-copy-mask-check-inbox"),
    ).not.toBeInTheDocument();
  });
});
