import { render, screen } from "@testing-library/react";
import PremiumWaitlist from "../../../src/pages/premium/waitlist.page";
import { WaitlistPage } from "../../../src/components/waitlist/WaitlistPage";

jest.mock("../../../src/components/Localized", () => {
  const { mockLocalizedModule } = jest.requireActual(
    "../../../__mocks__/components/Localized",
  );
  return mockLocalizedModule;
});

jest.mock("../../../src/components/waitlist/WaitlistPage", () => ({
  WaitlistPage: jest.fn(() => <div data-testid="mock-waitlist-page" />),
}));

import { byMsgId } from "../../../__mocks__/hooks/l10n";

describe("PremiumWaitlist page", () => {
  const mockGetString = jest.fn();

  beforeEach(() => {
    global.useL10nImpl = () => ({
      getString: mockGetString,
    });

    mockGetString.mockImplementation((id: string) => {
      const strings: Record<string, string> = {
        "waitlist-heading-2": "Get Mozilla Relay Premium",
        "waitlist-lead-2": "Premium features, coming soon",
        "waitlist-privacy-policy-use": "We will only email you about premium.",
      };
      return strings[id] ?? id;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the WaitlistPage with correct props", () => {
    render(<PremiumWaitlist />);

    const props = (WaitlistPage as jest.Mock).mock.calls[0][0];

    expect(props.supportedLocales).toEqual(["en", "es", "pl", "pt", "ja"]);
    expect(props.headline).toBe("Get Mozilla Relay Premium");
    expect(props.lead).toBe("Premium features, coming soon");
    expect(props.newsletterId).toBe("relay-waitlist");
    expect(props.legalese).toBeDefined();

    expect(screen.getByTestId("mock-waitlist-page")).toBeInTheDocument();
  });

  it("renders legalese content", () => {
    render(<PremiumWaitlist />);
    const legalese = (WaitlistPage as jest.Mock).mock.calls[0][0].legalese;

    render(<>{legalese}</>);

    expect(
      screen.getByText(byMsgId("waitlist-privacy-policy-agree-2")),
    ).toBeInTheDocument();

    expect(
      screen.getByText("We will only email you about premium."),
    ).toBeInTheDocument();
  });
});
