import { render, screen } from "@testing-library/react";
import BundleWaitlist from "../../../src/pages/vpn-relay/waitlist.page";
import { useL10n } from "../../../src/hooks/l10n";
import { WaitlistPage } from "../../../src/components/waitlist/WaitlistPage";

// Mock Localized to avoid needing <LocalizationProvider>
jest.mock("../../../src/components/Localized", () => ({
  Localized: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("../../../src/hooks/l10n");
jest.mock("../../../src/components/waitlist/WaitlistPage", () => ({
  WaitlistPage: jest.fn(() => <div data-testid="mock-waitlist-page" />),
}));

describe("BundleWaitlist page", () => {
  const mockGetString = jest.fn();

  beforeEach(() => {
    (useL10n as jest.Mock).mockReturnValue({
      getString: mockGetString,
    });

    mockGetString.mockImplementation((id: string) => {
      const strings: Record<string, string> = {
        "waitlist-heading-bundle": "Bundle up with VPN and Relay",
        "waitlist-lead-bundle": "Get notified when our privacy bundle is ready",
        "waitlist-privacy-policy-use-bundle":
          "We’ll only use your info for bundle updates.",
      };
      return strings[id] ?? id;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the WaitlistPage with correct props", () => {
    render(<BundleWaitlist />);

    const props = (WaitlistPage as jest.Mock).mock.calls[0][0];

    expect(props.supportedLocales).toEqual(["en", "es", "pl", "pt", "ja"]);
    expect(props.headline).toBe("Bundle up with VPN and Relay");
    expect(props.lead).toBe("Get notified when our privacy bundle is ready");
    expect(props.newsletterId).toBe("relay-vpn-bundle-waitlist");
    expect(props.legalese).toBeDefined();

    expect(screen.getByTestId("mock-waitlist-page")).toBeInTheDocument();
  });

  it("renders legalese content", () => {
    render(<BundleWaitlist />);
    const legalese = (WaitlistPage as jest.Mock).mock.calls[0][0].legalese;

    render(<>{legalese}</>);

    expect(
      screen.getByText("We’ll only use your info for bundle updates."),
    ).toBeInTheDocument();
  });
});
