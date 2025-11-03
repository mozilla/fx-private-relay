import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CornerNotification } from "./CornerNotification";
import {
  mockedRuntimeData,
  mockedProfiles,
  mockedRelayaddresses,
} from "frontend/__mocks__/api/mockData";
import { useLocalDismissal } from "frontend/src/hooks/localDismissal";

jest.mock("frontend/src/functions/waffle", () => {
  const { mockIsFlagActive } = jest.requireActual(
    "frontend/__mocks__/functions/flags",
  );
  return { isFlagActive: mockIsFlagActive };
});

import {
  mockIsFlagActive,
  resetFlags,
} from "frontend/__mocks__/functions/flags";

jest.mock("frontend/src/hooks/localDismissal", () => ({
  useLocalDismissal: jest.fn(),
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
    getString: jest.fn((key: string) => key),
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
    resetFlags();
    mockIsFlagActive.mockReset();
    mockIsFlagActive.mockImplementation(() => true);

    global.useL10nImpl = () => mockL10n;
    (useLocalDismissal as jest.Mock).mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });
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
    mockIsFlagActive.mockReturnValueOnce(false);
    render(<CornerNotification {...defaultProps} />);
    expect(
      screen.queryByText("upsell-banner-4-masks-us-heading-2"),
    ).not.toBeInTheDocument();
  });

  it("dismisses when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<CornerNotification {...defaultProps} />);
    const closeButton = screen.getByRole("button", {
      name: "upsell-banner-4-masks-button-close-label",
    });
    await user.click(closeButton);
    expect(mockDismiss).toHaveBeenCalled();
  });

  it("fires GA event when CTA is clicked", async () => {
    const user = userEvent.setup();
    const mockGaEvent = jest.fn();
    global.gaEventMock = mockGaEvent;
    render(<CornerNotification {...defaultProps} />);
    const cta = screen.getByRole("link", {
      name: "upsell-banner-4-masks-us-cta",
    });
    await user.click(cta);
    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Purchase Button",
      action: "Engage",
      label: "4-mask-limit-upsell",
    });
  });
});
