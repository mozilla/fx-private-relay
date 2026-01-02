import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Tips } from "./Tips";
import type { ProfileData } from "../../../hooks/api/profile";
import type { RuntimeData } from "../../../hooks/api/types";

jest.mock("react-intersection-observer", () => ({
  useInView: () => [jest.fn(), true] as const,
}));

jest.mock(
  "../../../config.ts",
  () => jest.requireActual("../../../../__mocks__/configMock").mockConfigModule,
);

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

jest.mock("../../../hooks/gaViewPing", () => ({
  useGaViewPing: () => () => {},
}));

const mockDismiss = jest.fn();
let mockIsDismissed = false;
jest.mock("../../../hooks/localDismissal", () => ({
  useLocalDismissal: () => ({
    isDismissed: mockIsDismissed,
    dismiss: mockDismiss,
  }),
}));

const mockGaEvent = jest.fn();
jest.mock("../../../hooks/gaEvent", () => ({
  useGaEvent: () => mockGaEvent,
}));
import { setFlag, resetFlags } from "frontend/__mocks__/functions/flags";

let relayData: unknown[] = [];
jest.mock("../../../hooks/api/relayNumber", () => ({
  useRelayNumber: (_: { disable: boolean }) => ({ data: relayData }),
}));

jest.mock("./GenericTip", () => ({
  GenericTip: ({ title, content }: { title: string; content: string }) => (
    <div>
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  ),
}));

jest.mock("./CustomAliasTip", () => ({
  CustomAliasTip: ({ subdomain }: { subdomain?: string }) => (
    <div>
      {subdomain ? `Your subdomain: ${subdomain}` : "Create your subdomain"}
    </div>
  ),
}));

const baseProfile = (overrides: Partial<ProfileData> = {}): ProfileData =>
  ({
    id: 123,
    has_phone: false,
    has_premium: false,
    subdomain: null,
    ...overrides,
  }) as unknown as ProfileData;

const rd = {} as unknown as RuntimeData;

import { byMsgIdName } from "../../../../__mocks__/hooks/l10n";

describe("Tips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDismiss.mockClear();
    mockGaEvent.mockClear();
    mockIsDismissed = false;
    relayData = [];
    resetFlags(); // clear all mocked flags
  });

  it("renders null when there are no eligible tips", () => {
    render(<Tips profile={baseProfile()} runtimeData={rd} />);
    expect(
      screen.queryByRole("complementary", {
        name: byMsgIdName("tips-header-title"),
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the Custom Alias tip for Premium users and shows footer links after expanding", async () => {
    const user = userEvent.setup();
    render(
      <Tips
        profile={baseProfile({ has_premium: true, subdomain: "me" })}
        runtimeData={rd}
      />,
    );

    expect(
      screen.getByRole("heading", { name: byMsgIdName("tips-header-title") }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(byMsgIdName("tips-custom-alias-heading-2")),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    expect(screen.getByText("Your subdomain: me")).toBeInTheDocument();

    const faq = screen.getByRole("link", {
      name: byMsgIdName("tips-footer-link-faq-label"),
    });
    expect(faq).toHaveAttribute("href", "/faq");

    const support = screen.getByRole("link", {
      name: byMsgIdName("tips-footer-link-support-label"),
    });
    expect(support).toHaveAttribute(
      "href",
      expect.stringContaining("https://frontend.example.com"),
    );
  });

  it("renders the multi-replies tip content after expanding when conditions are met", async () => {
    const user = userEvent.setup();
    // enable the multi_replies flag via centralized mock
    setFlag("multi_replies", true);
    relayData = [{}];
    render(
      <Tips profile={baseProfile({ has_phone: true })} runtimeData={rd} />,
    );

    expect(
      screen.getByRole("heading", { name: byMsgIdName("tips-header-title") }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(byMsgIdName("tips-multi-replies-heading")),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: byMsgIdName("tips-multi-replies-heading"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(byMsgIdName("tips-multi-replies-content")),
    ).toBeInTheDocument();
  });

  it("minimizes, dismisses tips, and shows teaser summary after closing", async () => {
    const user = userEvent.setup();
    render(
      <Tips profile={baseProfile({ has_premium: true })} runtimeData={rd} />,
    );

    const close = screen.getByRole("button", {
      name: byMsgIdName("tips-header-button-close-label"),
    });
    await user.click(close);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Tips",
      action: "Collapse",
      label: "tips-header",
    });

    expect(
      screen.getByText(byMsgIdName("tips-custom-alias-heading-2")),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    ).toBeInTheDocument();
  });

  it("shows a tip switcher with multiple tips and can switch to the custom alias tip", async () => {
    const user = userEvent.setup();
    // enable the multi_replies flag via centralized mock
    setFlag("multi_replies", true);
    relayData = [{}];

    render(
      <Tips
        profile={baseProfile({
          has_premium: true,
          has_phone: true,
          subdomain: "me",
        })}
        runtimeData={rd}
      />,
    );

    expect(
      screen.getByText(byMsgIdName("tips-multi-replies-heading")),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);

    await user.click(tabs[1]);

    expect(
      screen.getByText(/Your subdomain: me|Create your subdomain/),
    ).toBeInTheDocument();
  });

  it("fires GA when expanding from teaser", async () => {
    const user = userEvent.setup();
    render(
      <Tips profile={baseProfile({ has_premium: true })} runtimeData={rd} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Tips",
      action: "Expand (from teaser)",
      label: "custom-subdomain",
    });
  });

  it("shows minimised button and can expand from minimised state when all tips are dismissed", async () => {
    const user = userEvent.setup();
    mockIsDismissed = true;

    render(
      <Tips profile={baseProfile({ has_premium: true })} runtimeData={rd} />,
    );

    // When all tips are dismissed, should show the minimised expand button
    const expandFromMinimised = screen.getByRole("button", {
      name: byMsgIdName("tips-header-title"),
    });

    expect(expandFromMinimised).toBeInTheDocument();

    await user.click(expandFromMinimised);

    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Tips",
      action: "Expand (from minimised)",
      label: "custom-subdomain",
    });

    // Should show full tip content after expanding
    expect(
      screen.getByRole("heading", { name: byMsgIdName("tips-header-title") }),
    ).toBeInTheDocument();
  });

  it("shows multiple tip indicators when there are multiple tips", async () => {
    const user = userEvent.setup();
    setFlag("multi_replies", true);
    relayData = [{}];

    render(
      <Tips
        profile={baseProfile({
          has_premium: true,
          has_phone: true,
          subdomain: "me",
        })}
        runtimeData={rd}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);

    // Each tab should contain an img (svg) with aria-label indicating the tip number
    // eslint-disable-next-line testing-library/no-node-access
    const tab1Svg = tabs[0].querySelector('svg[role="img"]');
    // eslint-disable-next-line testing-library/no-node-access
    const tab2Svg = tabs[1].querySelector('svg[role="img"]');

    expect(tab1Svg).toHaveAttribute("aria-label", expect.stringContaining("1"));
    expect(tab2Svg).toHaveAttribute("aria-label", expect.stringContaining("2"));
  });

  it("does not show tip switcher when there is only one tip", async () => {
    const user = userEvent.setup();
    render(
      <Tips profile={baseProfile({ has_premium: true })} runtimeData={rd} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    const tabs = screen.queryAllByRole("tab");
    expect(tabs).toHaveLength(0);
  });

  it("can close tips from the expanded state", async () => {
    const user = userEvent.setup();
    render(
      <Tips profile={baseProfile({ has_premium: true })} runtimeData={rd} />,
    );

    // First expand the tips
    await user.click(
      screen.getByRole("button", {
        name: byMsgIdName("tips-toast-button-expand-label"),
      }),
    );

    // Should show the expanded content
    expect(
      screen.getByRole("heading", { name: byMsgIdName("tips-header-title") }),
    ).toBeInTheDocument();

    // Now close from the expanded state
    const closeButton = screen.getByRole("button", {
      name: byMsgIdName("tips-header-button-close-label"),
    });
    await user.click(closeButton);

    // Should dismiss and show teaser
    expect(mockDismiss).toHaveBeenCalled();
    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Tips",
      action: "Collapse",
      label: "tips-header",
    });
  });
});
