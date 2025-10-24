import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneWelcomeView } from "./PhoneWelcomeView";
import { mockedProfiles } from "frontend/__mocks__/api/mockData";
import * as l10nModule from "frontend/src/hooks/l10n";
import { toast } from "react-toastify";
import { renderWithProviders } from "frontend/__mocks__/modules/renderWithProviders";

jest.mock("frontend/src/hooks/l10n", () => ({
  useL10n: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: jest.fn(),
}));

const dismissMock = jest.fn();
const resendDismissMock = jest.fn();

const mockResponse = {
  ok: true,
  status: 200,
  json: async () => ({}),
} as Response;

const requestContactCardMock = jest.fn(() => Promise.resolve(mockResponse));

describe("PhoneWelcomeView", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (l10nModule.useL10n as jest.Mock).mockReturnValue({
      getString: (key: string) => key,
      bundles: [{ locales: ["en-US"] }],
    });
  });

  const renderView = (
    overrides: Partial<Parameters<typeof PhoneWelcomeView>[0]> = {},
  ) => {
    renderWithProviders(
      <PhoneWelcomeView
        dismissal={{
          welcomeScreen: {
            isDismissed: false,
            dismiss: dismissMock,
          },
          resendSMS: {
            isDismissed: false,
            dismiss: resendDismissMock,
          },
        }}
        onRequestContactCard={requestContactCardMock}
        profile={mockedProfiles.full}
        {...overrides}
      />,
    );
  };

  it("renders welcome content: header, subheading, instructions, and continue button", () => {
    renderView();

    expect(screen.getByText("phone-masking-splash-header")).toBeInTheDocument();
    expect(
      screen.getByText("phone-masking-splash-subheading"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("phone-masking-splash-save-contact-title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-masking-splash-replies-title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-masking-splash-blocking-title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-masking-splash-continue-btn"),
    ).toBeInTheDocument();
  });

  it("dismisses welcome screen on continue button click", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByText("phone-masking-splash-continue-btn"));
    expect(dismissMock).toHaveBeenCalled();
  });

  it("shows resend SMS button and calls contact card + toast", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByText("phone-masking-splash-save-contact-cta"));

    await waitFor(() => {
      expect(requestContactCardMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        "phone-banner-resend-welcome-sms-toast-msg",
        { type: "success" },
      );
    });

    await waitFor(() => {
      expect(resendDismissMock).toHaveBeenCalled();
    });
  });

  it("does not show resend SMS button when already dismissed", () => {
    renderView({
      dismissal: {
        welcomeScreen: {
          isDismissed: false,
          dismiss: dismissMock,
        },
        resendSMS: {
          isDismissed: true,
          dismiss: resendDismissMock,
        },
      },
    });
    expect(
      screen.queryByText("phone-masking-splash-save-contact-cta"),
    ).not.toBeInTheDocument();
  });
});
