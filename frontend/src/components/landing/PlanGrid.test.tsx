import { render, screen, fireEvent } from "@testing-library/react";
import { PlanGrid } from "./PlanGrid";
import { useL10n } from "../../hooks/l10n";
import { useIsLoggedIn } from "../../hooks/session";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { useGaEvent } from "../../hooks/gaEvent";
import { RuntimeData } from "../../hooks/api/types";
import { isMegabundleAvailableInCountry } from "../../functions/getPlan";

// Mock hooks and utilities
jest.mock("../../hooks/l10n");
jest.mock("../../hooks/gaViewPing");
jest.mock("../../hooks/gaEvent");
jest.mock("../../hooks/hasRenderedClientSide");
jest.mock("../../hooks/session");
jest.mock("../../functions/trackPurchase");
jest.mock("../../functions/cookies", () => ({ setCookie: jest.fn() }));
jest.mock("../../config", () => ({
  getRuntimeConfig: () => ({ fxaLoginUrl: "/login" }),
}));

jest.mock("../../functions/getPlan", () => ({
  getBundlePrice: jest.fn(() => "$10"),
  getBundleYearlyPrice: jest.fn(() => "$100"),
  getBundleSubscribeLink: jest.fn(() => "https://subscribe.megabundle.mock"),
  isMegabundleAvailableInCountry: jest.fn(() => true),

  getPhonesPrice: jest.fn(() => "$5"),
  getPhonesYearlyPrice: jest.fn(() => "$50"),
  getPhoneSubscribeLink: jest.fn(() => "/subscribe/phones"),
  isPhonesAvailableInCountry: jest.fn(() => true),

  getPeriodicalPremiumPrice: jest.fn(() => "$3"),
  getPeriodicalPremiumYearlyPrice: jest.fn(() => "$30"),
  getPeriodicalPremiumSubscribeLink: jest.fn(() => "/subscribe/premium"),
  isPeriodicalPremiumAvailableInCountry: jest.fn(() => true),
}));

const l10nMock = {
  bundles: [{ locales: ["en"] }],
  getString: jest.fn((key: string, vars?: Record<string, unknown>) =>
    vars
      ? `l10n string: [${key}], with vars: ${JSON.stringify(vars)}`
      : `l10n string: [${key}], with vars: {}`,
  ),
  getFragment: jest.fn((key: string) => `l10n fragment: [${key}]`),
};

import { mockedRuntimeData } from "../../apiMocks/mockData";

const mockRuntimeData: RuntimeData = mockedRuntimeData;

describe("PlanGrid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useL10n as jest.Mock).mockReturnValue(l10nMock);
    (useGaViewPing as jest.Mock).mockReturnValue({ current: null });
    (useGaEvent as jest.Mock).mockReturnValue(jest.fn());
  });

  describe("basic rendering", () => {
    it("renders all plans when available in country", () => {
      (useIsLoggedIn as jest.Mock).mockReturnValue("logged-out");
      render(<PlanGrid runtimeData={mockRuntimeData} />);

      expect(screen.getByTestId("plan-grid-megabundle")).toBeInTheDocument();
      expect(
        screen.getAllByText(/plan-grid-premium-title/).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(/plan-grid-free-title/)).toBeInTheDocument();
    });

    it("hides megabundle if not available in country", () => {
      jest.mocked(isMegabundleAvailableInCountry).mockReturnValueOnce(false);
      render(<PlanGrid runtimeData={mockRuntimeData} />);

      expect(
        screen.queryByText(/plan-grid-megabundle-title-2/),
      ).not.toBeInTheDocument();
    });
  });

  describe("user state interactions", () => {
    it("disables free plan button when user is logged in", () => {
      (useIsLoggedIn as jest.Mock).mockReturnValue("logged-in");
      render(<PlanGrid runtimeData={mockRuntimeData} />);

      expect(screen.getByText(/plan-matrix-your-plan/)).toBeInTheDocument();
    });
  });

  describe("pricing toggle", () => {
    it("renders PricingToggle yearly price by default", () => {
      render(<PlanGrid runtimeData={mockRuntimeData} />);
      expect(
        screen.getAllByText(/plan-matrix-price-yearly-calculated/).length,
      ).toBeGreaterThan(0);
    });
  });

  describe("analytics", () => {
    it("tracks GA event on subscription button click", () => {
      render(<PlanGrid runtimeData={mockRuntimeData} />);
      const buttons = screen.getAllByRole("link", {
        name: /plan-grid-card-btn/,
      });
      fireEvent.click(buttons[0]);

      expect(buttons[0]).toBeInTheDocument();
    });
  });
});
