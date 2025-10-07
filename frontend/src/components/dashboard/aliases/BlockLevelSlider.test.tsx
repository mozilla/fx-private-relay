import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { BlockLevelSlider, type BlockLevel } from "./BlockLevelSlider";
import type { AliasData, RandomAliasData } from "../../../hooks/api/aliases";

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return { __esModule: true, default: MockLink };
});

jest.mock("../../Image", () => {
  const MockImage = ({
    alt = "",
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...rest} />;
  MockImage.displayName = "MockImage";
  return { __esModule: true, default: MockImage };
});

jest.mock("./BlockLevelSlider.module.scss", () => {
  const styles = new Proxy({} as Record<string, string>, {
    get: (_t, p: string) => p,
  });
  return { __esModule: true, default: styles };
});

const gaSpy = jest.fn();

jest.mock("../../../hooks/gaEvent", () => ({
  useGaEvent: () => gaSpy,
}));

// Centralized l10n mock
jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

function makeRandomAlias(
  overrides: Partial<RandomAliasData> = {},
): RandomAliasData {
  const base: RandomAliasData = {
    mask_type: "random",
    domain: 1,
    generated_for: "",
    enabled: true,
    block_list_emails: false,
    block_level_one_trackers: false,
    description: "",
    id: 1,
    address: "alias",
    full_address: "alias@example.com",
    created_at: "2024-01-01T00:00:00Z",
    last_modified_at: "2024-01-01T00:00:00Z",
    last_used_at: null,
    num_forwarded: 0,
    num_blocked: 0,
    num_spam: 0,
    num_replied: 0,
    num_level_one_trackers_blocked: 0,
    used_on: "",
  };
  return { ...base, ...overrides };
}

function renderSlider(
  opts: {
    alias?: AliasData;
    hasPremium?: boolean;
    premiumAvailableInCountry?: boolean;
    onChange?: (b: BlockLevel) => void;
  } = {},
) {
  const onChange = opts.onChange ?? jest.fn();
  const alias = opts.alias ?? makeRandomAlias();
  const hasPremium = opts.hasPremium ?? true;
  const premiumAvailableInCountry = opts.premiumAvailableInCountry ?? true;
  render(
    <BlockLevelSlider
      alias={alias}
      hasPremium={hasPremium}
      premiumAvailableInCountry={premiumAvailableInCountry}
      onChange={onChange}
    />,
  );
  return { onChange };
}

describe("BlockLevelSlider", () => {
  beforeEach(() => {
    gaSpy.mockClear();
  });

  test("renders initial state based on alias: none", () => {
    renderSlider({
      alias: makeRandomAlias({ enabled: true, block_list_emails: false }),
    });
    expect(
      screen.getByText(/profile-promo-email-blocking-title/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/profile-promo-email-blocking-description-none-2/),
    ).toBeInTheDocument();
  });

  test("renders initial state based on alias: promotional", () => {
    renderSlider({
      alias: makeRandomAlias({ enabled: true, block_list_emails: true }),
    });
    expect(
      screen.getByText(/profile-promo-email-blocking-description-promotionals/),
    ).toBeInTheDocument();
  });

  test("renders initial state based on alias: all", () => {
    renderSlider({ alias: makeRandomAlias({ enabled: false }) });
    expect(
      screen.getByText(/profile-promo-email-blocking-description-all-2/),
    ).toBeInTheDocument();
  });

  test("premium user can move slider 0→50→100 and onChange fires with GA events", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({
      hasPremium: true,
      alias: makeRandomAlias({ enabled: true, block_list_emails: false }),
    });

    const slider = screen.getByRole("slider");
    slider.focus();

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("promotional");
    expect(gaSpy).toHaveBeenLastCalledWith({
      category: "Dashboard Alias Settings",
      action: "Toggle Forwarding",
      label: "User enabled promotional emails blocking",
    });

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("all");
    expect(gaSpy).toHaveBeenLastCalledWith({
      category: "Dashboard Alias Settings",
      action: "Toggle Forwarding",
      label: "User disabled forwarding",
    });

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("none");
    expect(gaSpy).toHaveBeenLastCalledWith({
      category: "Dashboard Alias Settings",
      action: "Toggle Forwarding",
      label: "User enabled forwarding",
    });
  });

  test("free user slider skips promotional and only toggles none↔all", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({
      hasPremium: false,
      alias: makeRandomAlias({ enabled: true, block_list_emails: false }),
    });

    const slider = screen.getByRole("slider");
    slider.focus();

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("all");
    expect(onChange).not.toHaveBeenCalledWith("promotional");
  });

  test("free user clicking promotional ghost shows locked tooltip and does not call onChange", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({
      hasPremium: false,
      premiumAvailableInCountry: true,
    });

    const ghostButton = screen.getByRole("button", {
      name: /profile-promo-email-blocking-option-promotions/i,
    });

    await user.click(ghostButton);

    const tooltip = await screen.findByRole("dialog");

    expect(
      within(tooltip).getByText(
        /profile-promo-email-blocking-description-promotionals-locked-label/,
      ),
    ).toBeInTheDocument();

    const descNodes = within(tooltip).getAllByText(
      /profile-promo-email-blocking-description-promotionals/,
    );
    expect(descNodes.length).toBeGreaterThan(0);

    const cta = within(tooltip).getByRole("link", {
      name: /profile-promo-email-blocking-description-promotionals-locked-cta/,
    });
    expect(cta).toHaveAttribute("href", "/premium/");

    expect(onChange).not.toHaveBeenCalledWith("promotional");
  });

  test("free user in unavailable country sees waitlist link in tooltip", async () => {
    const user = userEvent.setup();
    renderSlider({ hasPremium: false, premiumAvailableInCountry: false });

    const ghostButton = screen.getByRole("button", {
      name: /profile-promo-email-blocking-option-promotions/i,
    });

    await user.click(ghostButton);

    const waitlistCta = await screen.findByRole("link", {
      name: /profile-promo-email-blocking-description-promotionals-locked-waitlist-cta/,
    });
    expect(waitlistCta).toHaveAttribute("href", "/premium/waitlist");
  });
});
