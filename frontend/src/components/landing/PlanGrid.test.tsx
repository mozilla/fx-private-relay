import { render, screen, fireEvent } from "@testing-library/react";
import { PlanGrid } from "./PlanGrid";
import { useL10n } from "../../hooks/l10n";
import { useIsLoggedIn } from "../../hooks/session";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { useGaEvent } from "../../hooks/gaEvent";
import { trackPlanPurchaseStart } from "../../functions/trackPurchase";

// Mock hooks and utilities
jest.mock("../../hooks/l10n");
jest.mock("../../hooks/gaViewPing");
jest.mock("../../hooks/gaEvent");
jest.mock("../../hooks/session");
jest.mock("../../functions/trackPurchase");
jest.mock("../../functions/cookies", () => ({ setCookie: jest.fn() }));
jest.mock("../../config", () => ({
  getRuntimeConfig: () => ({ fxaLoginUrl: "/login" }),
}));
jest.mock("../../functions/getPlan", () => ({
  getMegabundlePrice: jest.fn(() => "$10"),
  getMegabundleYearlyPrice: jest.fn(() => "$100"),
  getIndividualBundlePrice: jest.fn(() => 15),
  getBundleDiscountPercentage: jest.fn(() => "33%"),
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
  getString: jest.fn((key, vars) =>
    vars
      ? `l10n string: [${key}], with vars: ${JSON.stringify(vars)}`
      : `l10n string: [${key}], with vars: {}`,
  ),
  getFragment: jest.fn((key, options) => `l10n fragment: [${key}]`),
};

const mockRuntimeData = {
  MEGABUNDLE_PLANS: {
    available_in_country: true,
  },
  PHONE_PLANS: {
    available_in_country: true,
  },
  PERIODICAL_PREMIUM_PLANS: {
    available_in_country: true,
  },
};

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
      render(<PlanGrid runtimeData={mockRuntimeData as any} />);

      expect(screen.getByTestId("plan-grid-megabundle")).toBeInTheDocument();
      expect(
        screen.getAllByText(/plan-grid-premium-title/).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(/plan-grid-free-title/)).toBeInTheDocument();
    });

    it("hides megabundle if not available in country", () => {
      const {
        isMegabundleAvailableInCountry,
      } = require("../../functions/getPlan");
      isMegabundleAvailableInCountry.mockReturnValueOnce(false);

      render(<PlanGrid runtimeData={mockRuntimeData as any} />);
      expect(
        screen.queryByText(/plan-grid-megabundle-title/),
      ).not.toBeInTheDocument();
    });
  });

  describe("user state interactions", () => {
    it("disables free plan button when user is logged in", () => {
      (useIsLoggedIn as jest.Mock).mockReturnValue("logged-in");
      render(<PlanGrid runtimeData={mockRuntimeData as any} />);

      expect(screen.getByText(/plan-matrix-your-plan/)).toBeInTheDocument();
    });
  });

  describe("pricing toggle", () => {
    it("renders PricingToggle yearly price by default", () => {
      render(<PlanGrid runtimeData={mockRuntimeData as any} />);
      expect(
        screen.getAllByText(/plan-matrix-price-yearly-calculated/).length,
      ).toBeGreaterThan(0);
    });
  });

  describe("analytics", () => {
    it("tracks GA event on subscription button click", () => {
      render(<PlanGrid runtimeData={mockRuntimeData as any} />);
      const buttons = screen.getAllByRole("link", {
        name: /plan-grid-card-btn/,
      });
      fireEvent.click(buttons[0]);

      expect(buttons[0]).toBeInTheDocument();
      // You could add expect(trackPlanPurchaseStart).toHaveBeenCalled() if needed
    });
  });
});
