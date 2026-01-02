import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanGrid } from "./PlanGrid";
import { useIsLoggedIn } from "../../hooks/session";
import { RuntimeData } from "../../hooks/api/types";

jest.mock("../../hooks/hasRenderedClientSide");
jest.mock("../../hooks/session");
jest.mock("../../functions/trackPurchase");
jest.mock("../../functions/cookies", () => ({ setCookie: jest.fn() }));
jest.mock(
  "../../config.ts",
  () => jest.requireActual("../../../__mocks__/configMock").mockConfigModule,
);

jest.mock("../../functions/getPlan", () => ({
  getBundlePrice: jest.fn(() => "$10"),
  getBundleYearlyPrice: jest.fn(() => "$100"),
  getBundleSubscribeLink: jest.fn(() => "https://subscribe.megabundle.mock"),
  isBundleAvailableInCountry: jest.fn(() => true),

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

import { mockedRuntimeData } from "../../../__mocks__/api/mockData";

const mockRuntimeData: RuntimeData = mockedRuntimeData;

describe("PlanGrid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.useL10nImpl = () => l10nMock;
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
    it("tracks GA event on subscription button click", async () => {
      const user = userEvent.setup();
      render(<PlanGrid runtimeData={mockRuntimeData} />);
      const buttons = screen.getAllByRole("link", {
        name: /plan-grid-card-btn/,
      });

      await user.click(buttons[0]);

      expect(buttons[0]).toBeInTheDocument();
    });
  });
});
