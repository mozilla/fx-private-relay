import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PhoneWelcomeView } from "./PhoneWelcomeView";
import { mockedProfiles } from "frontend/src/apiMocks/mockData";
import * as l10nModule from "frontend/src/hooks/l10n";
import { toast } from "react-toastify";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { FluentBundle } from "@fluent/bundle";

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

function createLocalizationBundle(): ReactLocalization {
  const bundle = new FluentBundle("en-US");
  bundle.hasMessage("placeholder-id");
  return new ReactLocalization([bundle]);
}

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
    const l10n = createLocalizationBundle();

    render(
      <LocalizationProvider l10n={l10n}>
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
        />
      </LocalizationProvider>,
    );
  };

  it("renders welcome content: header, subheading, instructions, and continue button", () => {
    renderView();

    // Header + subheading
    expect(screen.getByText("phone-masking-splash-header")).toBeInTheDocument();
    expect(
      screen.getByText("phone-masking-splash-subheading"),
    ).toBeInTheDocument();

    // Three instruction sections
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

  it("dismisses welcome screen on continue button click", () => {
    renderView();
    fireEvent.click(screen.getByText("phone-masking-splash-continue-btn"));
    expect(dismissMock).toHaveBeenCalled();
  });

  it("shows resend SMS button and calls contact card + toast", async () => {
    renderView();
    fireEvent.click(screen.getByText("phone-masking-splash-save-contact-cta"));

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
