import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Tips } from "./Tips";
import type { ProfileData } from "../../../hooks/api/profile";
import type { RuntimeData } from "../../../hooks/api/types";

jest.mock("next/link", () => {
  const Link = ({
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
  );
  return Link;
});

jest.mock("react-intersection-observer", () => ({
  useInView: () => [jest.fn(), true] as const,
}));

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (key: string, vars?: Record<string, unknown>) => {
      if (key === "tips-header-title") return "Helpful tips";
      if (key === "tips-footer-link-faq-label") return "FAQ";
      if (key === "tips-footer-link-faq-tooltip") return "Read the FAQ";
      if (key === "tips-footer-link-support-label") return "Support";
      if (key === "tips-footer-link-support-tooltip") return "Open Support";
      if (key === "tips-header-button-close-label") return "Minimize tips";
      if (key === "tips-toast-button-expand-label") return "View";
      if (key === "tips-custom-alias-heading-2")
        return "Create a custom subdomain";
      if (key === "tips-multi-replies-heading")
        return "Reply to multiple senders";
      if (key === "tips-multi-replies-content")
        return "Use short codes to reply";
      if (key === "tips-switcher-label")
        return `Tip ${(vars?.nr as number) ?? 1}`;
      return key;
    },
  }),
}));

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

jest.mock("../../../functions/waffle", () => ({
  isFlagActive: jest.fn(),
}));
import { isFlagActive } from "../../../functions/waffle";
const isFlagActiveMock = isFlagActive as jest.MockedFunction<
  typeof isFlagActive
>;

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

describe("Tips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDismiss.mockClear();
    mockGaEvent.mockClear();
    relayData = [];
    isFlagActiveMock.mockReset();
    isFlagActiveMock.mockReturnValue(false);
  });

  it("renders null when there are no eligible tips", () => {
    render(<Tips profile={baseProfile()} runtimeData={rd} />);
    expect(
      screen.queryByRole("complementary", { name: "Helpful tips" }),
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
      screen.getByRole("heading", { name: "Helpful tips" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Create a custom subdomain")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByText("Your subdomain: me")).toBeInTheDocument();

    const faq = screen.getByRole("link", { name: "FAQ" });
    expect(faq).toHaveAttribute("href", "/faq");

    const support = screen.getByRole("link", { name: "Support" });
    expect(support).toHaveAttribute(
      "href",
      "https://support.mozilla.org/products/relay",
    );
  });

  it("renders the multi-replies tip content after expanding when conditions are met", async () => {
    const user = userEvent.setup();
    isFlagActiveMock.mockImplementation((_, name) => name === "multi_replies");
    relayData = [{}];
    render(
      <Tips profile={baseProfile({ has_phone: true })} runtimeData={rd} />,
    );

    expect(
      screen.getByRole("heading", { name: "Helpful tips" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reply to multiple senders")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      screen.getByRole("heading", { name: "Reply to multiple senders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Use short codes to reply")).toBeInTheDocument();
  });

  it("minimizes, dismisses tips, and shows teaser summary after closing", async () => {
    const user = userEvent.setup();
    render(
      <Tips profile={baseProfile({ has_premium: true })} runtimeData={rd} />,
    );

    const close = screen.getByRole("button", { name: "Minimize tips" });
    await user.click(close);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Tips",
      action: "Collapse",
      label: "tips-header",
    });

    expect(screen.getByText("Create a custom subdomain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("shows a tip switcher with multiple tips and can switch to the custom alias tip", async () => {
    const user = userEvent.setup();
    isFlagActiveMock.mockImplementation((_, name) => name === "multi_replies");
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

    expect(screen.getByText("Reply to multiple senders")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View" }));

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

    await user.click(screen.getByRole("button", { name: "View" }));

    expect(mockGaEvent).toHaveBeenCalledWith({
      category: "Tips",
      action: "Expand (from teaser)",
      label: "custom-subdomain",
    });
  });
});
