import { render, screen, fireEvent } from "@testing-library/react";
import { CornerNotification } from "./CornerNotification";
import React from "react";
import {
  mockedRuntimeData,
  mockedProfiles,
  mockedRelayaddresses,
} from "frontend/src/apiMocks/mockData";
import { useL10n } from "frontend/src/hooks/l10n";
import { useLocalDismissal } from "frontend/src/hooks/localDismissal";
import { useGaEvent } from "frontend/src/hooks/gaEvent";
import { isFlagActive } from "frontend/src/functions/waffle";

jest.mock("frontend/src/functions/waffle", () => ({
  isFlagActive: jest.fn(),
}));
jest.mock("frontend/src/hooks/l10n", () => ({
  useL10n: jest.fn(),
}));
jest.mock("frontend/src/hooks/localDismissal", () => ({
  useLocalDismissal: jest.fn(),
}));
jest.mock("frontend/src/hooks/gaEvent", () => ({
  useGaEvent: jest.fn(),
}));
jest.mock("frontend/src/hooks/gaViewPing", () => ({
  useGaViewPing: jest.fn(() => React.createRef()),
}));

beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  global.IntersectionObserver = MockIntersectionObserver;
});

describe("CornerNotification", () => {
  const mockL10n = {
    getString: jest.fn((key) => key),
  };

  const mockDismiss = jest.fn();
  const mockAlias = mockedRelayaddresses.full[0];

  const defaultProps = {
    profile: {
      ...mockedProfiles.some,
      has_premium: false,
    },
    runtimeData: mockedRuntimeData,
    aliases: new Array(4).fill(mockAlias),
  };

  beforeEach(() => {
    (useL10n as jest.Mock).mockReturnValue(mockL10n);
    (useLocalDismissal as jest.Mock).mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });
    (useGaEvent as jest.Mock).mockReturnValue(jest.fn());
    (isFlagActive as unknown as jest.Mock).mockReturnValue(true);
    mockL10n.getString.mockClear();
  });

  it("renders when flag is active, user has 4 aliases, is not premium, and not dismissed", () => {
    render(<CornerNotification {...defaultProps} />);
    expect(
      screen.getByText("upsell-banner-4-masks-us-heading-2"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("upsell-banner-4-masks-us-description-2"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "upsell-banner-4-masks-button-close-label",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "upsell-banner-4-masks-us-cta" }),
    ).toBeInTheDocument();
  });

  it("does not render if user is premium", () => {
    render(
      <CornerNotification
        {...defaultProps}
        profile={{ ...defaultProps.profile, has_premium: true }}
      />,
    );
    expect(
      screen.queryByText("upsell-banner-4-masks-us-heading-2"),
    ).not.toBeInTheDocument();
  });

  it("does not render if dismissal is true", () => {
    (useLocalDismissal as jest.Mock).mockReturnValue({
      isDismissed: true,
      dismiss: mockDismiss,
    });
    render(<CornerNotification {...defaultProps} />);
    expect(
      screen.queryByText("upsell-banner-4-masks-us-heading-2"),
    ).not.toBeInTheDocument();
  });

  it("does not render if aliases are less than 4", () => {
    render(
      <CornerNotification {...defaultProps} aliases={[mockAlias, mockAlias]} />,
    );
    expect(
      screen.queryByText("upsell-banner-4-masks-us-heading-2"),
    ).not.toBeInTheDocument();
  });

  it("does not render if flag is inactive", () => {
    (isFlagActive as unknown as jest.Mock).mockReturnValue(false);
    render(<CornerNotification {...defaultProps} />);
    expect(
      screen.queryByText("upsell-banner-4-masks-us-heading-2"),
    ).not.toBeInTheDocument();
  });

  it("dismisses when close button is clicked", () => {
    render(<CornerNotification {...defaultProps} />);
    const closeButton = screen.getByRole("button", {
      name: "upsell-banner-4-masks-button-close-label",
    });
    fireEvent.click(closeButton);
    expect(mockDismiss).toHaveBeenCalled();
  });

  it("fires GA event when CTA is clicked", () => {
    const mockGaEvent = jest.fn();
    (useGaEvent as jest.Mock).mockReturnValue(mockGaEvent);
    render(<CornerNotification {...defaultProps} />);
    const cta = screen.getByRole("link", {
      name: "upsell-banner-4-masks-us-cta",
    });
    fireEvent.click(cta);
    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Purchase Button",
      action: "Engage",
      label: "4-mask-limit-upsell",
    });
  });
});
