import { render, screen } from "@testing-library/react";
import { ProfileBanners } from "./ProfileBanners";
import {
  mockedProfiles,
  mockedUsers,
  mockedRuntimeData,
} from "../../apiMocks/mockData";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import {
  isUsingFirefox,
  supportsFirefoxExtension,
} from "../../functions/userAgent";

beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }

    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}
  }

  global.IntersectionObserver = MockIntersectionObserver;
});

jest.mock("../../hooks/l10n", () => ({
  useL10n: jest.fn(() => ({
    bundles: [{ locales: ["en-US"] }],
    getString: (id: string) => id,
    getFragment: (
      _id: string,
      {
        vars,
      }: {
        vars: { username: string; bounce_type: string; date: string };
      },
    ) =>
      `Bounced email to ${vars.username} failed due to ${vars.bounce_type} on ${vars.date}`,
  })),
}));

jest.mock("../../hooks/mediaQuery", () => ({
  useMinViewportWidth: jest.fn(),
}));

jest.mock("../../functions/userAgent", () => ({
  isUsingFirefox: jest.fn(),
  supportsFirefoxExtension: jest.fn(),
  hasDoNotTrackEnabled: jest.fn(() => false),
}));

jest.mock("../../hooks/gaEvent", () => ({
  useGaEvent: () => jest.fn(),
}));

jest.mock("./SubdomainPicker", () => ({
  SubdomainPicker: () => <div data-testid="subdomain-picker" />,
}));

const renderComponent = (
  overrides: Partial<typeof mockedProfiles.full> = {},
) => {
  const profile = mockedProfiles.full;
  render(
    <ProfileBanners
      profile={{ ...profile, ...overrides }}
      user={mockedUsers.full}
      aliases={[]}
      onCreateSubdomain={jest.fn()}
      runtimeData={mockedRuntimeData}
    />,
  );
};

describe("ProfileBanners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders bounce banner when bounce_status exists", () => {
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);
    (isUsingFirefox as jest.Mock).mockReturnValue(true);
    (supportsFirefoxExtension as jest.Mock).mockReturnValue(false);

    renderComponent({
      bounce_status: [true, "hard"],
      next_email_try: "2025-12-25T00:00:00Z",
    });

    expect(screen.getByText(/banner-bounced-headline/)).toBeInTheDocument();
    expect(screen.getByText(/Bounced email to/)).toBeInTheDocument();
  });

  it("always renders SubdomainPicker", () => {
    renderComponent();
    expect(screen.getByTestId("subdomain-picker")).toBeInTheDocument();
  });

  it("renders NoFirefoxBanner when not using Firefox or small screen", () => {
    (isUsingFirefox as jest.Mock).mockReturnValue(false);
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);

    renderComponent();
    expect(
      screen.getByText("banner-download-firefox-headline"),
    ).toBeInTheDocument();
  });

  it("does not render NoFirefoxBanner when using Firefox and on large screen", () => {
    (isUsingFirefox as jest.Mock).mockReturnValue(true);
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);

    renderComponent();
    expect(
      screen.queryByText("banner-download-firefox-headline"),
    ).not.toBeInTheDocument();
  });

  it("renders NoAddonBanner when supports extension, large screen, and not demo profile", () => {
    (isUsingFirefox as jest.Mock).mockReturnValue(true);
    (supportsFirefoxExtension as jest.Mock).mockReturnValue(true);
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);

    renderComponent({ api_token: "not_demo" });
    expect(
      screen.getByText("banner-download-install-extension-headline"),
    ).toBeInTheDocument();
  });

  it("does not render NoAddonBanner if profile is demo", () => {
    (isUsingFirefox as jest.Mock).mockReturnValue(true);
    (supportsFirefoxExtension as jest.Mock).mockReturnValue(true);
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);

    renderComponent({ api_token: "demo" });
    expect(
      screen.queryByText("banner-download-install-extension-headline"),
    ).not.toBeInTheDocument();
  });
});
