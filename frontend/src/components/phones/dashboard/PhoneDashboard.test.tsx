import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneDashboard } from "./PhoneDashboard";
import {
  mockedRuntimeData,
  mockedProfiles,
  mockedRelaynumbers,
  mockedRealphones,
  mockedInboundContacts,
} from "frontend/__mocks__/api/mockData";
import { toast } from "react-toastify";
import { VerifiedPhone } from "frontend/src/hooks/api/realPhone";
import { formatPhone } from "frontend/src/functions/formatPhone";
import { useRelayNumber } from "frontend/src/hooks/api/relayNumber";
import { useInboundContact } from "frontend/src/hooks/api/inboundContact";
import type {
  ClipboardShim,
  NavigatorClipboard,
  ClipboardWrite,
} from "frontend/__mocks__/components/clipboard";

beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    constructor() {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  global.IntersectionObserver = MockIntersectionObserver;
});

jest.mock("next/config", () => () => ({
  publicRuntimeConfig: {
    BASE_URL: "https://example.com",
    API_URL: "https://api.example.com",
  },
}));

jest.mock("frontend/src/hooks/api/relayNumber", () => ({
  useRelayNumber: jest.fn(),
}));

jest.mock("frontend/src/hooks/api/inboundContact", () => ({
  useInboundContact: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: jest.fn(),
}));

describe("PhoneDashboard", () => {
  const mockRelayNumber = mockedRelaynumbers.full[0];
  const mockPhone = mockedRealphones.full[0] as VerifiedPhone;
  const mockProfile = mockedProfiles.full;
  const mockInboundContacts = mockedInboundContacts.full;

  const mockDismiss = jest.fn();
  const mockRequestContactCard = jest.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    jest.clearAllMocks();

    global.useL10nImpl = () => ({
      getString: (key: string) => key,
      bundles: [{ locales: ["en-US"] }],
    });

    (useRelayNumber as jest.Mock).mockReturnValue({
      data: [mockRelayNumber],
      setForwardingState: jest.fn(),
    });

    (useInboundContact as jest.Mock).mockReturnValue({
      data: mockInboundContacts,
    });
  });

  it("renders the dashboard with relay number and phone number", () => {
    render(
      <PhoneDashboard
        profile={mockProfile}
        runtimeData={mockedRuntimeData}
        realPhone={mockPhone}
        dismissal={{ resendSMS: { isDismissed: true, dismiss: mockDismiss } }}
        onRequestContactCard={mockRequestContactCard}
      />,
    );

    const formattedRelayNumber = formatPhone(mockRelayNumber.number, {
      withCountryCode: true,
    });

    expect(screen.getByText(formattedRelayNumber)).toBeInTheDocument();
    expect(
      screen.getByText("phone-statistics-remaining-call-minutes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-statistics-calls-texts-forwarded"),
    ).toBeInTheDocument();
  });

  it("shows resend welcome SMS banner if not dismissed", () => {
    render(
      <PhoneDashboard
        profile={mockProfile}
        runtimeData={mockedRuntimeData}
        realPhone={mockPhone}
        dismissal={{ resendSMS: { isDismissed: false, dismiss: mockDismiss } }}
        onRequestContactCard={mockRequestContactCard}
      />,
    );

    expect(
      screen.getByText("phone-banner-resend-welcome-sms-title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-banner-resend-welcome-sms-body"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-banner-resend-welcome-sms-cta"),
    ).toBeInTheDocument();
  });

  it("clicks resend SMS CTA and triggers toast and dismissal", async () => {
    const user = userEvent.setup();
    render(
      <PhoneDashboard
        profile={mockProfile}
        runtimeData={mockedRuntimeData}
        realPhone={mockPhone}
        dismissal={{ resendSMS: { isDismissed: false, dismiss: mockDismiss } }}
        onRequestContactCard={mockRequestContactCard}
      />,
    );

    await user.click(screen.getByText("phone-banner-resend-welcome-sms-cta"));

    await waitFor(() => expect(mockRequestContactCard).toHaveBeenCalled());
    expect(mockDismiss).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      "phone-banner-resend-welcome-sms-toast-msg",
      { type: "success" },
    );
  });

  it("toggles to the SendersPanelView when senders button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PhoneDashboard
        profile={mockProfile}
        runtimeData={mockedRuntimeData}
        realPhone={mockPhone}
        dismissal={{ resendSMS: { isDismissed: true, dismiss: mockDismiss } }}
        onRequestContactCard={mockRequestContactCard}
      />,
    );

    await user.click(screen.getByText("phone-dashboard-senders-header"));
    expect(screen.getByTestId("senders-panel-view")).toBeInTheDocument();
  });

  it("copies relay number on click and shows copied message", async () => {
    const user = userEvent.setup();

    const nav = navigator as unknown as NavigatorClipboard;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      nav,
      "clipboard",
    );

    const writeTextMock: jest.MockedFunction<ClipboardWrite> = jest
      .fn<ReturnType<ClipboardWrite>, Parameters<ClipboardWrite>>()
      .mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock } as ClipboardShim,
      configurable: true,
    });

    render(
      <PhoneDashboard
        profile={mockProfile}
        runtimeData={mockedRuntimeData}
        realPhone={mockPhone}
        dismissal={{ resendSMS: { isDismissed: true, dismiss: mockDismiss } }}
        onRequestContactCard={mockRequestContactCard}
      />,
    );

    await user.click(screen.getByTitle("Copied"));

    expect(writeTextMock).toHaveBeenCalledWith(
      mockRelayNumber.number.replace("+", ""),
    );

    expect(
      await screen.findByText("phone-dashboard-number-copied"),
    ).toBeInTheDocument();

    if (originalDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalDescriptor);
    } else {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    }
  });
});
