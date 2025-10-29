import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Tips } from "./Tips";
import type { ProfileData } from "../../../hooks/api/profile";
import type { RuntimeData } from "../../../hooks/api/types";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    title?: string;
  }) => (
    <a href={href} title={title}>
      {children}
    </a>
  ),
}));

jest.mock("react-intersection-observer", () => ({
  useInView: () => [jest.fn(), true] as const,
}));

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

const mockDismiss = jest.fn();
jest.mock("../../../hooks/localDismissal", () => ({
  useLocalDismissal: () => ({ isDismissed: false, dismiss: mockDismiss }),
}));

const mockGaEvent = jest.fn();
jest.mock("../../../hooks/gaEvent", () => ({
  useGaEvent: () => mockGaEvent,
}));

jest.mock("../../../hooks/gaViewPing", () => ({
  useGaViewPing: () => () => {},
}));

jest.mock("../../../config", () => ({
  getRuntimeConfig: () => ({ frontendOrigin: "http://relay.local" }),
}));

// --- use centralized waffle/flags mocks
jest.mock("../../../functions/waffle", () =>
  jest.requireActual("frontend/__mocks__/functions/waffle"),
);
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
      expect.stringContaining("http://relay.local"),
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
});
